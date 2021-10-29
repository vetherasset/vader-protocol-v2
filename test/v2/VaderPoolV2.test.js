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
} = require("../utils")(artifacts);


contract("VaderPool V2", (accounts) =>  {
    describe("construction", () => {
        it("should construct the singleton pool and check the state", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);
            const { poolV2, mockUsdv } = await deployMock(accounts);

            assert.equal(await poolV2.queueActive(), true);
            assert.equal(await poolV2.nativeAsset(), await mockUsdv.address);
        });
    });

    describe("set support token", () => {
        it("should not allow to add support for a asset if already supported", async () => {
            const { poolV2, dai } = await deployMock();
            
            // Set the token
            await poolV2.setTokenSupport(dai.address, true);
            // Try to set it again
            await assertErrors(poolV2.setTokenSupport(dai.address, true), 
            "VaderPoolV2::supportToken: Already At Desired State");
        });
    });

    describe("toggleQueue", () => {
        it("should now allow to toggle queue from an non owner account", async () => {
            const { poolV2 } = await deployMock();

            await assertErrors(poolV2.toggleQueue({ from: accounts.account1 }), 
            "Ownable: caller is not the owner");
        });
    });
});