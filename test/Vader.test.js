const {
    // Deployment Function
    deployMock,

    // Testing Utilities
    assertBn,
    assertErrors,
    assertEvents,
    UNSET_ADDRESS,
    TEN_UNITS,

    // Library Functions
    verboseAccounts,
    time,
    big,

    // Project Specific Utilities
    advanceEpochs,

    // Project Specific Constants
    PROJECT_CONSTANTS,
} = require("./utils")(artifacts);

contract("Vader", (accounts) => {
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

            // NOTE: 60 seconds deviation to account for deployment order
            assertBn(await vader.lastEmission(), await time.latest(), big(60));

            // NOTE: Constants are only set after the first deployment
            const {
                INITIAL_EMISSION_CURVE,
                INITIAL_VADER_SUPPLY,
                ECOSYSTEM_GROWTH,
                MAX_FEE_BASIS_POINTS,
                EMISSION_ERA,
                ONE_YEAR,
            } = PROJECT_CONSTANTS;

            const emissionCurve = await vader.emissionCurve();
            assertBn(emissionCurve, INITIAL_EMISSION_CURVE);
            assertBn(await vader.maxSupply(), INITIAL_VADER_SUPPLY);

            const currentSupply = await vader.totalSupply();
            assertBn(currentSupply, await vader.balanceOf(vader.address));
            assertBn(currentSupply, ECOSYSTEM_GROWTH);

            assertBn(
                await vader.calculateFee(),
                MAX_FEE_BASIS_POINTS.mul(ECOSYSTEM_GROWTH).div(
                    INITIAL_VADER_SUPPLY
                )
            );

            assertBn(
                await vader.getCurrentEraEmission(),
                INITIAL_VADER_SUPPLY.sub(ECOSYSTEM_GROWTH)
                    .div(emissionCurve)
                    .div(ONE_YEAR.div(EMISSION_ERA))
            );
        });
    });

    describe("component setup", () => {
        it("should disallow setting the components of Vader incorrectly", async () => {
            const {
                vader,
                vesting,
                converter,
                usdv,
                ADMINISTRATOR,
            } = await deployMock();

            await assertErrors(
                vader.setComponents(
                    UNSET_ADDRESS,
                    vesting.address,
                    usdv.address,
                    accounts.dao,
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
                    ADMINISTRATOR
                ),
                "Vader::setComponents: Incorrect Arguments"
            );
            await assertErrors(
                vader.setComponents(
                    converter.address,
                    vesting.address,
                    usdv.address,
                    UNSET_ADDRESS,
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
                    accounts.dao
                ),
                "Ownable: caller is not the owner"
            );
        });

        it("should allow the components to be set properly by the contract owner", async () => {
            const {
                vader,
                vesting,
                converter,
                usdv,
                ADMINISTRATOR,
            } = await deployMock();

            assertEvents(
                await vader.setComponents(
                    converter.address,
                    vesting.address,
                    usdv.address,
                    accounts.dao,
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

            assert.ok(await vader.untaxed(converter.address));
            assert.ok(await vader.untaxed(vesting.address));
            assert.ok(await vader.untaxed(usdv.address));

            assertBn(await vader.balanceOf(converter.address), VETH_ALLOCATION);
            assertBn(await vader.balanceOf(vesting.address), TEAM_ALLOCATION);
        });

        it("should disallow re-setting the components by the new owner (dao)", async () => {
            const {
                vader,
                vesting,
                converter,
                usdv,
                FAKE_DAO,
            } = await deployMock();

            await assertErrors(
                vader.setComponents(
                    converter.address,
                    vesting.address,
                    usdv.address,
                    accounts.dao,
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

        it("should disallow emissions to be adjusted by the temporary owner", async () => {
            const { vader } = await deployMock();

            await assertErrors(
                vader.adjustEmission(big(10)),
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

        it("should allow grants to be claimed by the DAO without a transaction fee", async () => {
            const {
                vader,
                vesting,
                converter,
                usdv,
                ADMINISTRATOR,
                FAKE_DAO,
            } = await deployMock();

            const { ECOSYSTEM_GROWTH } = PROJECT_CONSTANTS;

            await vader.setComponents(
                converter.address,
                vesting.address,
                usdv.address,
                accounts.dao,
                ADMINISTRATOR
            );

            assertBn(await vader.balanceOf(accounts.account0), 0);
            assertBn(await vader.balanceOf(vader.address), ECOSYSTEM_GROWTH);

            assertEvents(
                await vader.claimGrant(accounts.account0, TEN_UNITS, FAKE_DAO),
                {
                    GrantClaimed: {
                        beneficiary: accounts.account0,
                        amount: TEN_UNITS,
                    },
                }
            );

            assertBn(await vader.balanceOf(accounts.account0), TEN_UNITS);
            assertBn(
                await vader.balanceOf(vader.address),
                ECOSYSTEM_GROWTH.sub(TEN_UNITS)
            );
        });

        it("should not allow zero-value grants by the DAO", async () => {
            const { vader, FAKE_DAO } = await deployMock();

            await assertErrors(
                vader.claimGrant(accounts.account0, 0, FAKE_DAO),
                "Vader::claimGrant: Non-Zero Amount Required"
            );
        });

        it("should allow the emission to be adjusted by the DAO", async () => {
            const { vader, FAKE_DAO } = await deployMock();

            const { INITIAL_EMISSION_CURVE } = PROJECT_CONSTANTS;

            assertBn(await vader.emissionCurve(), INITIAL_EMISSION_CURVE);

            const newEmission = big(10);
            assertEvents(await vader.adjustEmission(newEmission, FAKE_DAO), {
                EmissionChanged: {
                    previous: INITIAL_EMISSION_CURVE,
                    next: newEmission,
                },
            });

            assertBn(await vader.emissionCurve(), newEmission);
        });

        it("should not allow the emission to be adjusted to zero by the DAO", async () => {
            const { vader, FAKE_DAO } = await deployMock();

            await assertErrors(
                vader.adjustEmission(0, FAKE_DAO),
                "Vader::adjustEmission: Incorrect Curve Emission"
            );
        });

        it("should allow the maximum supply to be changed by the DAO", async () => {
            const { vader, FAKE_DAO } = await deployMock();

            const { INITIAL_VADER_SUPPLY } = PROJECT_CONSTANTS;

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

        it("should not allow the maximum supply to be set to lower than the current supply by the DAO", async () => {
            const { vader, FAKE_DAO } = await deployMock();

            await assertErrors(
                vader.adjustMaxSupply(
                    (await vader.totalSupply()).sub(big(1)),
                    FAKE_DAO
                ),
                "Vader::adjustMaxSupply: Max supply cannot subcede current supply"
            );
        });
    });

    describe("emissions", () => {
        it("should emit an era's emission to the USDV token for distribution properly", async () => {
            const { vader, usdv } = await deployMock();

            const { EMISSION_ERA } = PROJECT_CONSTANTS;

            const estimatedEmission = await vader.getCurrentEraEmission();
            const lastEmission = await vader.lastEmission();
            const previousSupply = await vader.totalSupply();

            if ((await time.latest()).lt(lastEmission.add(EMISSION_ERA)))
                await time.increaseTo(lastEmission.add(EMISSION_ERA));

            assertEvents(await vader.syncEmissions(), {
                Emission: {
                    amount: estimatedEmission,
                    lastEmission: lastEmission.add(EMISSION_ERA),
                },
                Transfer: {
                    from: UNSET_ADDRESS,
                    to: usdv.address,
                    value: estimatedEmission,
                },
            });

            assertBn(
                (await vader.totalSupply()).sub(previousSupply),
                estimatedEmission
            );
            assertBn(
                await vader.lastEmission(),
                lastEmission.add(EMISSION_ERA)
            );
        });

        it("should properly emit the diminishing emissions of two (n) consequent eras", async () => {
            const { vader, usdv } = await deployMock();

            const { EMISSION_ERA } = PROJECT_CONSTANTS;

            const estimatedEmission = await vader.getCurrentEraEmission();
            const estimatedSecondEmission = await vader.getEraEmission(
                (await vader.totalSupply()).add(estimatedEmission)
            );
            const totalEmission = estimatedEmission.add(
                estimatedSecondEmission
            );
            const lastEmission = await vader.lastEmission();
            const previousSupply = await vader.totalSupply();

            await advanceEpochs(vader, 2);

            assertEvents(await vader.syncEmissions(), {
                Emission: {
                    amount: totalEmission,
                    lastEmission: lastEmission.add(EMISSION_ERA.mul(big(2))),
                },
                Transfer: {
                    from: UNSET_ADDRESS,
                    to: usdv.address,
                    value: totalEmission,
                },
            });

            assertBn(
                (await vader.totalSupply()).sub(previousSupply),
                totalEmission
            );
        });

        it("should not do anything if the era has not advanced", async () => {
            const { vader } = await deployMock();
            const currentSupply = await vader.totalSupply();

            await vader.syncEmissions();

            assertBn(await vader.totalSupply(), currentSupply);
        });

        it("should converge to the maximum supply as eras pass", async () => {
            const { vader, FAKE_DAO } = await deployMock();

            await vader.adjustEmission(big(1), FAKE_DAO);

            // 5 years
            await advanceEpochs(vader, 365 * 5);

            await vader.syncEmissions();

            const currentSupply = await vader.totalSupply();
            const maxSupply = await vader.maxSupply();
            /**
             * The max supply will actually never be reached with the daily emission schedule
             * as it is constantly diminishing. After 5 years, however, we will have come very
             * close to the actual maximum supply by a margin of error less than 0.5%, hence the
             * tolerance we set below (0.5% == 5/1000 == 1/200).
             */
            const tolerance = maxSupply.div(big(200));
            assertBn(currentSupply, maxSupply, tolerance);
        });
    });

    describe("transaction fee", () => {
        it("should properly apply a transaction fee to transactions based on how close to the maximum supply the token is", async () => {
            const { vader } = await deployMock();

            const {
                MAX_FEE_BASIS_POINTS,
                MAX_BASIS_POINTS,
            } = PROJECT_CONSTANTS;

            // NOTE: The previous test converged the total supply close to the maximum supply, meaning our fee is very close to 1% now
            const feeNearMax = await vader.calculateFee();

            // Only one basis point deviation
            assertBn(feeNearMax, MAX_FEE_BASIS_POINTS, big(1));

            // NOTE: Account 0 has a 10 unit grant from the previous test chain
            const FIVE_UNITS = TEN_UNITS.div(big(2));
            const tax = FIVE_UNITS.mul(feeNearMax).div(MAX_BASIS_POINTS);
            const previousSupply = await vader.totalSupply();

            assertBn(await vader.balanceOf(accounts.account0), TEN_UNITS);
            assertBn(await vader.balanceOf(accounts.account1), 0);

            assertEvents(
                await vader.transfer(accounts.account1, FIVE_UNITS, {
                    from: accounts.account0,
                }),
                {
                    Transfer: [
                        {
                            from: accounts.account0,
                            to: accounts.account1,
                            value: FIVE_UNITS.sub(tax),
                        },
                        {
                            from: accounts.account0,
                            to: UNSET_ADDRESS,
                            value: tax,
                        },
                    ],
                }
            );

            assertBn(await vader.balanceOf(accounts.account0), FIVE_UNITS);
            assertBn(
                await vader.balanceOf(accounts.account1),
                FIVE_UNITS.sub(tax)
            );
            assertBn(previousSupply.sub(await vader.totalSupply()), tax);

            // NOTE: Tax should be very close to 1% of the amount we transferred
            assertBn(tax, FIVE_UNITS.div(big(100)), tax.div(big(100)));
        });
    });
});
