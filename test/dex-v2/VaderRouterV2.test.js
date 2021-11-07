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
    BasePoolV2,
    mintAndApprove,
} = require("../utils")(artifacts);

contract("VaderRouter V2", (accounts) => {
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

            // Construct the deadline
            const latestBlock = await web3.eth.getBlock("latest");
            const deadline = latestBlock.timestamp + 1000;

            await assertErrors(
                routerV2.addLiquidity(
                    mockUsdv.address,
                    UNSET_ADDRESS,
                    100,
                    100,
                    accounts.account0,
                    deadline
                ),
                "VaderRouterV2::addLiquidity: Unsupported Assets Specified"
            );
            await assertErrors(
                routerV2.addLiquidity(
                    dai.address,
                    UNSET_ADDRESS,
                    100,
                    100,
                    accounts.account0,
                    deadline
                ),
                "VaderRouterV2::addLiquidity: Unsupported Assets Specified"
            );
        });

        it("should check the functionality with tokens that deviate from 18 decimals as liquidity add/swap/remove and check the state", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);

            const {
                poolV2,
                erc20Dec8,
                erc20Dec12,
                routerV2,
                mockUsdv,
                reserve,
            } = await deployMock(accounts);

            await reserve.initialize(routerV2.address, accounts.dao);
            await routerV2.initialize(reserve.address);

            const mockAccount = accounts.account5;
            await poolV2.initialize(mockAccount, mockAccount, routerV2.address);

            // Set the supported tokens
            await poolV2.setTokenSupport(erc20Dec8.address, true);
            await poolV2.setTokenSupport(erc20Dec12.address, true);
            await poolV2.setTokenSupport(mockUsdv.address, true);

            // Construct the deadline
            const latestBlock = await web3.eth.getBlock("latest");
            const deadline = latestBlock.timestamp + 1000;

            // Amount to mint approve
            const accountsAmount8 = parseUnits(1000000, 8);
            const accountsAmount12 = parseUnits(1000000, 12);
            const accountsAmount18 = parseUnits(1000000, 18);

            // Mint and approve all tokens for the router
            mintAndApprove(
                accounts.account0,
                routerV2.address,
                erc20Dec8,
                accountsAmount8
            );

            mintAndApprove(
                accounts.account0,
                routerV2.address,
                erc20Dec12,
                accountsAmount12
            );

            mintAndApprove(
                accounts.account0,
                routerV2.address,
                mockUsdv,
                accountsAmount18
            );

            // Approve the pool also
            await erc20Dec8.approve(poolV2.address, accountsAmount8);
            await erc20Dec12.approve(poolV2.address, accountsAmount12);
            await mockUsdv.approve(poolV2.address, accountsAmount18);

            const liquidity8 = parseUnits(10000, 8);
            const liquidity12 = parseUnits(10000, 12);
            const liquidity18 = parseUnits(10000, 18);

            // Add liquidity 2 times on both tokens
            await routerV2.addLiquidity(
                mockUsdv.address,
                erc20Dec8.address,
                liquidity18,
                liquidity8,
                accounts.account0,
                deadline
            );

            await routerV2.addLiquidity(
                mockUsdv.address,
                erc20Dec12.address,
                liquidity18,
                liquidity12,
                accounts.account0,
                deadline
            );

            // Check the balances
            assertBn(
                await mockUsdv.balanceOf(accounts.account0),
                accountsAmount18.sub(liquidity18.add(liquidity18))
            );
            assertBn(
                await erc20Dec8.balanceOf(accounts.account0),
                accountsAmount8.sub(liquidity8)
            );
            assertBn(
                await erc20Dec12.balanceOf(accounts.account0),
                accountsAmount12.sub(liquidity12)
            );

            // Amounts
            const amountInSwap = parseUnits(100, 18);
            const amountOutMinSwap8 = parseUnits(90, 8);
            const amountOutMinSwap12 = parseUnits(90, 12);

            // Swap Tokens
            await routerV2.swapExactTokensForTokens(
                amountInSwap,
                amountOutMinSwap8,
                [mockUsdv.address, erc20Dec8.address],
                accounts.account2,
                deadline
            );

            const swapAmount8 = erc20Dec8.balanceOf(accounts.account2);

            // Check if we got what we want from the swap
            assert(swapAmount8 >= amountOutMinSwap8);

            await routerV2.swapExactTokensForTokens(
                amountInSwap,
                amountOutMinSwap12,
                [mockUsdv.address, erc20Dec12.address],
                accounts.account2,
                deadline
            );

            const swapAmount12 = await erc20Dec12.balanceOf(accounts.account2);

            // Check if we got what we want from the swap
            assert(swapAmount12 >= amountOutMinSwap12);

            // Get the base pool address
            const basePoolV2 = await BasePoolV2.at(poolV2.address);

            // ERC721 approve the id of the item
            await basePoolV2.approve(routerV2.address, 0);
            await basePoolV2.approve(routerV2.address, 1);

            // Amounts
            const amountAMin = parseUnits(50, 18);
            const amountBMin8 = parseUnits(50, 8);
            const amountBMin12 = parseUnits(50, 12);

            await routerV2.removeLiquidity(
                mockUsdv.address,
                erc20Dec8.address,
                0,
                amountAMin,
                amountBMin8,
                accounts.account3,
                deadline
            );

            // Check if we got back what we wanted for dec8
            assert(
                (await erc20Dec8.balanceOf(accounts.account3)) >= amountBMin8
            );

            await routerV2.removeLiquidity(
                mockUsdv.address,
                erc20Dec12.address,
                1,
                amountAMin,
                amountBMin12,
                accounts.account3,
                deadline
            );

            // Check if we got back what we wanted for dec12
            assert(
                (await erc20Dec12.balanceOf(accounts.account3)) >= amountBMin12
            );
        });

        it("should check the functionality with tokens that deviate from 18 decimals as liquidity add/double swap/remove and check the state", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);

            const {
                poolV2,
                erc20Dec8,
                erc20Dec12,
                routerV2,
                mockUsdv,
                reserve,
            } = await deployMock(accounts);

            await reserve.initialize(routerV2.address, accounts.dao);
            await routerV2.initialize(reserve.address);

            const mockAccount = accounts.account5;
            await poolV2.initialize(mockAccount, mockAccount, routerV2.address);

            // Set the supported tokens
            await poolV2.setTokenSupport(erc20Dec8.address, true);
            await poolV2.setTokenSupport(erc20Dec12.address, true);
            await poolV2.setTokenSupport(mockUsdv.address, true);

            // Construct the deadline
            const latestBlock = await web3.eth.getBlock("latest");
            const deadline = latestBlock.timestamp + 1000;

            // Amount to mint approve
            const accountsAmount8 = parseUnits(1000000, 8);
            const accountsAmount12 = parseUnits(1000000, 12);
            const accountsAmount18 = parseUnits(1000000, 18);

            // Mint and approve all tokens for the router
            mintAndApprove(
                accounts.account0,
                routerV2.address,
                erc20Dec8,
                accountsAmount8
            );

            mintAndApprove(
                accounts.account0,
                routerV2.address,
                erc20Dec12,
                accountsAmount12
            );

            mintAndApprove(
                accounts.account0,
                routerV2.address,
                mockUsdv,
                accountsAmount18
            );

            // Approve the pool also
            await erc20Dec8.approve(poolV2.address, accountsAmount8);
            await erc20Dec12.approve(poolV2.address, accountsAmount12);
            await mockUsdv.approve(poolV2.address, accountsAmount18);

            const liquidity8 = parseUnits(10000, 8);
            const liquidity12 = parseUnits(10000, 12);
            const liquidity18 = parseUnits(10000, 18);

            // Add liquidity 2 times on both tokens
            await routerV2.addLiquidity(
                mockUsdv.address,
                erc20Dec8.address,
                liquidity18,
                liquidity8,
                accounts.account0,
                deadline
            );

            await routerV2.addLiquidity(
                mockUsdv.address,
                erc20Dec12.address,
                liquidity18,
                liquidity12,
                accounts.account0,
                deadline
            );

            // Check the balances
            assertBn(
                await mockUsdv.balanceOf(accounts.account0),
                accountsAmount18.sub(liquidity18.add(liquidity18))
            );
            assertBn(
                await erc20Dec8.balanceOf(accounts.account0),
                accountsAmount8.sub(liquidity8)
            );
            assertBn(
                await erc20Dec12.balanceOf(accounts.account0),
                accountsAmount12.sub(liquidity12)
            );

            // Amounts
            const amountInSwap8 = parseUnits(100, 8);
            const amountInSwap12 = parseUnits(100, 12);
            const amountOutMinSwap8 = parseUnits(90, 8);
            const amountOutMinSwap12 = parseUnits(90, 12);

            // Swap Tokens
            await routerV2.swapExactTokensForTokens(
                amountInSwap12,
                amountOutMinSwap8,
                [erc20Dec12.address, mockUsdv.address, erc20Dec8.address],
                accounts.account2,
                deadline
            );

            const swapAmount8 = erc20Dec8.balanceOf(accounts.account2);

            // Check if we got what we want from the swap
            assert(swapAmount8 >= amountOutMinSwap8);

            await routerV2.swapExactTokensForTokens(
                amountInSwap8,
                amountOutMinSwap12,
                [erc20Dec8.address, mockUsdv.address, erc20Dec12.address],
                accounts.account2,
                deadline
            );

            const swapAmount12 = await erc20Dec12.balanceOf(accounts.account2);

            // Check if we got what we want from the swap
            assert(swapAmount12 >= amountOutMinSwap12);

            // Get the base pool address
            const basePoolV2 = await BasePoolV2.at(poolV2.address);

            // ERC721 approve the id of the item
            await basePoolV2.approve(routerV2.address, 0);
            await basePoolV2.approve(routerV2.address, 1);

            // Amounts
            const amountAMin = parseUnits(50, 18);
            const amountBMin8 = parseUnits(50, 8);
            const amountBMin12 = parseUnits(50, 12);

            await routerV2.removeLiquidity(
                mockUsdv.address,
                erc20Dec8.address,
                0,
                amountAMin,
                amountBMin8,
                accounts.account4,
                deadline
            );

            const dec8BalanceAccount4 = await erc20Dec8.balanceOf(
                accounts.account4
            );

            // Check if we got back what we wanted for dec8
            assert(dec8BalanceAccount4.gte(amountBMin8));

            await routerV2.removeLiquidity(
                mockUsdv.address,
                erc20Dec12.address,
                1,
                amountAMin,
                amountBMin12,
                accounts.account4,
                deadline
            );

            const dec12BalanceAccount4 = await erc20Dec12.balanceOf(
                accounts.account4
            );

            // Check if we got back what we wanted for dec12
            assert(dec12BalanceAccount4.gte(amountBMin12));
        });

        it("should add 2 tokens as supported, provide liquidity and check the state", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);

            const { poolV2, dai, token, routerV2, mockUsdv } = await deployMock(
                accounts
            );
            const mockAccount = accounts.account5;
            await poolV2.initialize(mockAccount, mockAccount, routerV2.address);

            // Set the supported tokens
            await poolV2.setTokenSupport(dai.address, true);
            await poolV2.setTokenSupport(token.address, true);
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
                token,
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
            await token.approve(poolV2.address, accountsAmount);
            await dai.approve(poolV2.address, accountsAmount);

            const liquidity = parseUnits(10000, 18);

            // Add liquidity 2 times on both tokens
            await routerV2.addLiquidity(
                mockUsdv.address,
                token.address,
                liquidity,
                liquidity,
                accounts.account0,
                deadline
            );

            // Check pool pair info
            const pairInfo0 = await poolV2.pairInfo(token.address);
            assertBn(pairInfo0.totalSupply, liquidity);

            await routerV2.addLiquidity(
                mockUsdv.address,
                dai.address,
                liquidity,
                liquidity,
                accounts.account0,
                deadline
            );

            // Check pool pair info
            const pairInfo1 = await poolV2.pairInfo(token.address);
            assertBn(pairInfo1.totalSupply, liquidity);

            // Get positions
            const position0 = await poolV2.positions(0);
            const position1 = await poolV2.positions(1);

            // Check positions
            assertBn(position0.originalNative, liquidity);
            assertBn(position0.originalForeign, liquidity);
            assertBn(position1.originalNative, liquidity);
            assertBn(position1.originalForeign, liquidity);

            // Check account balances
            assertBn(
                await dai.balanceOf(accounts.account0),
                accountsAmount.sub(liquidity)
            );
            assertBn(
                await token.balanceOf(accounts.account0),
                accountsAmount.sub(liquidity)
            );
            assertBn(
                await mockUsdv.balanceOf(accounts.account0),
                accountsAmount.sub(liquidity.add(liquidity))
            );

            // Check pool balances
            assertBn(await dai.balanceOf(poolV2.address), liquidity);
            assertBn(await token.balanceOf(poolV2.address), liquidity);
            assertBn(
                await mockUsdv.balanceOf(poolV2.address),
                liquidity.add(liquidity)
            );
        });
    });

    describe("swap exact tokens for tokens", () => {
        it("should swap the 2 supported tokens and check the state", async () => {
            const { routerV2, token, dai, mockUsdv, poolV2 } =
                await deployMock();
            const amountIn = parseUnits(100, 18);
            const amountOutMin = parseUnits(90, 18);

            // Construct the deadline
            const latestBlock = await web3.eth.getBlock("latest");
            const deadline = latestBlock.timestamp + 1000;

            // Swap Dai
            await routerV2.swapExactTokensForTokens(
                amountIn,
                amountOutMin,
                [mockUsdv.address, dai.address],
                accounts.account2,
                deadline
            );
            const daiSwapAmount = await dai.balanceOf(accounts.account2);

            // Check if we got what we wanted out of the swap
            assert(daiSwapAmount >= amountOutMin);

            // Swap Token
            await routerV2.swapExactTokensForTokens(
                amountIn,
                amountOutMin,
                [mockUsdv.address, token.address],
                accounts.account2,
                deadline
            );
            const tokenSwapAmount = await token.balanceOf(accounts.account2);

            // Check if we got what we wanted out of the swap
            assert(tokenSwapAmount >= amountOutMin);

            // The known liquidity that we already have
            const liquidity = parseUnits(10000, 18);

            // Check the balances
            assertBn(
                await dai.balanceOf(poolV2.address),
                liquidity.sub(daiSwapAmount)
            );
            assertBn(
                await token.balanceOf(poolV2.address),
                liquidity.sub(tokenSwapAmount)
            );
            assertBn(
                await mockUsdv.balanceOf(poolV2.address),
                liquidity.add(liquidity.add(amountIn.add(amountIn)))
            );
        });

        it("should do a double swap and check the state and balances", async () => {
            const { routerV2, mockUsdv, dai, token, poolV2 } =
                await deployMock();
            const amountIn = parseUnits(100, 18);
            const amountOutMin = parseUnits(90, 18);

            // Construct the deadline
            const latestBlock = await web3.eth.getBlock("latest");
            const deadline = latestBlock.timestamp + 1000;

            // Get current dai balance for account0
            const account0CurrentDaiBalance = await dai.balanceOf(
                accounts.account0
            );

            // Get the current dai balance for the pool
            const poolCurrentDaiBalance = await dai.balanceOf(poolV2.address);

            // Swap Dai and token
            await routerV2.swapExactTokensForTokens(
                amountIn,
                amountOutMin,
                [dai.address, mockUsdv.address, token.address],
                accounts.account3,
                deadline
            );

            // Get current dai balance for account0 after the double swap
            const account0AfterDoubleSwapDaiBalance = await dai.balanceOf(
                accounts.account0
            );

            // Get the current dai balance for the pool after the double swap
            const poolAfterDoubleSwapDaiBalance = await dai.balanceOf(
                poolV2.address
            );

            // Check the balances
            assertBn(
                account0AfterDoubleSwapDaiBalance,
                account0CurrentDaiBalance.sub(amountIn)
            );
            assertBn(
                poolAfterDoubleSwapDaiBalance,
                poolCurrentDaiBalance.add(amountIn)
            );

            // Check if we got what we wanted from the double swap
            const tokenSwapAmount = await token.balanceOf(accounts.account3);
            assert(tokenSwapAmount >= amountIn);
        });

        it("should do a single swap foreach supported token and a double swap and check the state and balances", async () => {
            const { routerV2, mockUsdv, dai, token, poolV2 } =
                await deployMock();
            const amountIn = parseUnits(100, 18);
            const amountOutMin = parseUnits(90, 18);

            // Construct the deadline
            const latestBlock = await web3.eth.getBlock("latest");
            const deadline = latestBlock.timestamp + 1000;

            // Get the current dai balance for the pool
            const poolCurrentDaiBalance = await dai.balanceOf(poolV2.address);

            // Get the current token balance for the pool
            const poolCurrentTokenBalance = await token.balanceOf(
                poolV2.address
            );

            // Swap Dai
            await routerV2.swapExactTokensForTokens(
                amountIn,
                amountOutMin,
                [mockUsdv.address, dai.address],
                accounts.account4,
                deadline
            );
            const daiSwapAmount = await dai.balanceOf(accounts.account4);
            assert(daiSwapAmount >= amountOutMin);

            // Swap Token
            await routerV2.swapExactTokensForTokens(
                amountIn,
                amountOutMin,
                [mockUsdv.address, token.address],
                accounts.account4,
                deadline
            );
            let tokenSwapAmount = await token.balanceOf(accounts.account4);
            assert(tokenSwapAmount >= amountOutMin);

            // Swap Dai and token
            await routerV2.swapExactTokensForTokens(
                amountIn,
                amountOutMin,
                [dai.address, mockUsdv.address, token.address],
                accounts.account5,
                deadline
            );
            const doubleSwapAmount = await token.balanceOf(accounts.account5);

            // Get the current dai balance for the pool after the swaps
            const poolAfterSwapsDaiBalance = await dai.balanceOf(
                poolV2.address
            );

            // Get the current token balance for the pool after the swaps
            const poolAfterSwapsTokenBalance = await token.balanceOf(
                poolV2.address
            );

            // Check the balances
            assertBn(
                poolAfterSwapsDaiBalance,
                poolCurrentDaiBalance.sub(daiSwapAmount).add(amountIn)
            );
            assertBn(
                poolAfterSwapsTokenBalance,
                poolCurrentTokenBalance.sub(
                    tokenSwapAmount.add(doubleSwapAmount)
                )
            );

            // Check if we still got what we wanted out of the swap
            assert(doubleSwapAmount >= amountOutMin);
        });

        it("should not allow to swap with insufficient trade output", async () => {
            const { routerV2, dai, mockUsdv } = await deployMock();
            const amountIn = parseUnits(100, 18);
            const amountOutMin = parseUnits(5000, 18);

            // Construct the deadline
            const latestBlock = await web3.eth.getBlock("latest");
            const deadline = latestBlock.timestamp + 1000;

            await assertErrors(
                routerV2.swapExactTokensForTokens(
                    amountIn,
                    amountOutMin,
                    [mockUsdv.address, dai.address],
                    accounts.account2,
                    deadline
                ),
                "VaderRouterV2::swapExactTokensForTokens: Insufficient Trade Output"
            );
        });

        it("should not allow swap with bad paths", async () => {
            const { routerV2, token, dai, mockUsdv } = await deployMock();
            const amountIn = parseUnits(100, 18);
            const amountOutMin = parseUnits(90, 18);

            // Construct the deadline
            const latestBlock = await web3.eth.getBlock("latest");
            const deadline = latestBlock.timestamp + 1000;

            await assertErrors(
                routerV2.swapExactTokensForTokens(
                    amountIn,
                    amountOutMin,
                    [dai.address, dai.address, token.address],
                    accounts.account0,
                    deadline
                ),
                "VaderRouterV2::_swap: Incorrect Path"
            );

            await assertErrors(
                routerV2.swapExactTokensForTokens(
                    amountIn,
                    amountOutMin,
                    [token.address, dai.address, dai.address],
                    accounts.account0,
                    deadline
                ),
                "VaderRouterV2::_swap: Incorrect Path"
            );

            await assertErrors(
                routerV2.swapExactTokensForTokens(
                    amountIn,
                    amountOutMin,
                    [dai.address],
                    accounts.account0,
                    deadline
                ),
                "VaderRouterV2::_swap: Incorrect Path Length"
            );

            await assertErrors(
                routerV2.swapExactTokensForTokens(
                    amountIn,
                    amountOutMin,
                    [
                        dai.address,
                        mockUsdv.address,
                        token.address,
                        token.address,
                    ],
                    accounts.account0,
                    deadline
                ),
                "VaderRouterV2::_swap: Incorrect Path Length"
            );

            await assertErrors(
                routerV2.swapExactTokensForTokens(
                    amountIn,
                    amountOutMin,
                    [UNSET_ADDRESS, dai.address, dai.address],
                    accounts.account0,
                    deadline
                ),
                "VaderRouterV2::_swap: Incorrect Path"
            );

            await assertErrors(
                routerV2.swapExactTokensForTokens(
                    amountIn,
                    amountOutMin,
                    [token.address, UNSET_ADDRESS, dai.address],
                    accounts.account0,
                    deadline
                ),
                "VaderRouterV2::_swap: Incorrect Path"
            );
        });
    });

    describe("remove liquidity", () => {
        it("should remove liquidity and check the state", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);

            const { poolV2, dai, token, routerV2, mockUsdv, reserve } =
                await deployMock(accounts);

            await reserve.initialize(routerV2.address, accounts.dao);
            await routerV2.initialize(reserve.address);

            const mockAccount = accounts.account5;
            await poolV2.initialize(mockAccount, mockAccount, routerV2.address);

            // Set the supported tokens
            await poolV2.setTokenSupport(dai.address, true);
            await poolV2.setTokenSupport(token.address, true);
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
                token,
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
            await token.approve(poolV2.address, accountsAmount);
            await dai.approve(poolV2.address, accountsAmount);

            const liquidity = parseUnits(10000, 18);

            // Add liquidity 2 times on both tokens
            await routerV2.addLiquidity(
                mockUsdv.address,
                token.address,
                liquidity,
                liquidity,
                accounts.account0,
                deadline
            );
            await routerV2.addLiquidity(
                mockUsdv.address,
                dai.address,
                liquidity,
                liquidity,
                accounts.account0,
                deadline
            );

            const minAmountOut = parseUnits(100, 18);

            // Get the base pool address
            const basePoolV2 = await BasePoolV2.at(poolV2.address);

            // ERC721 approve the id of the item
            await basePoolV2.approve(routerV2.address, 0);
            await basePoolV2.approve(routerV2.address, 1);

            // Check that the ownership is valid
            assert((await poolV2.ownerOf(0)) == accounts.account0);
            assert((await poolV2.ownerOf(1)) == accounts.account0);

            // Id 0 = token, 1 = dai
            await routerV2.removeLiquidity(
                mockUsdv.address,
                token.address,
                0,
                minAmountOut,
                minAmountOut,
                accounts.account1,
                deadline
            );
            assertBn(await token.balanceOf(accounts.account1), liquidity);

            await routerV2.removeLiquidity(
                mockUsdv.address,
                dai.address,
                1,
                minAmountOut,
                minAmountOut,
                accounts.account1,
                deadline
            );
            assertBn(await dai.balanceOf(accounts.account1), liquidity);

            assertBn(
                await mockUsdv.balanceOf(accounts.account1),
                liquidity.add(liquidity)
            );
        });

        it("should add, swap, remove liquidity and check the state", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);

            const { poolV2, dai, token, routerV2, mockUsdv, reserve } =
                await deployMock(accounts);

            await reserve.initialize(routerV2.address, accounts.dao);
            await routerV2.initialize(reserve.address);

            const mockAccount = accounts.account5;
            await poolV2.initialize(mockAccount, mockAccount, routerV2.address);

            // Set the supported tokens
            await poolV2.setTokenSupport(dai.address, true);
            await poolV2.setTokenSupport(token.address, true);
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
                token,
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
            await token.approve(poolV2.address, accountsAmount);
            await dai.approve(poolV2.address, accountsAmount);

            const liquidity = parseUnits(10000, 18);

            // Add liquidity 2 times on both tokens
            await routerV2.addLiquidity(
                mockUsdv.address,
                token.address,
                liquidity,
                liquidity,
                accounts.account0,
                deadline
            );
            await routerV2.addLiquidity(
                mockUsdv.address,
                dai.address,
                liquidity,
                liquidity,
                accounts.account0,
                deadline
            );

            const amountIn = parseUnits(100, 18);
            const amountOutMin = parseUnits(90, 18);

            await routerV2.swapExactTokensForTokens(
                amountIn,
                amountOutMin,
                [mockUsdv.address, dai.address],
                accounts.account1,
                deadline
            );
            await routerV2.swapExactTokensForTokens(
                amountIn,
                amountOutMin,
                [mockUsdv.address, dai.address],
                accounts.account1,
                deadline
            );

            const swapedDai = await dai.balanceOf(accounts.account1);
            const swapedToken = await token.balanceOf(accounts.account1);

            const minAmountOut = parseUnits(100, 18);

            // Get the base pool address
            const basePoolV2 = await BasePoolV2.at(poolV2.address);

            // ERC721 approve the id of the item
            await basePoolV2.approve(routerV2.address, 0);
            await basePoolV2.approve(routerV2.address, 1);

            // Check that the ownership is valid
            assert((await poolV2.ownerOf(0)) == accounts.account0);
            assert((await poolV2.ownerOf(1)) == accounts.account0);

            // Id 0 = token, 1 = dai
            await routerV2.removeLiquidity(
                mockUsdv.address,
                token.address,
                0,
                minAmountOut,
                minAmountOut,
                accounts.account2,
                deadline
            );

            // Check the token balance
            assertBn(
                await token.balanceOf(accounts.account2),
                liquidity.sub(swapedToken)
            );

            await routerV2.removeLiquidity(
                mockUsdv.address,
                dai.address,
                1,
                minAmountOut,
                minAmountOut,
                accounts.account2,
                deadline
            );

            // Check the dai balance
            assertBn(
                await dai.balanceOf(accounts.account2),
                liquidity.sub(swapedDai)
            );

            // Check the Usdv balance
            assertBn(
                await mockUsdv.balanceOf(accounts.account2),
                liquidity.add(liquidity).add(amountIn.add(amountIn))
            );
        });

        it("should add liquidity, perform double swaps, remove liquidity and check the state", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);

            const { poolV2, dai, token, routerV2, mockUsdv, reserve } =
                await deployMock(accounts);

            await reserve.initialize(routerV2.address, accounts.dao);
            await routerV2.initialize(reserve.address);

            const mockAccount = accounts.account5;
            await poolV2.initialize(mockAccount, mockAccount, routerV2.address);

            // Set the supported tokens
            await poolV2.setTokenSupport(dai.address, true);
            await poolV2.setTokenSupport(token.address, true);
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
                token,
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
            await token.approve(poolV2.address, accountsAmount);
            await dai.approve(poolV2.address, accountsAmount);

            const liquidity = parseUnits(10000, 18);

            // Add liquidity 2 times on both tokens
            await routerV2.addLiquidity(
                mockUsdv.address,
                token.address,
                liquidity,
                liquidity,
                accounts.account0,
                deadline
            );
            await routerV2.addLiquidity(
                mockUsdv.address,
                dai.address,
                liquidity,
                liquidity,
                accounts.account0,
                deadline
            );

            const amountIn = parseUnits(100, 18);
            const amountOutMin = parseUnits(90, 18);

            await routerV2.swapExactTokensForTokens(
                amountIn,
                amountOutMin,
                [token.address, mockUsdv.address, dai.address],
                accounts.account3,
                deadline
            );
            await routerV2.swapExactTokensForTokens(
                amountIn,
                amountOutMin,
                [dai.address, mockUsdv.address, token.address],
                accounts.account3,
                deadline
            );

            const swapedDai = await dai.balanceOf(accounts.account3);
            const swapedToken = await token.balanceOf(accounts.account3);

            const minAmountOut = parseUnits(100, 18);

            // Get the base pool address
            const basePoolV2 = await BasePoolV2.at(poolV2.address);

            // ERC721 approve the id of the item
            await basePoolV2.approve(routerV2.address, 0);
            await basePoolV2.approve(routerV2.address, 1);

            // Check that the ownership is valid
            assert((await poolV2.ownerOf(0)) == accounts.account0);
            assert((await poolV2.ownerOf(1)) == accounts.account0);

            // Id 0 = token, 1 = dai
            await routerV2.removeLiquidity(
                mockUsdv.address,
                token.address,
                0,
                minAmountOut,
                minAmountOut,
                accounts.account4,
                deadline
            );

            // Check token balance
            assertBn(
                await token.balanceOf(accounts.account4),
                liquidity.add(amountIn).sub(swapedToken)
            );

            await routerV2.removeLiquidity(
                mockUsdv.address,
                dai.address,
                1,
                minAmountOut,
                minAmountOut,
                accounts.account4,
                deadline
            );

            // Check the dai balance
            assertBn(
                await dai.balanceOf(accounts.account4),
                liquidity.sub(swapedDai).add(amountIn)
            );

            // Check the Usdv balance
            assertBn(
                await mockUsdv.balanceOf(accounts.account4),
                liquidity.add(liquidity)
            );
        });

        it("should not allow to remove liquidity with incorect addresses specified", async () => {
            const { routerV2, mockUsdv, dai, token } = await deployMock();
            const minAmountOut = parseUnits(1000, 18);

            // Construct the deadline
            const latestBlock = await web3.eth.getBlock("latest");
            const deadline = latestBlock.timestamp + 1000;

            const liquidity = parseUnits(10000, 18);

            // Add liquidity 2 times on both tokens
            await routerV2.addLiquidity(
                mockUsdv.address,
                token.address,
                liquidity,
                liquidity,
                accounts.account0,
                deadline
            );
            await routerV2.addLiquidity(
                mockUsdv.address,
                dai.address,
                liquidity,
                liquidity,
                accounts.account0,
                deadline
            );

            // Remove liquidity
            await assertErrors(
                routerV2.removeLiquidity(
                    mockUsdv.address,
                    UNSET_ADDRESS,
                    2,
                    minAmountOut,
                    minAmountOut,
                    accounts.account0,
                    deadline
                ),
                "VaderRouterV2::removeLiquidity: Incorrect Addresses Specified"
            );

            await assertErrors(
                routerV2.removeLiquidity(
                    UNSET_ADDRESS,
                    dai.address,
                    2,
                    minAmountOut,
                    minAmountOut,
                    accounts.account0,
                    deadline
                ),
                "VaderRouterV2::removeLiquidity: Incorrect Addresses Specified"
            );

            await assertErrors(
                routerV2.removeLiquidity(
                    UNSET_ADDRESS,
                    UNSET_ADDRESS,
                    2,
                    minAmountOut,
                    minAmountOut,
                    accounts.account0,
                    deadline
                ),
                "VaderRouterV2::removeLiquidity: Incorrect Addresses Specified"
            );

            await assertErrors(
                routerV2.removeLiquidity(
                    accounts.account0,
                    accounts.account1,
                    2,
                    minAmountOut,
                    minAmountOut,
                    accounts.account0,
                    deadline
                ),
                "VaderRouterV2::removeLiquidity: Incorrect Addresses Specified"
            );
        });

        it("should not allow to remove liquidity with insufficient amounts specified", async () => {
            const { routerV2, mockUsdv, dai, token, poolV2 } =
                await deployMock();

            const minAmountOut = parseUnits(1000, 18);
            const amount = parseUnits(5000000, 18);

            // Construct the deadline
            const latestBlock = await web3.eth.getBlock("latest");
            const deadline = latestBlock.timestamp + 1000;

            // Get the base pool address
            const basePoolV2 = await BasePoolV2.at(poolV2.address);

            // Approve the id
            await basePoolV2.approve(routerV2.address, 2);
            await basePoolV2.approve(routerV2.address, 3);

            // Remove liquidity
            await assertErrors(
                routerV2.removeLiquidity(
                    mockUsdv.address,
                    token.address,
                    2,
                    amount,
                    minAmountOut,
                    accounts.account0,
                    deadline
                ),
                "VaderRouterV2: INSUFFICIENT_A_AMOUNT"
            );

            await assertErrors(
                routerV2.removeLiquidity(
                    mockUsdv.address,
                    dai.address,
                    3,
                    minAmountOut,
                    amount,
                    accounts.account0,
                    deadline
                ),
                "VaderRouterV2: INSUFFICIENT_B_AMOUNT"
            );
        });
    });

    describe("initialize", () => {
        it("should not allow to initialize with zero address", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);
            const { routerV2 } = await deployMock(accounts);

            await assertErrors(
                routerV2.initialize(UNSET_ADDRESS),
                "VaderRouterV2::initialize: Incorrect Reserve Specified"
            );
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

            await assertErrors(
                routerV2.addLiquidity(
                    mockUsdv.address,
                    dai.address,
                    100,
                    100,
                    accounts.account0,
                    1000
                ),
                "VaderRouterV2::ensure: Expired"
            );
        });
    });
});
