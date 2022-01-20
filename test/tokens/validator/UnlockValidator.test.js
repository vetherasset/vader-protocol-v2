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

contract("UnlockValidator", (accounts) => {
    before(async () => {
        accounts = await verboseAccounts(accounts);
    });

    describe("constructor", () => {
        it("should deploy", async () => {
            const { validator } = await deployMock(accounts);
            assert.equal(await validator.owner(), accounts.administrator);
        });
    });

    describe("invalidate", () => {
        it("should disallow if not owner", async () => {
            const { validator } = await deployMock();

            await assertErrors(
                validator.invalidate(accounts.account0, {
                    from: accounts.account0,
                }),
                "Ownable: caller is not the owner"
            );
        });

        it("should allow owner to call", async () => {
            const { validator, ADMINISTRATOR } = await deployMock();

            assertEvents(
                await validator.invalidate(accounts.account0, ADMINISTRATOR),
                {
                    Invalidate: {
                        account: accounts.account0,
                    },
                }
            );

            assert.equal(
                await validator.isValid(accounts.account0, 0, 0),
                false
            );
        });

        it("should disallow if already invalidated", async () => {
            const { validator, ADMINISTRATOR } = await deployMock();

            await assertErrors(
                validator.invalidate(accounts.account0, ADMINISTRATOR),
                "UnlockValidator::invalidate: Already Invalid"
            );
        });
    });

    describe("validate", () => {
        it("should disallow if not owner", async () => {
            const { validator } = await deployMock();

            await assertErrors(
                validator.validate(accounts.account0, {
                    from: accounts.account0,
                }),
                "Ownable: caller is not the owner"
            );
        });

        it("should allow owner to call", async () => {
            const { validator, ADMINISTRATOR } = await deployMock();

            assertEvents(
                await validator.validate(accounts.account0, ADMINISTRATOR),
                {
                    Validate: {
                        account: accounts.account0,
                    },
                }
            );

            assert.equal(
                await validator.isValid(accounts.account0, 0, 0),
                true
            );
        });

        it("should disallow if already validated", async () => {
            const { validator, ADMINISTRATOR } = await deployMock();

            await assertErrors(
                validator.validate(accounts.account0, ADMINISTRATOR),
                "UnlockValidator::validate: Already Valid"
            );
        });
    });
});
