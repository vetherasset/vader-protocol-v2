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

    // Project Specific Constants
    PROJECT_CONSTANTS,
} = require("../utils")(artifacts);


contract("VaderRouter V2", (accounts) =>  {
    describe("construction", () => {
        it("should not allow construction with incorrect arguments", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);

            await assertErrors(
                deployMock(accounts, {
                    VaderRouterV2: () => [UNSET_ADDRESS],
                }),
                "VaderRouterV2::constructor: Incorrect Arguments"
            );
        });

    });

    describe("add liquidity", () => {
        it("should not allow to add liquidity with unsupported assets", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);
            const { routerV2, dai, mockUsdv } = await deployMock(accounts);
            const latestBlock = await web3.eth.getBlock("latest");
            const timestampNow = latestBlock.timestamp + 1000;
            await assertErrors(routerV2.addLiquidity(mockUsdv.address, UNSET_ADDRESS, 100, 100, accounts.account0, timestampNow), 
            "VaderRouterV2::addLiquidity: Unsupported Assets Specified");
            await assertErrors(routerV2.addLiquidity(dai.address, UNSET_ADDRESS, 100, 100, accounts.account0, timestampNow), 
            "VaderRouterV2::addLiquidity: Unsupported Assets Specified");
        });
    });

    describe("initialize", () => {
        it("should not allow to initialize with zero address", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);
            const { routerV2 } = await deployMock(accounts);
            await assertErrors(routerV2.initialize(UNSET_ADDRESS), 
            "VaderRouterV2::initialize: Incorrect Reserve Specified");
        });
        
        it("should initialize and check if the ownership is renounced", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);
            const { routerV2, reserve } = await deployMock(accounts);
            await routerV2.initialize(reserve.address);
            assert.equal(await routerV2.owner(), UNSET_ADDRESS);
        });
    });

    describe("ensure", () => {
        it("should not allow to add liquidity with a deadline that is not in the future", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);
            const { routerV2, mockUsdv, dai } = await deployMock(accounts);
            
            await assertErrors(routerV2.addLiquidity(mockUsdv.address, dai.address, 100, 100, accounts.account0, 1000), 
            "VaderRouterV2::ensure: Expired");
        });
    });
});