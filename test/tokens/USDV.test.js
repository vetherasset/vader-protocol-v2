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
} = require("../utils")(artifacts);

const MAX_LOCK_DURATION = 30 * 24 * 3600;

// USDV mint / burn params
const vAmount = 20n * 10n * 18n;
const uAmount = 10n * 10n * 18n;
const exchangeFee = 100n;
const window = 10;
// Fee to mint USDV
const uFee = (uAmount * exchangeFee) / 10000n;
// USDV balance of user after mint
const uBal = uAmount - uFee;
// Fee to mint Vader
const vFee = (vAmount * exchangeFee) / 10000n;

contract("USDV", (accounts) => {
    let usdv;
    let vader;
    let validator;
    let admin;
    let minter;
    before(async () => {
        accounts = await verboseAccounts(accounts);
        const cache = await deployMock(accounts, {
            USDV: (_, { mockVader, ADMINISTRATOR }) => [
                mockVader.address,
                ADMINISTRATOR,
            ],
        });

        usdv = cache.usdv;
        vader = cache.mockVader;
        validator = cache.validator;
        admin = cache.ADMINISTRATOR;
        // minter is set to admin for this test
        minter = admin;
    });

    describe("constructor", () => {
        it("should deploy", async () => {
            assert.equal(await usdv.vader(), vader.address);
        });
    });

    describe("setValidator", () => {
        it("should disallow if not owner", async () => {
            await assertErrors(
                usdv.setValidator(validator.address, {
                    from: accounts.account0,
                }),
                "Ownable: caller is not the owner"
            );
        });

        it("should disallow zero address", async () => {
            await assertErrors(
                usdv.setValidator(UNSET_ADDRESS, admin),
                "USDV::setValidator: Improper Configuration"
            );
        });

        it("should allow owner to call", async () => {
            assertEvents(await usdv.setValidator(validator.address, admin), {
                ValidatorSet: {
                    previous: UNSET_ADDRESS,
                    current: validator.address,
                },
            });

            assert.equal(await usdv.validator(), validator.address);
        });
    });

    describe("setGuardian", () => {
        it("should disallow if not owner", async () => {
            await assertErrors(
                usdv.setGuardian(accounts.account0, {
                    from: accounts.account0,
                }),
                "Ownable: caller is not the owner"
            );
        });

        it("should disallow zero address", async () => {
            await assertErrors(
                usdv.setGuardian(UNSET_ADDRESS, admin),
                "USDV::setGuardian: Zero Address"
            );
        });

        it("should allow owner to call", async () => {
            assertEvents(
                await usdv.setGuardian(accounts.administrator, admin),
                {
                    GuardianSet: {
                        previous: UNSET_ADDRESS,
                        current: accounts.administrator,
                    },
                }
            );

            assert.equal(await usdv.guardian(), accounts.administrator);
        });
    });

    describe("setLock", () => {
        it("should disallow if not authorized", async () => {
            await assertErrors(
                usdv.setLock(true, {
                    from: accounts.account0,
                }),
                "USDV::setLock: Insufficient Privileges"
            );
        });

        it("should allow owner to call", async () => {
            assertEvents(await usdv.setLock(true, admin), {
                LockStatusSet: {
                    status: true,
                },
            });

            assert.equal(await usdv.isLocked(), true);
        });

        it("should allow guardian to call", async () => {
            await usdv.setGuardian(accounts.account0, admin);
            await usdv.setLock(false, { from: accounts.account0 });

            assert.equal(await usdv.isLocked(), false);
        });
    });

    describe("setMinter", () => {
        it("should disallow if not owner", async () => {
            await assertErrors(
                usdv.setMinter(accounts.administrator, {
                    from: accounts.account0,
                }),
                "Ownable: caller is not the owner"
            );
        });

        it("should disallow zero address", async () => {
            await assertErrors(
                usdv.setMinter(UNSET_ADDRESS, admin),
                "USDV::setMinter: Zero address"
            );
        });

        it("should allow owner to call", async () => {
            assertEvents(await usdv.setMinter(accounts.administrator, admin), {
                MinterSet: {
                    minter: accounts.administrator,
                },
            });

            assert.equal(await usdv.minter(), accounts.administrator);
        });
    });

    describe("mint", () => {
        let user;
        before(async () => {
            user = accounts.account0;
            await vader.mint(user, vAmount);
            await vader.approve(usdv.address, vAmount, { from: user });
        });

        it("should not mint if locked", async () => {
            await usdv.setLock(true, admin);

            await assertErrors(
                usdv.mint(user, vAmount, uAmount, exchangeFee, window, minter),
                "USDV::onlyWhenNotLocked: System is Locked"
            );

            await usdv.setLock(false, admin);
        });

        it("should not mint if not minter", async () => {
            await assertErrors(
                usdv.mint(user, vAmount, uAmount, exchangeFee, window, {
                    from: user,
                }),
                "USDV::onlyMinter: Insufficient Privileges"
            );
        });

        it("should not mint if Vader amount = 0", async () => {
            await assertErrors(
                usdv.mint(user, 0, uAmount, exchangeFee, window, minter),
                "USDV::mint: Zero Input / Output"
            );
        });

        it("should not mint if USDV amount = 0", async () => {
            await assertErrors(
                usdv.mint(user, vAmount, 0, exchangeFee, window, minter),
                "USDV::mint: Zero Input / Output"
            );
        });

        it("should not mint if window > max", async () => {
            await assertErrors(
                usdv.mint(
                    user,
                    vAmount,
                    uAmount,
                    exchangeFee,
                    MAX_LOCK_DURATION + 1,
                    minter
                ),
                "USDV::mint: Window > max lock duration"
            );
        });

        it("should mint", async () => {
            await usdv.mint(
                user,
                vAmount,
                uAmount,
                exchangeFee,
                window,
                minter
            );

            const lock = await usdv.locks(user, 0);
            assert.equal(lock.token, 0);
            assert.equal(lock.amount, uAmount - uFee);
        });
    });

    describe("claim", () => {
        let user;
        let lock;
        before(async () => {
            user = accounts.account0;
            lock = await usdv.locks(user, 0);
        });

        it("should reject if locked", async () => {
            await usdv.setLock(true, admin);

            await assertErrors(
                usdv.claim(0, { from: user }),
                "USDV::onlyWhenNotLocked: System is Locked"
            );

            await usdv.setLock(false, admin);
        });

        it("should reject if timestamp < release", async () => {
            await assertErrors(
                usdv.claim(0, { from: user }),
                "USDV::claim: Vesting"
            );
        });

        it("should reject if not valid", async () => {
            await time.increaseTo(lock.release);
            await validator.invalidate(user, admin);

            await assertErrors(
                usdv.claim(0, { from: user }),
                "USDV::claim: Prohibited Claim"
            );

            await validator.validate(user, admin);
        });

        it("should claim", async () => {
            assertEvents(await usdv.claim(0, { from: user }), {
                LockClaimed: {
                    user,
                    lockType: lock.token,
                    lockAmount: lock.amount,
                    lockRelease: lock.release,
                },
            });

            assert.equal(await usdv.getLockCount(user), 0);
        });
    });

    describe("burn", () => {
        let user;
        before(async () => {
            user = accounts.account0;
        });

        it("should not burn if locked", async () => {
            await usdv.setLock(true, admin);

            await assertErrors(
                usdv.burn(user, uBal, vAmount, exchangeFee, window, minter),
                "USDV::onlyWhenNotLocked: System is Locked"
            );

            await usdv.setLock(false, admin);
        });

        it("should not burn if not minter", async () => {
            await assertErrors(
                usdv.burn(user, uBal, vAmount, exchangeFee, window, {
                    from: user,
                }),
                "USDV::onlyMinter: Insufficient Privileges"
            );
        });

        it("should not burn if USDV amount = 0", async () => {
            await assertErrors(
                usdv.burn(user, 0, vAmount, exchangeFee, window, minter),
                "USDV::burn: Zero Input / Output"
            );
        });

        it("should not burn if Vader amount = 0", async () => {
            await assertErrors(
                usdv.burn(user, uBal, 0, exchangeFee, window, minter),
                "USDV::burn: Zero Input / Output"
            );
        });

        it("should not burn if window > max", async () => {
            await assertErrors(
                usdv.burn(
                    user,
                    uBal,
                    vAmount,
                    exchangeFee,
                    MAX_LOCK_DURATION + 1,
                    minter
                ),
                "USDV::burn: Window > max lock duration"
            );
        });

        it("should burn", async () => {
            await usdv.burn(user, uBal, vAmount, exchangeFee, window, minter);

            const lock = await usdv.locks(user, 0);
            assert.equal(lock.token, 1);
            assert.equal(lock.amount, vAmount - vFee);
        });
    });
});
