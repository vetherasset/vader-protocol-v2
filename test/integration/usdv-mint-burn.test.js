const {
    // Deployment Function
    deployMock,

    // Testing Utilities
    assertBn,

    // Library Functions
    verboseAccounts,
    time,
    big,
} = require("../utils")(artifacts);

const MAX_FEE = big(10000);
const ONE_VADER = big(10).pow(big(18));

// Vader amount minted to users
const V_AMOUNT = big(100).mul(ONE_VADER);

// Daily limits
const FEE = big(200);
const MINT_LIMIT = 200n * 10n ** 18n;
const BURN_LIMIT = 100n * 10n ** 18n;
const LOCK_DURATION = 10;
// Partner limits
const PARTNER_FEE = big(100);
const PARTNER_MINT_LIMIT = 300n * 10n ** 18n;
const PARTNER_BURN_LIMIT = 200n * 10n ** 18n;
const PARTNER_LOCK_DURATION = 0;

contract("VADER + USDV + VaderMinter", (accounts) => {
    let vader;
    let usdv;
    let minter;
    let validator;
    let lbt;
    let admin;
    let user;
    let partner;
    before(async () => {
        accounts = await verboseAccounts(accounts);
        const cache = await deployMock(accounts);

        vader = cache.vader;
        usdv = cache.usdv;
        minter = cache.vaderMinter;
        validator = cache.validator;
        lbt = cache.mockLbt;
        admin = accounts.administrator;
        user = accounts.account0;
        partner = accounts.account1;

        // Vader setup //
        const converter = cache.mock;
        const vesting = cache.mock;
        await vader.setComponents(converter.address, vesting.address, [], [], {
            from: admin,
        });

        // transfer Vader to users
        await vader.createEmission(user, V_AMOUNT, { from: admin });
        await vader.createEmission(partner, V_AMOUNT, { from: admin });

        // Minter setup
        await minter.initialize({ from: admin });
        await minter.setDailyLimits(
            FEE,
            MINT_LIMIT,
            BURN_LIMIT,
            LOCK_DURATION,
            { from: admin }
        );
        await minter.whitelistPartner(
            partner,
            PARTNER_FEE,
            PARTNER_MINT_LIMIT,
            PARTNER_BURN_LIMIT,
            PARTNER_LOCK_DURATION,
            { from: admin }
        );
        await minter.setLBT(lbt.address, { from: admin });

        // USDV setup
        await usdv.setValidator(validator.address, { from: admin });
        await usdv.setMinter(minter.address, { from: admin });

        // Vader final setup
        await vader.setUSDV(usdv.address, { from: admin });
    });

    const snapshot = async () => {
        return {
            vader: {
                user: await vader.balanceOf(user),
                partner: await vader.balanceOf(partner),
                usdv: await vader.balanceOf(usdv.address),
            },
            usdv: {
                user: await usdv.balanceOf(user),
                partner: await usdv.balanceOf(partner),
                usdv: await usdv.balanceOf(usdv.address),
            },
        };
    };

    function calcFee(amount, fee) {
        return amount.mul(fee).div(MAX_FEE);
    }

    describe("user", () => {
        it("should mint USDV", async () => {
            await vader.approve(usdv.address, V_AMOUNT, { from: user });

            const _before = await snapshot();
            await minter.mint(V_AMOUNT, 1, { from: user });
            const _after = await snapshot();

            const vPrice = await lbt._getVaderUsdPrice_();
            let uAmount = vPrice.mul(V_AMOUNT).div(ONE_VADER);
            const fee = calcFee(uAmount, await minter.getPublicFee());
            uAmount = uAmount.sub(fee);

            assertBn(_after.vader.user, _before.vader.user.sub(V_AMOUNT));

            // USDV is locked
            if (LOCK_DURATION > 0) {
                assertBn(_after.usdv.user, _before.usdv.user);
                assertBn(_after.usdv.usdv, _before.usdv.usdv.add(uAmount));
            } else {
                assertBn(_after.usdv.user, _before.usdv.user.add(uAmount));
                assertBn(_after.usdv.usdv, _before.usdv.usdv);
            }
        });

        it("should burn USDV", async () => {
            if (LOCK_DURATION > 0) {
                await time.increase(LOCK_DURATION);
                await usdv.claim(0, { from: user });
            }

            const uAmount = await usdv.balanceOf(user);

            const _before = await snapshot();
            await minter.burn(uAmount, 1, { from: user });
            const _after = await snapshot();

            const vPrice = await lbt._getVaderUsdPrice_();
            let vAmount = uAmount.mul(ONE_VADER).div(vPrice);
            const fee = calcFee(vAmount, await minter.getPublicFee());
            vAmount = vAmount.sub(fee);

            assertBn(_after.usdv.user, _before.usdv.user.sub(uAmount));

            // Vader is locked
            if (LOCK_DURATION > 0) {
                assertBn(_after.vader.user, _before.vader.user);
                assertBn(_after.vader.usdv, _before.vader.usdv.add(vAmount));
            } else {
                assertBn(_after.vader.user, _before.vader.user.add(vAmount));
                assertBn(_after.vader.usdv, _before.vader.usdv);
            }
        });
    });

    describe("partner", () => {
        it("should mint USDV", async () => {
            await vader.approve(usdv.address, V_AMOUNT, { from: partner });

            const _before = await snapshot();
            await minter.partnerMint(V_AMOUNT, 1, { from: partner });
            const _after = await snapshot();

            const vPrice = await lbt._getVaderUsdPrice_();
            let uAmount = vPrice.mul(V_AMOUNT).div(ONE_VADER);
            const fee = calcFee(uAmount, PARTNER_FEE);
            uAmount = uAmount.sub(fee);

            assertBn(_after.vader.partner, _before.vader.partner.sub(V_AMOUNT));

            // USDV is locked
            if (PARTNER_LOCK_DURATION > 0) {
                assertBn(_after.usdv.partner, _before.usdv.partner);
                assertBn(_after.usdv.usdv, _before.usdv.usdv.add(uAmount));
            } else {
                assertBn(
                    _after.usdv.partner,
                    _before.usdv.partner.add(uAmount)
                );
                assertBn(_after.usdv.usdv, _before.usdv.usdv);
            }
        });

        it("should burn USDV", async () => {
            if (PARTNER_LOCK_DURATION > 0) {
                await time.increase(PARTNER_LOCK_DURATION);
                await usdv.claim(0, { from: partner });
            }

            const uAmount = await usdv.balanceOf(partner);

            const _before = await snapshot();
            await minter.partnerBurn(uAmount, 1, { from: partner });
            const _after = await snapshot();

            const vPrice = await lbt._getVaderUsdPrice_();
            let vAmount = uAmount.mul(ONE_VADER).div(vPrice);
            const fee = calcFee(vAmount, PARTNER_FEE);
            vAmount = vAmount.sub(fee);

            assertBn(_after.usdv.partner, _before.usdv.partner.sub(uAmount));

            // Vader is locked
            if (PARTNER_LOCK_DURATION > 0) {
                assertBn(_after.vader.partner, _before.vader.partner);
                assertBn(_after.vader.usdv, _before.vader.usdv.add(vAmount));
            } else {
                assertBn(
                    _after.vader.partner,
                    _before.vader.partner.add(vAmount)
                );
                assertBn(_after.vader.usdv, _before.vader.usdv);
            }
        });
    });
});
