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

contract("Base Pool V2", (accounts) => {
    describe("construction", () => {
        it("should validate the pool state", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);
            const { poolV2 } = await deployMock(accounts);

            assert.notEqual(await poolV2.nativeAsset, UNSET_ADDRESS);
        });
    });

    describe("should fail when called by non router address", () => {
        it("BasePoolV2::mint", async () => {
            const { poolV2 } = await deployMock();
            const mockAddress = accounts.account5;

            await assertErrors(
                poolV2.mint(
                    mockAddress,
                    0,
                    0,
                    mockAddress,
                    mockAddress
                ),
                "BasePoolV2::_onlyRouter: Only Router is allowed to call"
            )
        });

        it("BasePoolV2::doubleSwap", async () => {
            const { poolV2 } = await deployMock();
            const mockAddress = accounts.account5;

            await assertErrors(
                poolV2.doubleSwap(
                    mockAddress,
                    mockAddress,
                    0,
                    mockAddress
                ),
                "BasePoolV2::_onlyRouter: Only Router is allowed to call"
            )
        });

        it("BasePoolV2::swap", async () => {
            const { poolV2 } = await deployMock();
            const mockAddress = accounts.account5;

            await assertErrors(
                poolV2.swap(
                    mockAddress,
                    0,
                    0,
                    mockAddress
                ),
                "BasePoolV2::_onlyRouter: Only Router is allowed to call"
            )
        });
    });
});
