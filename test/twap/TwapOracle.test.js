const { advanceBlock } = require("@openzeppelin/test-helpers/src/time");

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
    MockAggregatorV3,
    UniswapV2Pair,
} = require("../utils")(artifacts);

contract.only("Twap Oracle", (accounts) => {
    describe("construction", () => {
        it("should construct the twap", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);
            const { twap, mockUsdv, vader } = await deployMock(accounts);

            // Owner should be set
            assert.notEqual(await twap.owner(), UNSET_ADDRESS);

            // VADER and USDV still unset
            assert.equal(await twap.VADER(), UNSET_ADDRESS);
            assert.equal(await twap.USDV(), UNSET_ADDRESS);

            await twap.initialize(mockUsdv.address, vader.address);

            // VADER and USDV now set
            assert.equal(await twap.VADER(), vader.address);
            assert.equal(await twap.USDV(), mockUsdv.address);
        });
    });

    describe("pair exists", () => {
        it("should check if the pair exists and return the pair", async () => {
            const { twap, mockUsdv, dai } = await deployMock();

            assert.notEqual(
                await twap.pairExists(
                    await mockUsdv.address,
                    await dai.address
                ),
                true
            );
        });
    });

    describe("register aggregator", () => {
        it("should not allow to register with bad arguments", async () => {
            const { twap, mockUsdv } = await deployMock();

            await assertErrors(
                twap.registerAggregator(UNSET_ADDRESS, UNSET_ADDRESS),
                "TwapOracle::registerAggregator: asset zero address provided"
            );

            await assertErrors(
                twap.registerAggregator(mockUsdv.address, UNSET_ADDRESS),
                "TwapOracle::registerAggregator: aggregator zero address provided"
            );
        });

        it("should not allow to register when already exists", async () => {
            const { twap, mockUsdv } = await deployMock();

            const USDVAggregator = await MockAggregatorV3.new(mockUsdv.address, parseUnits(1, 8));

            await twap.registerAggregator(
                mockUsdv.address,
                USDVAggregator.address
            );

            await assertErrors(
                twap.registerAggregator(
                    mockUsdv.address,
                    USDVAggregator.address
                ),
                "TwapOracle::registerAggregator: aggregator already exists"
            );
        });
    });

    describe("consult", () => {
        it("should consult for vader", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);
            const {
                twap,
                dai,
                mockUsdv,
                poolV2,
                routerV2,
                token,
                mockUniswapV2Factory,
                lpWrapper,
                synthFactory,
                mockUniswapV2Router,
            } = await deployMock(accounts);

            await poolV2.initialize(
                lpWrapper.address,
                synthFactory.address,
                routerV2.address
            );

            // Set the supported tokens
            await poolV2.setTokenSupport(dai.address, true);
            await poolV2.setTokenSupport(mockUsdv.address, true);

            // Initialize the twap
            await twap.initialize(mockUsdv.address, token.address);

            await twap.enableUSDV();

            // Construct the deadline
            const latestBlock = await web3.eth.getBlock("latest");
            const deadline = latestBlock.timestamp + 1000;

            // Amount to mint approve
            const accountsAmount = parseUnits(1000000, 18);

            // ====== Set up Vader pool with USDV <-> DAI pair and add liquidity. ======

            // Mint and approve all tokens for the router
            await mintAndApprove(
                accounts.account0,
                poolV2.address,
                dai,
                accountsAmount
            );
            await mintAndApprove(
                accounts.account0,
                poolV2.address,
                mockUsdv,
                accountsAmount
            );

            const liquidity = parseUnits(1000, 18);

            // Add liquidity
            await routerV2.addLiquidity(
                mockUsdv.address,
                dai.address,
                liquidity,
                liquidity,
                accounts.account0,
                deadline
            );

            // Register the pair
            await twap.registerPair(
                UNSET_ADDRESS,
                mockUsdv.address,
                dai.address
            );

            // Mint and approve all tokens for the router
            await mintAndApprove(
                accounts.account0,
                poolV2.address,
                dai,
                accountsAmount
            );
            await mintAndApprove(
                accounts.account0,
                poolV2.address,
                mockUsdv,
                accountsAmount
            );
            // Add liquidity
            await routerV2.addLiquidity(
                mockUsdv.address,
                dai.address,
                liquidity,
                liquidity,
                accounts.account0,
                deadline
            );

            // ========================

            // ====== Setup Uniswap pool Vader <-> USDV and add liquidity ======
            await mockUniswapV2Factory.createPair(token.address, mockUsdv.address);

            const uniswapPairAddress = await mockUniswapV2Factory.getPair(
                token.address,
                mockUsdv.address
            );
            const uniswapPair = await UniswapV2Pair.at(uniswapPairAddress);

            await mintAndApprove(
                accounts.account0,
                uniswapPair.address,
                token,
                liquidity
            );

            await mintAndApprove(
                accounts.account0,
                uniswapPair.address,
                mockUsdv,
                liquidity
            );

            await token.transfer(uniswapPair.address, liquidity);
            await mockUsdv.transfer(uniswapPair.address, liquidity);

            await uniswapPair.mint(accounts.account0);

            // Register the pair
            await twap.registerPair(
                mockUniswapV2Factory.address,
                token.address,
                mockUsdv.address
            );

            // Note: Was facing error in swapping so opted to deposit liquidity to update price.
            await mintAndApprove(
                accounts.account0,
                uniswapPair.address,
                token,
                liquidity
            );
            await mintAndApprove(
                accounts.account0,
                uniswapPair.address,
                mockUsdv,
                liquidity
            );
            await token.transfer(uniswapPair.address, liquidity);
            await mockUsdv.transfer(uniswapPair.address, liquidity);

            await uniswapPair.mint(accounts.account0);

            // ========================

            // Setup aggregators where mock prices where 1 USDV = $1 and 1 Vader = $2
            const usdvAggregator = await MockAggregatorV3.new(
                mockUsdv.address, parseUnits(1, 8)
            );
            const vaderAggregator = await MockAggregatorV3.new(
                token.address, parseUnits(2, 8)
            );

            // Register the mock aggregators
            await twap.registerAggregator(
                dai.address,
                usdvAggregator.address
            );
            await twap.registerAggregator(
                mockUsdv.address,
                vaderAggregator.address
            );

            await advanceBlock();

            // Update needs to be called at least one time
            await twap.update();

            // expectedRate is Vader against 1 USDV
            const expectedRate = (await usdvAggregator.mockPrice())
                .mul(big(10).pow(big(18)))
                .div((await vaderAggregator.mockPrice()));

            const sourceAmount = parseUnits(10, 18);
            const expectedUSDVFromVader = sourceAmount
                .mul(big(10).pow(big(18)))
                .div(expectedRate);

            const expectedVaderFromUSDV = sourceAmount
                .mul(expectedRate)
                .div(big(10).pow(big(18)));

            assertBn((await twap.getRate()), expectedRate);
            assertBn((await twap.usdvtoVader(sourceAmount)), expectedVaderFromUSDV);
            assertBn((await twap.vaderToUsdv(sourceAmount)), expectedUSDVFromVader);
        });
    });

    describe("register pair", () => {
        it("should not allow to register pair with a non owner account", async () => {
            const { twap, dai, mockUsdv } = await deployMock();

            await assertErrors(
                twap.registerPair(
                    UNSET_ADDRESS,
                    dai.address,
                    mockUsdv.address,
                    {
                        from: accounts.account1,
                    }
                ),
                "Ownable: caller is not the owner"
            );
        });

        it("should not allow to register pair with a invalid token A", async () => {
            const { twap, dai, mockUsdv } = await deployMock();

            await assertErrors(
                twap.registerPair(UNSET_ADDRESS, dai.address, mockUsdv.address),
                "TwapOracle::registerPair: Invalid token0 address"
            );
        });

        it("should not allow to register pair with a same token A and B", async () => {
            const { twap, mockUsdv } = await deployMock();

            await assertErrors(
                twap.registerPair(
                    UNSET_ADDRESS,
                    mockUsdv.address,
                    mockUsdv.address
                ),
                "TwapOracle::registerPair: Same token address"
            );
        });

        it("should not allow to register pair if pair already exists", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);
            const { twap, dai, mockUsdv, vader, factory, poolV2, routerV2 } =
                await deployMock(accounts);

            const mockAccount = accounts.account5;
            await poolV2.initialize(mockAccount, mockAccount, routerV2.address);

            // Set the supported tokens
            await poolV2.setTokenSupport(dai.address, true);
            await poolV2.setTokenSupport(mockUsdv.address, true);

            // Construct the deadline
            const latestBlock = await web3.eth.getBlock("latest");
            const deadline = latestBlock.timestamp + 1000;

            // Amount to mint approve
            const accountsAmount = parseUnits(1000000, 18);

            // Mint and approve all tokens for the router
            mintAndApprove(
                accounts.account0,
                routerV2.address,
                dai,
                accountsAmount
            );
            mintAndApprove(
                accounts.account0,
                routerV2.address,
                mockUsdv,
                accountsAmount
            );

            // Approve the pool also
            await mockUsdv.approve(poolV2.address, accountsAmount);
            await dai.approve(poolV2.address, accountsAmount);

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

            const amountIn = parseUnits(1000, 18);

            // We dont care about output here
            const amountOutMin = parseUnits(10, 18);

            // Swap Dai
            await routerV2.swapExactTokensForTokens(
                amountIn,
                amountOutMin,
                [mockUsdv.address, dai.address],
                accounts.account2,
                deadline
            );

            await twap.initialize(mockUsdv.address, vader.address);
            await twap.registerPair(
                factory.address,
                mockUsdv.address,
                dai.address
            );

            await assertErrors(
                twap.registerPair(UNSET_ADDRESS, mockUsdv.address, dai.address),
                "TwapOracle::registerPair: Pair exists"
            );
        });

        it("should not allow to register pair if no reserves", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);
            const { twap, dai, mockUsdv, vader } = await deployMock(accounts);

            await twap.initialize(mockUsdv.address, vader.address);

            await assertErrors(
                twap.registerPair(UNSET_ADDRESS, mockUsdv.address, dai.address),
                "TwapOracle::registerPair: No reserves"
            );
        });
    });

    describe("update", () => {
        it("should not allow to update from a non owner account", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);
            const { twap } = await deployMock(accounts);

            await assertErrors(
                twap.update({ from: accounts.account1 }),
                "Ownable: caller is not the owner"
            );
        });
    });
});