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

    mintAndApprove
} = require("../utils")(artifacts);

contract("Base Pool V2", (accounts) => {
    describe("construction", () => {
        it("should validate the pool state", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);
            const { poolV2 } = await deployMock(accounts);

            assert.notEqual(await poolV2.nativeAsset, UNSET_ADDRESS);
        });
    });
});