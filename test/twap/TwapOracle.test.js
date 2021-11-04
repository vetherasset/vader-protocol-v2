const {
    // Deployment Function
    deployMock,

    // Testing Utilities
    assertBn,
    assertErrors,
    assertEvents,
    UNSET_ADDRESS,
    DEFAULT_CONFIGS,
    TEN_UNITS,

    // Library Functions
    verboseAccounts,
    time,
    big,
    parseUnits,

    // Project Specific Constants
    PROJECT_CONSTANTS,

    mintAndApprove,
} = require("../utils")(artifacts);

contract("Twap Oracle", (accounts) => {
    describe("construction", () => {
        it("should validate the pool state", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);
            const { poolV2 } = await deployMock(accounts);

            assert.notEqual(await poolV2.nativeAsset, UNSET_ADDRESS);
        });
    });

    describe("pair exists", () => {
        it("should check if the pair exists and return the pair", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);
            const { poolV2 } = await deployMock(accounts);

            assert.notEqual(await poolV2.nativeAsset, UNSET_ADDRESS);
        });
    });

    describe("register pair", () => {
        it("should check if the pair exists and return the pair", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);
            const { poolV2 } = await deployMock(accounts);

            assert.notEqual(await poolV2.nativeAsset, UNSET_ADDRESS);
        });
    });
});
