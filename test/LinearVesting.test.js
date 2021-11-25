const {
    // Deployment Function
    deployMock,

    // Testing Utilities
    assertBn,
    assertErrors,
    assertEvents,
    UNSET_ADDRESS,
    DEFAULT_CONFIGS,
    parseUnits,

    // Library Functions
    verboseAccounts,
    time,
    big,

    // Project Specific Constants
    PROJECT_CONSTANTS,
} = require("./utils")(artifacts);

contract.only("LinearVesting", (accounts) => {
    describe("construction", () => {
        it("should prevent deployment with an invalid Converter address", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);

            await assertErrors(
                deployMock(accounts, {
                    LinearVesting: (_, { vader }) => [
                        vader.address,
                        UNSET_ADDRESS,
                    ],
                }),
                "LinearVesting::constructor: Misconfiguration"
            );
        });

        it("should prevent deployment with an invalid Vader address", async () => {
            await assertErrors(
                deployMock(accounts, {
                    LinearVesting: (_, {}) => [UNSET_ADDRESS, UNSET_ADDRESS],
                }),
                "LinearVesting::constructor: Misconfiguration"
            );
        });

        it("should deploy the LinearVesting contract with a correct state", async () => {
            const { vader, vesting, converter } = await deployMock(accounts);
            await converter.setVesting(vesting.address);
            assert.ok(vesting.address);

            assert.equal(await vesting.owner(), vader.address);
            assert.equal(await vesting.vader(), vader.address);
            assert.equal(await vesting.start(), 0);
            assert.equal(await vesting.end(), 0);
        });
    });

    describe("initialization", () => {
        it("should prevent anyone other than the Vader token to initialize the contract", async () => {
            const { vesting } = await deployMock();

            await assertErrors(
                vesting.begin(
                    [accounts.account1],
                    [parseUnits(25000000000, 18)]
                ),
                "Ownable: caller is not the owner"
            );
        });

        it("should properly initialize the linear vesting by having Vader mint the corresponding amount of tokens to it and starting it via begin", async () => {
            const { vader, vesting, converter, ADMINISTRATOR } =
                await deployMock();

            const { TEAM_ALLOCATION, VESTING_DURATION } = PROJECT_CONSTANTS;

            assertBn(await vader.balanceOf(vesting.address), 0);

            const estimatedStart = await time.latest();

            await vader.setComponents(
                converter.address,
                vesting.address,
                [accounts.account0, accounts.account1],
                [
                    TEAM_ALLOCATION.sub(parseUnits(1000000, 18)),
                    parseUnits(1000000, 18),
                ],
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
                vesting.claim({ from: accounts.account3 }),
                "LinearVesting::claim: Incorrect Vesting Type"
            );
        });

        // TODO: Check with alex why this is causing a timeout
        // it("should not allow claims to be made if the vesting has not started yet", async () => {
        //     const { vesting } = await deployMock();

        //     await assertErrors(
        //         vesting.claim(),
        //         "LinearVesting::claim: Incorrect Vesting Type"
        //     );
        // });

        // it("should not allow the pending claim to be calculated if the vesting has not started yet", async () => {
        //     const { vesting } = await deployMock();

        //     await assertErrors(
        //         vesting.getClaim(accounts.account1, parseUnits(1000, 18)),
        //         "LinearVesting::_hasStarted: Vesting hasn't started yet",
        //         true
        //     );
        // });

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

            assertBn(
                vester.amount,
                TEAM_ALLOCATION.sub(parseUnits(1000000, 18))
            );
            assertBn(vester.lastClaim, 0);

            const measuredVestedAmount = await vesting.getClaim(VESTER.from);

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

            assertBn(
                vester.amount,
                TEAM_ALLOCATION.sub(parseUnits(1000000, 18)).sub(
                    actualVestedAmount
                )
            );
            assertBn(vester.lastClaim, await time.latest());

            assertBn(
                await vader.balanceOf(vesting.address),
                TEAM_ALLOCATION.sub(actualVestedAmount)
            );
        });
    });
});
