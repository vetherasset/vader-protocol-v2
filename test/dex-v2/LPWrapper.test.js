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

contract("LPWrapper", (accounts) => {
    describe("construction", () => {
        it("should now allow construction with bad arguments", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);

            await assertErrors(
                deployMock(accounts, {
                    LPWrapper: () => [UNSET_ADDRESS],
                }),
                "LPWrapper::constructor: Misconfiguration"
            );
        });
    });

    describe("create wrapper", () => {
        it("should now allow to create wrappers from a non owner account", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);

            const { lpWrapper, dai, poolV2, synthFactory, routerV2 } = await deployMock(
                accounts
            );

            await poolV2.initialize(lpWrapper.address, synthFactory.address, routerV2.address);

            await assertErrors(
                lpWrapper.createWrapper(await dai.address),
                "Ownable: caller is not the owner"
            );
        });

        it("should now allow to create wrappers that are already created", async () => {
            const { poolV2, dai, mockUsdv, routerV2 } = await deployMock();

            const amount = parseUnits(100, 18);
            const balance = parseUnits(10000000, 18);

            // Set support for the tokens
            await poolV2.setTokenSupport(dai.address, true);
            await poolV2.setTokenSupport(mockUsdv.address, true);

            // Construct the deadline
            const latestBlock = await web3.eth.getBlock("latest");
            const deadline = latestBlock.timestamp + 1000;

            mintAndApprove(accounts.account0, routerV2.address, dai, balance);
            mintAndApprove(
                accounts.account0,
                routerV2.address,
                mockUsdv,
                balance
            );

            await mockUsdv.approve(poolV2.address, balance);
            await dai.approve(poolV2.address, balance);

            const liquidity = parseUnits(10000, 18);

            // Add liquidity
            await routerV2.addLiquidity(
                mockUsdv.address,
                dai.address,
                liquidity,
                liquidity,
                accounts.account0,
                deadline
            );

            // Mint dai synth
            await poolV2.mintSynth(
                dai.address,
                amount,
                accounts.account0,
                accounts.account0
            );

            await poolV2.setFungibleTokenSupport(dai.address);

            await assertErrors(
                poolV2.setFungibleTokenSupport(dai.address),
                "LPWrapper::createWrapper: Already Created"
            );
        });
    });
});
