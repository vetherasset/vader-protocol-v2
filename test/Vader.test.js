const {
    // Deployment Function
    deployMock,

    // Testing Utilities
    assertBn,
    assertErrors,
    assertEvents,
    UNSET_ADDRESS,
    TEN_UNITS,
    parseUnits,

    // Library Functions
    verboseAccounts,
    time,
    big,

    // Project Specific Utilities
    advanceEpochs,

    // Project Specific Constants
    PROJECT_CONSTANTS,
} = require("./utils")(artifacts);

contract.only("Vader", (accounts) => {
    describe("construction", () => {
        it("should deploy the Vader contract with a correct state", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);

            const { vader } = await deployMock(accounts);
            assert.ok(vader.address);

            assert.equal(await vader.name(), "Vader");
            assert.equal(await vader.symbol(), "VADER");
            assert.equal(await vader.converter(), UNSET_ADDRESS);
            assert.equal(await vader.vest(), UNSET_ADDRESS);
            assert.equal(await vader.usdv(), UNSET_ADDRESS);
            assert.equal(await vader.owner(), accounts.administrator);

            assertBn(await vader.decimals(), 18);

            // NOTE: Constants are only set after the first deployment
            const { INITIAL_VADER_SUPPLY, GRANT_ALLOCATION } =
                PROJECT_CONSTANTS;

            assertBn(await vader.maxSupply(), INITIAL_VADER_SUPPLY);

            const currentSupply = await vader.totalSupply();
            assertBn(currentSupply, await vader.balanceOf(vader.address));
            assertBn(currentSupply, GRANT_ALLOCATION);
        });
    });

    describe("component setup", () => {
        it("should disallow setting the components of Vader incorrectly", async () => {
            const { vader, vesting, converter, usdv, ADMINISTRATOR } =
                await deployMock();

            await assertErrors(
                vader.setComponents(
                    UNSET_ADDRESS,
                    vesting.address,
                    usdv.address,
                    accounts.dao,
                    [accounts.account0],
                    [parseUnits(2_500_000_000, 18)],
                    ADMINISTRATOR
                ),
                "Vader::setComponents: Incorrect Arguments"
            );
            await assertErrors(
                vader.setComponents(
                    converter.address,
                    UNSET_ADDRESS,
                    usdv.address,
                    accounts.dao,
                    [accounts.account0],
                    [parseUnits(2_500_000_000, 18)],
                    ADMINISTRATOR
                ),
                "Vader::setComponents: Incorrect Arguments"
            );
            await assertErrors(
                vader.setComponents(
                    converter.address,
                    vesting.address,
                    UNSET_ADDRESS,
                    accounts.dao,
                    [accounts.account0],
                    [parseUnits(2_500_000_000, 18)],
                    ADMINISTRATOR
                ),
                "Vader::setComponents: Incorrect Arguments"
            );
        });

        it("should disallow the components to be set from anyone other than the owner", async () => {
            const { vader, vesting, converter, usdv } = await deployMock();

            await assertErrors(
                vader.setComponents(
                    converter.address,
                    vesting.address,
                    usdv.address,
                    accounts.dao,
                    [accounts.account0],
                    [parseUnits(2_500_000_000, 18)]
                ),
                "Ownable: caller is not the owner"
            );
        });

        it("should allow the components to be set properly by the contract owner", async () => {
            const { vader, vesting, converter, usdv, ADMINISTRATOR } =
                await deployMock();

            assertEvents(
                await vader.setComponents(
                    converter.address,
                    vesting.address,
                    usdv.address,
                    accounts.dao,
                    [accounts.account0],
                    [parseUnits(2_500_000_000, 18)],
                    ADMINISTRATOR
                ),
                {
                    ProtocolInitialized: {
                        converter: converter.address,
                        vest: vesting.address,
                        usdv: usdv.address,
                        dao: accounts.dao,
                    },
                }
            );

            const { VETH_ALLOCATION, TEAM_ALLOCATION } = PROJECT_CONSTANTS;

            assert.equal(await vader.owner(), accounts.dao);
            assert.equal(await vader.converter(), converter.address);
            assert.equal(await vader.vest(), vesting.address);
            assert.equal(await vader.usdv(), usdv.address);

            assertBn(await vader.balanceOf(converter.address), VETH_ALLOCATION);
            assertBn(await vader.balanceOf(vesting.address), TEAM_ALLOCATION);
        });

        it("should disallow re-setting the components by the new owner (dao)", async () => {
            const { vader, vesting, converter, usdv, FAKE_DAO } =
                await deployMock();

            await assertErrors(
                vader.setComponents(
                    converter.address,
                    vesting.address,
                    usdv.address,
                    accounts.account3,
                    [accounts.account0],
                    [parseUnits(2_500_000_000, 18)],
                    FAKE_DAO
                ),
                "Vader::setComponents: Already Set"
            );
        });
    });

    describe("DAO functions", () => {
        it("should disallow grants to be claimed by the temporary owner", async () => {
            const { vader } = await deployMock(accounts);

            await assertErrors(
                vader.claimGrant(accounts.account0, TEN_UNITS),
                "Vader::_onlyDAO: DAO not set yet"
            );
        });

        it("should disallow the maximum supply to be reset by the temporary owner", async () => {
            const { vader } = await deployMock();

            await assertErrors(
                vader.adjustMaxSupply((await vader.totalSupply()).add(big(1))),
                "Vader::_onlyDAO: DAO not set yet"
            );
        });

        it("should allow the maximum supply to be changed by the DAO", async () => {
            const { vader, FAKE_DAO, converter, vesting, usdv, ADMINISTRATOR } =
                await deployMock();

            const { INITIAL_VADER_SUPPLY, TEAM_ALLOCATION } = PROJECT_CONSTANTS;
            await vader.setComponents(
                converter.address,
                vesting.address,
                usdv.address,
                accounts.dao,
                [accounts.account0],
                [TEAM_ALLOCATION],
                ADMINISTRATOR
            );

            assertBn(await vader.maxSupply(), INITIAL_VADER_SUPPLY);

            const nextSupply = (await vader.maxSupply()).add(big(1));
            assertEvents(await vader.adjustMaxSupply(nextSupply, FAKE_DAO), {
                MaxSupplyChanged: {
                    previous: INITIAL_VADER_SUPPLY,
                    next: nextSupply,
                },
            });

            assertBn(await vader.maxSupply(), nextSupply);
        });

        it("should not allow zero-value grants by the DAO", async () => {
            const { vader, FAKE_DAO } = await deployMock();

            await assertErrors(
                vader.claimGrant(accounts.account0, 0, FAKE_DAO),
                "Vader::claimGrant: Non-Zero Amount Required"
            );
        });
    });
});
