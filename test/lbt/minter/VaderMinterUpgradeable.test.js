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
} = require("../../utils")(artifacts);

const MAX_FEE = 10000;
const MAX_LOCK_DURATION = 30 * 24 * 3600;

// Daily limits
const FEE = 200;
const MINT_LIMIT = 200n * 10n ** 18n;
const BURN_LIMIT = 100n * 10n ** 18n;
const LOCK_DURATION = 20;
// Partner limits
const PARTNER_FEE = 100;
const PARTNER_MINT_LIMIT = 300n * 10n ** 18n;
const PARTNER_BURN_LIMIT = 200n * 10n ** 18n;
const PARTNER_LOCK_DURATION = 10;

// Vader amount for mint
const V_AMOUNT = big(100).mul(big(10).pow(big(18)));

contract("VaderMinterUpgradeable", (accounts) => {
    let vaderMinter;
    let usdv;
    let lbt;
    let admin;
    let user;
    let partner;
    before(async () => {
        accounts = await verboseAccounts(accounts);
        const cache = await deployMock(accounts, {
            VaderMinter: (_, { mockUsdv, ADMINISTRATOR }) => [
                mockUsdv.address,
                ADMINISTRATOR,
            ],
        });

        vaderMinter = cache.vaderMinter;
        usdv = cache.mockUsdv;
        lbt = cache.mockLbt;
        admin = cache.ADMINISTRATOR;
        user = accounts.account0;
        partner = accounts.account1;

        await vaderMinter.initialize(admin);
    });

    describe("constructor", () => {
        it("should deploy", async () => {
            assert.equal(await vaderMinter.usdv(), usdv.address);
        });
    });

    describe("setDailyLimits", () => {
        it("should reject if not owner", async () => {
            await assertErrors(
                vaderMinter.setDailyLimits(
                    FEE,
                    MINT_LIMIT,
                    BURN_LIMIT,
                    LOCK_DURATION,
                    {
                        from: accounts.account0,
                    }
                ),
                "Ownable: caller is not the owner"
            );
        });

        it("should reject if fee > max", async () => {
            await assertErrors(
                vaderMinter.setDailyLimits(
                    MAX_FEE + 1,
                    MINT_LIMIT,
                    BURN_LIMIT,
                    LOCK_DURATION,
                    admin
                ),
                "VMU::setDailyLimits: Invalid Fee"
            );
        });

        it("should reject if lock duration > max", async () => {
            await assertErrors(
                vaderMinter.setDailyLimits(
                    FEE,
                    MINT_LIMIT,
                    BURN_LIMIT,
                    MAX_LOCK_DURATION + 1,
                    admin
                ),
                "VMU::setDailyLimits: Invalid lock duration"
            );
        });

        it("should allow owner to call", async () => {
            await vaderMinter.setDailyLimits(
                FEE,
                MINT_LIMIT,
                BURN_LIMIT,
                LOCK_DURATION,
                admin
            );

            const dailyLimits = await vaderMinter.dailyLimits();

            assert.equal(dailyLimits.fee, FEE);
            assert.equal(dailyLimits.mintLimit, MINT_LIMIT);
            assert.equal(dailyLimits.burnLimit, BURN_LIMIT);
            assert.equal(dailyLimits.lockDuration, LOCK_DURATION);
        });
    });

    describe("whitelistPartner", () => {
        it("should reject if not owner", async () => {
            await assertErrors(
                vaderMinter.whitelistPartner(
                    partner,
                    PARTNER_FEE,
                    PARTNER_MINT_LIMIT,
                    PARTNER_BURN_LIMIT,
                    PARTNER_LOCK_DURATION,
                    {
                        from: accounts.account0,
                    }
                ),
                "Ownable: caller is not the owner"
            );
        });

        it("should reject if partner = zero address", async () => {
            await assertErrors(
                vaderMinter.whitelistPartner(
                    UNSET_ADDRESS,
                    PARTNER_FEE,
                    PARTNER_MINT_LIMIT,
                    PARTNER_BURN_LIMIT,
                    PARTNER_LOCK_DURATION,
                    admin
                ),
                "VMU::whitelistPartner: Zero Address"
            );
        });

        it("should reject if fee > max", async () => {
            await assertErrors(
                vaderMinter.whitelistPartner(
                    partner,
                    MAX_FEE + 1,
                    PARTNER_MINT_LIMIT,
                    PARTNER_BURN_LIMIT,
                    PARTNER_LOCK_DURATION,
                    admin
                ),
                "VMU::whitelistPartner: Invalid Fee"
            );
        });

        it("should reject if lock duration > max", async () => {
            await assertErrors(
                vaderMinter.whitelistPartner(
                    partner,
                    PARTNER_FEE,
                    PARTNER_MINT_LIMIT,
                    PARTNER_BURN_LIMIT,
                    MAX_LOCK_DURATION + 1,
                    admin
                ),
                "VMU::whitelistPartner: Invalid lock duration"
            );
        });

        it("should allow owner to call", async () => {
            await vaderMinter.whitelistPartner(
                partner,
                PARTNER_FEE,
                PARTNER_MINT_LIMIT,
                PARTNER_BURN_LIMIT,
                PARTNER_LOCK_DURATION,
                admin
            );

            const limits = await vaderMinter.partnerLimits(partner);

            assert.equal(limits.fee, PARTNER_FEE);
            assert.equal(limits.mintLimit, PARTNER_MINT_LIMIT);
            assert.equal(limits.burnLimit, PARTNER_BURN_LIMIT);
            assert.equal(limits.lockDuration, PARTNER_LOCK_DURATION);
        });
    });

    describe("setPartnerFee", () => {
        it("should reject if not owner", async () => {
            await assertErrors(
                vaderMinter.setPartnerFee(partner, PARTNER_FEE + 1, {
                    from: accounts.account0,
                }),
                "Ownable: caller is not the owner"
            );
        });

        it("should reject if fee > max", async () => {
            await assertErrors(
                vaderMinter.setPartnerFee(partner, MAX_FEE + 1, admin),
                "VMU::setPartnerFee: Invalid Fee"
            );
        });

        it("should allow owner to call", async () => {
            assertEvents(
                await vaderMinter.setPartnerFee(
                    partner,
                    PARTNER_FEE + 1,
                    admin
                ),
                {
                    SetPartnerFee: {
                        partner,
                        fee: PARTNER_FEE + 1,
                    },
                }
            );

            const limits = await vaderMinter.partnerLimits(partner);
            assert.equal(limits.fee, PARTNER_FEE + 1);
        });
    });

    describe("increasePartnerMintLimit", () => {
        it("should reject if not owner", async () => {
            await assertErrors(
                vaderMinter.increasePartnerMintLimit(partner, 1, {
                    from: accounts.account0,
                }),
                "Ownable: caller is not the owner"
            );
        });

        it("should allow owner to call", async () => {
            const limitsBefore = await vaderMinter.partnerLimits(partner);
            assertEvents(
                await vaderMinter.increasePartnerMintLimit(partner, 1, admin),
                {
                    IncreasePartnerMintLimit: {
                        partner,
                        mintLimit: limitsBefore.mintLimit.add(big(1)),
                    },
                }
            );
            const limitsAfter = await vaderMinter.partnerLimits(partner);

            assertBn(limitsAfter.mintLimit, limitsBefore.mintLimit.add(big(1)));
        });
    });

    describe("decreasePartnerMintLimit", () => {
        it("should reject if not owner", async () => {
            await assertErrors(
                vaderMinter.decreasePartnerMintLimit(partner, 1, {
                    from: accounts.account0,
                }),
                "Ownable: caller is not the owner"
            );
        });

        it("should allow owner to call", async () => {
            const limitsBefore = await vaderMinter.partnerLimits(partner);
            assertEvents(
                await vaderMinter.decreasePartnerMintLimit(partner, 1, admin),
                {
                    DecreasePartnerMintLimit: {
                        partner,
                        mintLimit: limitsBefore.mintLimit.sub(big(1)),
                    },
                }
            );
            const limitsAfter = await vaderMinter.partnerLimits(partner);

            assertBn(limitsAfter.mintLimit, limitsBefore.mintLimit.sub(big(1)));
        });
    });

    describe("increasePartnerBurnLimit", () => {
        it("should reject if not owner", async () => {
            await assertErrors(
                vaderMinter.increasePartnerBurnLimit(partner, 1, {
                    from: accounts.account0,
                }),
                "Ownable: caller is not the owner"
            );
        });

        it("should allow owner to call", async () => {
            const limitsBefore = await vaderMinter.partnerLimits(partner);
            assertEvents(
                await vaderMinter.increasePartnerBurnLimit(partner, 1, admin),
                {
                    IncreasePartnerBurnLimit: {
                        partner,
                        burnLimit: limitsBefore.burnLimit.add(big(1)),
                    },
                }
            );
            const limitsAfter = await vaderMinter.partnerLimits(partner);

            assertBn(limitsAfter.burnLimit, limitsBefore.burnLimit.add(big(1)));
        });
    });

    describe("decreasePartnerBurnLimit", () => {
        it("should reject if not owner", async () => {
            await assertErrors(
                vaderMinter.decreasePartnerBurnLimit(partner, 1, {
                    from: accounts.account0,
                }),
                "Ownable: caller is not the owner"
            );
        });

        it("should allow owner to call", async () => {
            const limitsBefore = await vaderMinter.partnerLimits(partner);
            assertEvents(
                await vaderMinter.decreasePartnerBurnLimit(partner, 1, admin),
                {
                    DecreasePartnerBurnLimit: {
                        partner,
                        burnLimit: limitsBefore.burnLimit.sub(big(1)),
                    },
                }
            );
            const limitsAfter = await vaderMinter.partnerLimits(partner);

            assertBn(limitsAfter.burnLimit, limitsBefore.burnLimit.sub(big(1)));
        });
    });

    describe("setPartnerLockDuration", () => {
        it("should reject if not owner", async () => {
            await assertErrors(
                vaderMinter.setPartnerLockDuration(
                    partner,
                    PARTNER_LOCK_DURATION + 1,
                    {
                        from: accounts.account0,
                    }
                ),
                "Ownable: caller is not the owner"
            );
        });

        it("should reject if lock duration > max", async () => {
            await assertErrors(
                vaderMinter.setPartnerLockDuration(
                    partner,
                    MAX_LOCK_DURATION + 1,
                    admin
                ),
                "VMU::setPartnerLockDuration: Invalid lock duration"
            );
        });

        it("should allow owner to call", async () => {
            assertEvents(
                await vaderMinter.setPartnerLockDuration(
                    partner,
                    PARTNER_LOCK_DURATION + 1,
                    admin
                ),
                {
                    SetPartnerLockDuration: {
                        partner,
                        lockDuration: PARTNER_LOCK_DURATION + 1,
                    },
                }
            );
            const limits = await vaderMinter.partnerLimits(partner);

            assert.equal(limits.lockDuration, PARTNER_LOCK_DURATION + 1);
        });
    });

    describe("setLBT", () => {
        it("should reject if not owner", async () => {
            await assertErrors(
                vaderMinter.setLBT(lbt.address, {
                    from: accounts.account0,
                }),
                "Ownable: caller is not the owner"
            );
        });

        it("should allow owner to call", async () => {
            await vaderMinter.setLBT(lbt.address, admin);
            assert.equal(await vaderMinter.lbt(), lbt.address);
        });
    });

    describe("mint", () => {
        it("should reject if total USDV mint > limit", async () => {
            await assertErrors(
                vaderMinter.mint(2n ** 128n, 1, { from: user }),
                "VMU::mint: 24 Hour Limit Reached"
            );
        });

        it("should reject if USDV amount < min", async () => {
            await assertErrors(
                vaderMinter.mint(1, 2n ** 128n, { from: user }),
                "VMU::mint: Insufficient Trade Output"
            );
        });

        it("should mint", async () => {
            const snapshot = async () => {
                return {
                    cycleMints: await vaderMinter.cycleMints(),
                };
            };

            const vPrice = await lbt._getVaderUsdPrice_();
            const uAmount = vPrice.mul(V_AMOUNT).div(big(10).pow(big(18)));

            const _before = await snapshot();
            await vaderMinter.mint(V_AMOUNT, 1, { from: user });
            const _after = await snapshot();

            assertBn(_after.cycleMints, _before.cycleMints.add(uAmount));
        });
    });

    describe("burn", () => {
        it("should reject if total USDV burn > limit", async () => {
            await assertErrors(
                vaderMinter.burn(2n ** 128n, 1, { from: user }),
                "VMU::burn: 24 Hour Limit Reached"
            );
        });

        it("should reject if USDV amount < min", async () => {
            await assertErrors(
                vaderMinter.burn(1, 2n ** 128n, { from: user }),
                "VMU::burn: Insufficient Trade Output"
            );
        });

        it("should burn", async () => {
            const snapshot = async () => {
                return {
                    cycleBurns: await vaderMinter.cycleBurns(),
                };
            };

            const vPrice = await lbt._getVaderUsdPrice_();
            const uAmount = await usdv.balanceOf(user);
            const vAmount = uAmount.mul(big(10).pow(big(18))).div(vPrice);

            const _before = await snapshot();
            await vaderMinter.burn(uAmount, 1, { from: user });
            const _after = await snapshot();

            assertBn(_after.cycleBurns, _before.cycleBurns.add(uAmount));
        });
    });

    describe("partnerMint", () => {
        it("should reject if not partner", async () => {
            await assertErrors(
                vaderMinter.partnerMint(1, 1, { from: user }),
                "VMU::partnerMint: Not Whitelisted"
            );
        });

        it("should reject if total USDV mint > limit", async () => {
            await assertErrors(
                vaderMinter.partnerMint(2n ** 128n, 1, { from: partner }),
                "VMU::partnerMint: Mint Limit Reached"
            );
        });

        it("should reject if USDV amount < min", async () => {
            await assertErrors(
                vaderMinter.partnerMint(1, 2n ** 128n, { from: partner }),
                "VMU::partnerMint: Insufficient Trade Output"
            );
        });

        it("should partnerMint", async () => {
            const snapshot = async () => {
                const { mintLimit } = await vaderMinter.partnerLimits(partner);
                return {
                    mintLimit,
                };
            };

            const vPrice = await lbt._getVaderUsdPrice_();
            const uAmount = vPrice.mul(V_AMOUNT).div(big(10).pow(big(18)));

            const _before = await snapshot();
            await vaderMinter.partnerMint(V_AMOUNT, 1, { from: partner });
            const _after = await snapshot();

            assertBn(_after.mintLimit, _before.mintLimit.sub(uAmount));
        });
    });

    describe("partnerBurn", () => {
        it("should reject if not partner", async () => {
            await assertErrors(
                vaderMinter.partnerBurn(1, 1, { from: user }),
                "VMU::partnerBurn: Not Whitelisted"
            );
        });

        it("should reject if total USDV burn > limit", async () => {
            await assertErrors(
                vaderMinter.partnerBurn(2n ** 128n, 1, { from: partner }),
                "VMU::partnerBurn: Burn Limit Reached"
            );
        });

        it("should reject if USDV amount < min", async () => {
            await assertErrors(
                vaderMinter.partnerBurn(1, 2n ** 128n, { from: partner }),
                "VMU::partnerBurn: Insufficient Trade Output"
            );
        });

        it("should partnerBurn", async () => {
            const snapshot = async () => {
                const { burnLimit } = await vaderMinter.partnerLimits(partner);
                return {
                    burnLimit,
                };
            };

            const vPrice = await lbt._getVaderUsdPrice_();
            const uAmount = await usdv.balanceOf(partner);
            const vAmount = uAmount.mul(big(10).pow(big(18))).div(vPrice);

            const _before = await snapshot();
            await vaderMinter.partnerBurn(uAmount, 1, { from: partner });
            const _after = await snapshot();

            assertBn(_after.burnLimit, _before.burnLimit.sub(vAmount));
        });
    });
});
