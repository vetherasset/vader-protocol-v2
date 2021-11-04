const {
    // Deployment Function
    deployMock,

    // Testing Utilities
    assertBn,
    assertErrors,
    assertEvents,
    UNSET_ADDRESS,
    DEFAULT_CONFIGS,

    // Library Functions
    verboseAccounts,
    time,
    big,

    // Project Specific Constants
    PROJECT_CONSTANTS,
} = require("./utils")(artifacts);

contract("LinearVesting", (accounts) => {
    describe("construction", () => {
        it("should prevent deployment with a zero-amount vested", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);

            await assertErrors(
                deployMock(accounts, {
                    LinearVesting: ({ account0 }, { vader }) => [
                        vader.address,
                        [account0],
                        [big(0)],
                    ],
                }),
                "LinearVesting::constructor: Incorrect Amount Specified"
            );
        });

        it("should prevent deployment with a sum different than the team allocation", async () => {
            const { TEAM_ALLOCATION } = PROJECT_CONSTANTS;

            await assertErrors(
                deployMock(accounts, {
                    LinearVesting: ({ account0, account1 }, { vader }) => [
                        vader.address,
                        [account0, account1],
                        [TEAM_ALLOCATION, big(1)],
                    ],
                }),
                "LinearVesting::constructor: Invalid Vest Amounts Specified"
            );

            await assertErrors(
                deployMock(accounts, {
                    LinearVesting: ({ account0, account1 }, { vader }) => [
                        vader.address,
                        [account0, account1],
                        [TEAM_ALLOCATION.sub(big(2)), big(1)],
                    ],
                }),
                "LinearVesting::constructor: Invalid Vest Amounts Specified"
            );
        });

        it("should prevent deployment with different length vesters and amounts", async () => {
            const { TEAM_ALLOCATION } = PROJECT_CONSTANTS;

            await assertErrors(
                deployMock(accounts, {
                    LinearVesting: ({ account0 }, { vader }) => [
                        vader.address,
                        [account0],
                        [TEAM_ALLOCATION.sub(big(1)), big(1)],
                    ],
                }),
                "LinearVesting::constructor: Misconfiguration"
            );

            await assertErrors(
                deployMock(accounts, {
                    LinearVesting: ({ account0, account1 }, { vader }) => [
                        vader.address,
                        [account0, account1],
                        [TEAM_ALLOCATION],
                    ],
                }),
                "LinearVesting::constructor: Misconfiguration"
            );
        });

        it("should prevent deployment with an invalid Vader address", async () => {
            const { TEAM_ALLOCATION } = PROJECT_CONSTANTS;

            await assertErrors(
                deployMock(accounts, {
                    LinearVesting: ({ account0 }) => [
                        UNSET_ADDRESS,
                        [account0],
                        [TEAM_ALLOCATION],
                    ],
                }),
                "LinearVesting::constructor: Misconfiguration"
            );
        });

        it("should deploy the LinearVesting contract with a correct state", async () => {
            const { vader, vesting } = await deployMock(accounts);
            assert.ok(vesting.address);

            assert.equal(await vesting.owner(), vader.address);
            assert.equal(await vesting.vader(), vader.address);
            assert.equal(await vesting.start(), 0);
            assert.equal(await vesting.end(), 0);

            const [, vests, vestAmounts] = DEFAULT_CONFIGS.LinearVesting(
                accounts,
                {
                    vader,
                }
            );

            for (let i = 0; i < vests.length; i++) {
                const vester = await vesting.vest(vests[i]);
                assertBn(vester.amount, vestAmounts[i]);
                assertBn(vester.lastClaim, 0);
            }
        });
    });

    describe("initialization", () => {
        it("should prevent anyone other than the Vader token to initialize the contract", async () => {
            const { vesting, ADMINISTRATOR } = await deployMock();

            await assertErrors(
                vesting.begin(ADMINISTRATOR),
                "Ownable: caller is not the owner"
            );
        });

        it("should properly initialize the linear vesting by having Vader mint the corresponding amount of tokens to it and starting it via begin", async () => {
            const { vader, vesting, converter, usdv, ADMINISTRATOR } =
                await deployMock();

            const { TEAM_ALLOCATION, VESTING_DURATION } = PROJECT_CONSTANTS;

            assertBn(await vader.balanceOf(vesting.address), 0);

            const estimatedStart = await time.latest();

            await vader.setComponents(
                converter.address,
                vesting.address,
                usdv.address,
                accounts.dao,
                ADMINISTRATOR
            );

            assertBn(await vader.balanceOf(vesting.address), TEAM_ALLOCATION);
            assertBn(await vesting.owner(), UNSET_ADDRESS);

            // NOTE: 10 second deviation as time advances per transaction
            const tenSecondDeviation = big(10);
            assertBn(await vesting.start(), estimatedStart, tenSecondDeviation);
            assertBn(
                await vesting.end(),
                estimatedStart.add(VESTING_DURATION),
                tenSecondDeviation
            );
        });
    });

    describe("vesting", () => {
        it("should not allow claims to be made by non-vesters", async () => {
            const { vesting } = await deployMock();

            await assertErrors(
                vesting.claim({ from: accounts.account1 }),
                "LinearVesting::claim: Nothing to claim"
            );
        });

        it("should allow claims to be made by vesters", async () => {
            const { vesting, vader, VESTER } = await deployMock();

            const { TEAM_ALLOCATION, VESTING_DURATION } = PROJECT_CONSTANTS;

            // NOTE: Advance time to a random point during vesting
            const randomTime = Math.floor(
                Math.random() * VESTING_DURATION.toNumber()
            );

            const finalTime = (await vesting.start()).add(big(randomTime));

            if (finalTime.gt(await time.latest()))
                await time.increaseTo(finalTime);

            assertBn(await vader.balanceOf(VESTER.from), 0);
            assertBn(await vader.balanceOf(vesting.address), TEAM_ALLOCATION);

            let vester = await vesting.vest(VESTER.from);

            assertBn(vester.amount, TEAM_ALLOCATION);
            assertBn(vester.lastClaim, 0);

            const measuredVestedAmount = await vesting.getClaim(VESTER);

            // NOTE: The default vesting configuration assigns the full TEAM_ALLOCATION to the single vester
            const estimatedVestedAmount = TEAM_ALLOCATION.mul(
                (await time.latest()).sub(await vesting.start())
            ).div(VESTING_DURATION);

            // NOTE: We allow 0.1% deviation as actual time of acceptance for tx varies from time of measurement / estimation
            assertEvents(await vesting.claim(VESTER), {
                Vested: {
                    from: VESTER.from,
                    amount: [
                        measuredVestedAmount,
                        measuredVestedAmount.div(big(1000)),
                    ],
                },
            });

            const actualVestedAmount = await vader.balanceOf(VESTER.from);

            // NOTE: We allow 0.1% deviation as actual time of acceptance for tx varies from time of measurement / estimation
            assertBn(
                actualVestedAmount,
                estimatedVestedAmount,
                actualVestedAmount.div(big(1000))
            );

            // NOTE: We allow 0.1% deviation as actual time of acceptance for tx varies from time of measurement / estimation
            assertBn(
                actualVestedAmount,
                measuredVestedAmount,
                actualVestedAmount.div(big(1000))
            );

            vester = await vesting.vest(VESTER.from);

            assertBn(vester.amount, TEAM_ALLOCATION.sub(actualVestedAmount));
            assertBn(vester.lastClaim, await time.latest());

            assertBn(
                await vader.balanceOf(vesting.address),
                TEAM_ALLOCATION.sub(actualVestedAmount)
            );
        });

        it("should release the full vesting amount at the end of the vesting period regardless of intermittent claims", async () => {
            const { vesting, vader, VESTER } = await deployMock();

            const { TEAM_ALLOCATION } = PROJECT_CONSTANTS;

            const { amount: remainingAmount } = await vesting.vest(VESTER.from);

            await time.increaseTo(await vesting.end());

            const previousBalance = await vader.balanceOf(VESTER.from);

            await vesting.claim(VESTER);

            const { amount: finalAmount } = await vesting.vest(VESTER.from);

            assertBn(
                (await vader.balanceOf(VESTER.from)).sub(previousBalance),
                remainingAmount
            );
            assertBn(await vader.balanceOf(VESTER.from), TEAM_ALLOCATION);
            assertBn(await vader.balanceOf(vesting.address), 0);

            assertBn(finalAmount, 0);
        });

        it("should not allow claims to be made if the vesting has not started yet", async () => {
            const { vesting, VESTER } = await deployMock(accounts);

            await assertErrors(
                vesting.claim(VESTER),
                "LinearVesting::_hasStarted: Vesting hasn't started yet"
            );
        });

        it("should not allow the pending claim to be calculated if the vesting has not started yet", async () => {
            const { vesting, VESTER } = await deployMock(accounts);

            await assertErrors(
                vesting.getClaim(VESTER),
                "LinearVesting::_hasStarted: Vesting hasn't started yet"
            );
        });
    });
});
