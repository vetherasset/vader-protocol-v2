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
    BasePool,

    // Project Specific Constants
    PROJECT_CONSTANTS,

    // Helpers
    mintAndApprove,
} = require("./../utils")(artifacts);

contract("VaderRouter", (accounts) => {
    describe("VaderRouter -> construction", () => {
        it("should not create a router without a pool factory set", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);

            await assertErrors(
                deployMock(accounts, {
                    VaderRouter: () => [UNSET_ADDRESS],
                }),
                "VaderRouter::constructor: Incorrect Arguments"
            );
        });
    });

    describe("VaderRouter -> initialize", () => {
        it("should not allow to initialize from a not owner account", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);
            const { router, reserve } = await deployMock(accounts);
            await assertErrors(
                router.initialize(reserve.address, { from: accounts.account1 }),
                "Ownable: caller is not the owner"
            );
        });

        it("should not allow to initialize with incorrect reserve specified", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);
            const { router } = await deployMock(accounts);
            await assertErrors(
                router.initialize(UNSET_ADDRESS),
                "VaderRouter::initialize: Incorrect Reserve Specified"
            );
        });

        it("should initialize and check if the state is properly changed", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);
            const { router, reserve } = await deployMock(accounts);
            await router.initialize(reserve.address);
            assert.equal(await router.reserve(), await reserve.address);
            assert.equal(await router.owner(), UNSET_ADDRESS);
        });
    });

    describe("VaderRouter -> swap exact tokens for tokens", () => {
        it("should not allow to swap with bad timestamp", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);

            const { router } = await deployMock(accounts);
            await assertErrors(
                router.swapExactTokensForTokens(
                    TEN_UNITS,
                    2000,
                    [],
                    accounts.account1,
                    1000
                ),
                "VaderRouter::ensure: Expired"
            );
        });

        it("should not allow to swap with incorrect path", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);

            const { router } = await deployMock(accounts);
            const latestBlock = await web3.eth.getBlock("latest");
            const timestampNow = latestBlock.timestamp;
            await assertErrors(
                router.swapExactTokensForTokens(
                    TEN_UNITS,
                    2000,
                    [accounts.account1, accounts.account0, accounts.account1],
                    accounts.account1,
                    timestampNow
                ),
                "VaderRouter::_swap: Incorrect Path"
            );
        });

        it("should not allow to swap with incorrect path length", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);

            const { router } = await deployMock(accounts);
            const latestBlock = await web3.eth.getBlock("latest");
            const timestampNow = latestBlock.timestamp;
            await assertErrors(
                router.swapExactTokensForTokens(
                    TEN_UNITS,
                    2000,
                    [],
                    accounts.account1,
                    timestampNow
                ),
                "VaderRouter::_swap: Incorrect Path Length"
            );
        });

        it("should swap and check if state results and balances are valid", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);

            const { router, factory, mockUsdv, dai } = await deployMock(
                accounts
            );

            // Get the latest block timestamp and add to it
            const latestBlock = await web3.eth.getBlock("latest");
            const timestampAhead = latestBlock.timestamp + 1000;

            // Initialize the factory and get the navite asset address
            await factory.initialize(mockUsdv.address, accounts.dao, {
                from: accounts.administrator,
            });
            const nativeAssetAdress = await factory.nativeAsset();

            // Create pool native asset <-> dai
            await factory.createPool(nativeAssetAdress, dai.address);

            // Get the created pool address
            const poolAddress = await factory.getPool(
                dai.address,
                nativeAssetAdress
            );

            const balance = parseUnits(5000000, 18);

            // Mint some tokens and approve
            await mintAndApprove(
                accounts.account0,
                router.address,
                mockUsdv,
                balance
            );
            await mintAndApprove(
                accounts.account0,
                router.address,
                dai,
                balance
            );

            const liquidity = parseUnits(1000000, 18);

            // Add a big amount of liquidity
            await router.addLiquidity(
                nativeAssetAdress,
                dai.address,
                liquidity,
                liquidity,
                poolAddress,
                timestampAhead
            );
            await router.addLiquidity(
                nativeAssetAdress,
                dai.address,
                liquidity,
                liquidity,
                poolAddress,
                timestampAhead
            );

            // Get the pool object
            const pool = await BasePool.at(poolAddress);

            const position0 = await pool.positions(0);
            const position1 = await pool.positions(1);

            // Check if not 0
            assert.notEqual(position0.toString(), "0");
            assert.notEqual(position1.toString(), "0");

            // Check if positions are equal
            assertBn(position0, position1);

            // Swap a small amount
            await router.swapExactTokensForTokens(
                parseUnits(5, 17), // 0.5 units
                2000,
                [nativeAssetAdress, dai.address],
                accounts.account1,
                timestampAhead
            );

            // Very low slipage
            assert(
                (await dai.balanceOf(accounts.account1)) >= parseUnits(45, 16)
            );
        });

        // it("should remove liquidity", async () => {
        //     const { router, factory, dai, mockUsdv } = await deployMock();

        //     // Get the latest block timestamp and add to it
        //     const latestBlock = await web3.eth.getBlock("latest");
        //     const timestampAhead = latestBlock.timestamp + 1000;
        //     const nativeAssetAdress = await factory.nativeAsset();

        //     // Get the created pool address
        //     const poolAddress = await factory.getPool(
        //         dai.address,
        //         nativeAssetAdress
        //     );

        //     // Get the pool object
        //     const pool = await BasePool.at(poolAddress);

        //     const liquidity = parseUnits(1000000, 18);
        //     // TODO: Fix
        //     // await dai.approve(poolAddress, liquidity);
        //     // await mockUsdv.approve(poolAddress, liquidity);
        //     // console.log(await router.removeLiquidity(nativeAssetAdress, dai.address, 1, parseUnits(100, 18), parseUnits(100, 18), accounts.account1, timestampAhead));
        // });

        it("should not allow swap with insufficient trade output", async () => {
            const { router, factory, dai } = await deployMock();

            // Get the latest block timestamp and add to it
            const latestBlock = await web3.eth.getBlock("latest");
            const timestampAhead = latestBlock.timestamp + 1000;

            // Get the native asset address
            const nativeAssetAdress = await factory.nativeAsset();

            await assertErrors(
                router.swapExactTokensForTokens(
                    parseUnits(5, 17),
                    parseUnits(50000, 18),
                    [nativeAssetAdress, dai.address],
                    accounts.account1,
                    timestampAhead
                ),
                "VaderRouter::swapExactTokensForTokens: Insufficient Trade Output"
            );
        });

        it("should not allow swap with bad arguments", async () => {
            const { router, factory, dai } = await deployMock();

            // Get the latest block timestamp and add to it
            const latestBlock = await web3.eth.getBlock("latest");
            const timestampAhead = latestBlock.timestamp + 1000;

            // Get the native asset address
            const nativeAssetAdress = await factory.nativeAsset();

            await assertErrors(
                router.swapExactTokensForTokens(
                    parseUnits(0, 18),
                    parseUnits(0, 18),
                    [nativeAssetAdress, dai.address],
                    accounts.account1,
                    timestampAhead
                ),
                "BasePool::swap: Only One-Sided Swaps Supported"
            );
        });

        it("should not allow swap with invalid receiver", async () => {
            const { router, factory, dai, mockUsdv } = await deployMock();

            // Get the latest block timestamp and add to it
            const latestBlock = await web3.eth.getBlock("latest");
            const timestampAhead = latestBlock.timestamp + 1000;

            // Get the native asset address
            const nativeAssetAdress = await factory.nativeAsset();

            await assertErrors(
                router.swapExactTokensForTokens(
                    parseUnits(5, 18),
                    2000,
                    [nativeAssetAdress, dai.address],
                    nativeAssetAdress,
                    timestampAhead
                ),
                "BasePool::swap: Invalid Receiver"
            );
            await assertErrors(
                router.swapExactTokensForTokens(
                    parseUnits(5, 18),
                    2000,
                    [nativeAssetAdress, dai.address],
                    mockUsdv.address,
                    timestampAhead
                ),
                "BasePool::swap: Invalid Receiver"
            );
        });

        it("should not allow imposible swaps", async () => {
            const { router, factory, dai } = await deployMock();

            // Get the latest block timestamp and add to it
            const latestBlock = await web3.eth.getBlock("latest");
            const timestampAhead = latestBlock.timestamp + 1000;

            // Get the native asset address
            const nativeAssetAdress = await factory.nativeAsset();

            await assertErrors(
                router.swapExactTokensForTokens(
                    parseUnits(5, 17),
                    parseUnits(20, 18),
                    [nativeAssetAdress, dai.address],
                    accounts.account1,
                    timestampAhead,
                    { from: accounts.account1 }
                ),
                "ERC20: transfer amount exceeds balance"
            );
        });

        it("should swap and check liquidity state", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);

            const { router, factory, mockUsdv, dai } = await deployMock(
                accounts
            );

            // Get the latest block timestamp and add to it
            const latestBlock = await web3.eth.getBlock("latest");
            const timestampAhead = latestBlock.timestamp + 1000;

            // Initialize the factory and get the navite asset address
            await factory.initialize(mockUsdv.address, accounts.dao, {
                from: accounts.administrator,
            });
            const nativeAssetAdress = await factory.nativeAsset();

            // Create pool native asset <-> dai
            await factory.createPool(nativeAssetAdress, dai.address);

            // Get the created pool address
            const poolAddress = await factory.getPool(
                dai.address,
                nativeAssetAdress
            );

            const balance = parseUnits(5000000, 18);

            // Mint some tokens and approve
            await mintAndApprove(
                accounts.account0,
                router.address,
                mockUsdv,
                balance
            );
            await mintAndApprove(
                accounts.account0,
                router.address,
                dai,
                balance
            );

            // Add a big amount of liquidity
            await router.addLiquidity(
                nativeAssetAdress,
                dai.address,
                parseUnits(1000, 18),
                parseUnits(1000, 18),
                poolAddress,
                timestampAhead
            );
            await router.addLiquidity(
                nativeAssetAdress,
                dai.address,
                parseUnits(1000, 18),
                parseUnits(1000, 18),
                poolAddress,
                timestampAhead
            );

            // Get the pool object
            const pool = await BasePool.at(poolAddress);

            // Check if positions are equal
            assertBn(await pool.positions(0), await pool.positions(1));

            // Get current balances
            const poolDaiBalance = await dai.balanceOf(poolAddress);
            const poolUsdvBalance = await mockUsdv.balanceOf(poolAddress);

            // Check if balances are right
            assertBn(poolDaiBalance, parseUnits(2000, 18));
            assertBn(poolUsdvBalance, parseUnits(2000, 18));

            const amountToSwap = parseUnits(10, 18);
            const amountOutMin = parseUnits(1, 18);
            // Swap a small amount
            await router.swapExactTokensForTokens(
                amountToSwap,
                amountOutMin,
                [nativeAssetAdress, dai.address],
                accounts.account1,
                timestampAhead
            );

            // Expected balances
            const expectedPoolUsdvBalance = poolUsdvBalance.add(amountToSwap);
            const expectedPoolDaiBalance = poolDaiBalance.sub(
                await dai.balanceOf(accounts.account1)
            );

            // Check balances
            assertBn(
                await mockUsdv.balanceOf(poolAddress),
                expectedPoolUsdvBalance
            );
            assertBn(await dai.balanceOf(poolAddress), expectedPoolDaiBalance);

            // Mint some tokens and approve
            await mintAndApprove(
                accounts.account1,
                router.address,
                mockUsdv,
                balance
            );
            await mintAndApprove(
                accounts.account1,
                router.address,
                dai,
                balance
            );

            // Swap some more
            await router.swapExactTokensForTokens(
                amountToSwap,
                amountOutMin,
                [nativeAssetAdress, dai.address],
                accounts.account2,
                timestampAhead,
                { from: accounts.account1 }
            );

            // Check balances again after second swap
            assertBn(
                await mockUsdv.balanceOf(poolAddress),
                expectedPoolUsdvBalance.add(amountToSwap)
            );
            assertBn(
                await dai.balanceOf(poolAddress),
                expectedPoolDaiBalance.sub(
                    await dai.balanceOf(accounts.account2)
                )
            );
        });

        it("should swap more and check if state holds", async () => {
            const { router, factory, dai, mockUsdv } = await deployMock();

            // Get the latest block timestamp and add to it
            const latestBlock = await web3.eth.getBlock("latest");
            const timestampAhead = latestBlock.timestamp + 1000;

            const nativeAssetAdress = await factory.nativeAsset();

            const amountToSwap = parseUnits(300, 18);
            const amountOutMin = parseUnits(50, 18);

            // Swaps
            await router.swapExactTokensForTokens(
                amountToSwap,
                amountOutMin,
                [nativeAssetAdress, dai.address],
                accounts.account3,
                timestampAhead,
                { from: accounts.account1 }
            );

            assert((await dai.balanceOf(accounts.account3)) > 0);
        });

        it("should add big liquidity swap small amount of tokens and check return amounts", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);

            const { router, factory, mockUsdv, dai } = await deployMock(
                accounts
            );

            // Get the latest block timestamp and add to it
            const latestBlock = await web3.eth.getBlock("latest");
            const timestampAhead = latestBlock.timestamp + 1000;

            // Initialize the factory and get the navite asset address
            await factory.initialize(mockUsdv.address, accounts.dao, {
                from: accounts.administrator,
            });
            const nativeAssetAdress = await factory.nativeAsset();

            // Create pool native asset <-> dai
            await factory.createPool(nativeAssetAdress, dai.address);

            // Get the created pool address
            const poolAddress = await factory.getPool(
                dai.address,
                nativeAssetAdress
            );

            const balance = parseUnits(5000000, 18);

            // Mint some tokens and approve
            await mintAndApprove(
                accounts.account0,
                router.address,
                mockUsdv,
                balance
            );
            await mintAndApprove(
                accounts.account0,
                router.address,
                dai,
                balance
            );

            // Asking for a small amount of the pool
            const amountToSwap = parseUnits(1000, 18);
            // We dont care atm about the minimum out
            const amountOutMin = parseUnits(10, 18);

            const liquidity = parseUnits(1000000, 18);

            // Add a big amount of liquidity slipage should be low
            await router.addLiquidity(
                nativeAssetAdress,
                dai.address,
                liquidity,
                liquidity,
                poolAddress,
                timestampAhead
            );

            // Swap tokens
            await router.swapExactTokensForTokens(
                amountToSwap,
                amountOutMin,
                [nativeAssetAdress, dai.address],
                accounts.account1,
                timestampAhead
            );

            // Very low slipage
            assert(
                (await dai.balanceOf(accounts.account1)) >= parseUnits(998, 18)
            );
        });

        it("should add smalll liquidity and check return amounts", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);

            const { router, factory, mockUsdv, dai } = await deployMock(
                accounts
            );

            // Get the latest block timestamp and add to it
            const latestBlock = await web3.eth.getBlock("latest");
            const timestampAhead = latestBlock.timestamp + 1000;

            // Initialize the factory and get the navite asset address
            await factory.initialize(mockUsdv.address, accounts.dao, {
                from: accounts.administrator,
            });
            const nativeAssetAdress = await factory.nativeAsset();

            // Create pool native asset <-> dai
            await factory.createPool(nativeAssetAdress, dai.address);

            // Get the created pool address
            const poolAddress = await factory.getPool(
                dai.address,
                nativeAssetAdress
            );

            const balance = parseUnits(5000000, 18);

            // Mint some tokens and approve
            await mintAndApprove(
                accounts.account0,
                router.address,
                mockUsdv,
                balance
            );
            await mintAndApprove(
                accounts.account0,
                router.address,
                dai,
                balance
            );

            // Asking for half of the pool
            const amountToSwap = parseUnits(500, 18);
            // We dont care atm about the minimum out
            const amountOutMin = parseUnits(10, 18);

            // Add a small amount of liquidity slipage should be high
            await router.addLiquidity(
                nativeAssetAdress,
                dai.address,
                parseUnits(1000, 18),
                parseUnits(1000, 18),
                poolAddress,
                timestampAhead
            );

            // Swap tokens
            await router.swapExactTokensForTokens(
                amountToSwap,
                amountOutMin,
                [nativeAssetAdress, dai.address],
                accounts.account1,
                timestampAhead
            );

            // Over 50% slipage
            assert(
                (await dai.balanceOf(accounts.account1)) <= parseUnits(250, 18)
            );
        });

        it("should not allow to ask more than the available liquidity", async () => {
            const { router, factory, mockUsdv, dai } = await deployMock();

            // Get the latest block timestamp and add to it
            const latestBlock = await web3.eth.getBlock("latest");
            const timestampAhead = latestBlock.timestamp + 1000;

            const nativeAssetAddress = await factory.nativeAsset();

            // Get the created pool address
            const poolAddress = await factory.getPool(
                dai.address,
                nativeAssetAddress
            );

            // 1 milion liquidity
            const liquidity = parseUnits(1000000, 18);

            // Add a big amount of liquidity
            await router.addLiquidity(
                nativeAssetAddress,
                dai.address,
                liquidity,
                liquidity,
                poolAddress,
                timestampAhead
            );

            // Ask over the amount of the pool
            const amountToSwap = parseUnits(2000000, 18);

            // We dont care atm about the minimum out
            const amountOutMin = parseUnits(10, 18);

            // Swap tokens
            await assertErrors(
                router.swapExactTokensForTokens(
                    amountToSwap,
                    amountOutMin,
                    [mockUsdv.address, dai.address],
                    accounts.account2,
                    timestampAhead
                ),
                "BasePool::swap: Unfavourable Trade"
            );
        });

        it("should add liquidity from many accounts and swap from other and evaluate the state", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);

            const { router, factory, mockUsdv, dai } = await deployMock(
                accounts
            );

            // Get the latest block timestamp and add to it
            const latestBlock = await web3.eth.getBlock("latest");
            const timestampAhead = latestBlock.timestamp + 1000;

            // Initialize the factory and get the navite asset address
            await factory.initialize(mockUsdv.address, accounts.dao, {
                from: accounts.administrator,
            });
            const nativeAssetAdress = await factory.nativeAsset();

            // Create pool native asset <-> dai
            await factory.createPool(nativeAssetAdress, dai.address);

            // Get the created pool address
            const poolAddress = await factory.getPool(
                dai.address,
                nativeAssetAdress
            );

            const balance = parseUnits(5000000, 18);

            // Mint some tokens and approve for account0
            await mintAndApprove(
                accounts.account0,
                router.address,
                mockUsdv,
                balance
            );
            await mintAndApprove(
                accounts.account0,
                router.address,
                dai,
                balance
            );

            // Mint some tokens and approve for account1
            await mintAndApprove(
                accounts.account1,
                router.address,
                mockUsdv,
                balance
            );
            await mintAndApprove(
                accounts.account1,
                router.address,
                dai,
                balance
            );

            // Mint some tokens and approve for account2
            await mintAndApprove(
                accounts.account2,
                router.address,
                mockUsdv,
                balance
            );
            await mintAndApprove(
                accounts.account2,
                router.address,
                dai,
                balance
            );

            // Asking for half of the pool
            const amountToSwap = parseUnits(500, 18);
            // We dont care atm about the minimum out
            const amountOutMin = parseUnits(450, 18);

            const liquidity0 = parseUnits(10000, 18);
            const liquidity1 = parseUnits(5000, 18);
            const liquidity2 = parseUnits(22000, 18);
            // Add liquidity
            await router.addLiquidity(
                nativeAssetAdress,
                dai.address,
                liquidity0,
                liquidity0,
                poolAddress,
                timestampAhead
            );

            await router.addLiquidity(
                nativeAssetAdress,
                dai.address,
                liquidity1,
                liquidity1,
                poolAddress,
                timestampAhead,
                { from: accounts.account1 }
            );

            await router.addLiquidity(
                nativeAssetAdress,
                dai.address,
                liquidity2,
                liquidity2,
                poolAddress,
                timestampAhead,
                { from: accounts.account2 }
            );

            // Swap tokens
            await router.swapExactTokensForTokens(
                amountToSwap,
                amountOutMin,
                [nativeAssetAdress, dai.address],
                accounts.account3,
                timestampAhead
            );

            // Make sure we got what we wanted from the swap
            const swapedAmount = await dai.balanceOf(accounts.account3);
            assert(swapedAmount > amountOutMin);

            // Get the pool object
            const pool = await BasePool.at(poolAddress);

            const reserves = await pool.getReserves();

            const position0 = await pool.positions(0);
            const position1 = await pool.positions(1);
            const position2 = await pool.positions(2);

            // Checks for account0
            assertBn(position0.liquidity, liquidity0);
            assertBn(position0.originalNative, liquidity0);
            assertBn(position0.originalForeign, liquidity0);

            // Checks for account1
            assertBn(position1.liquidity, liquidity1);
            assertBn(position1.originalNative, liquidity1);
            assertBn(position1.originalForeign, liquidity1);

            // Checks for account2
            assertBn(position2.liquidity, liquidity2);
            assertBn(position2.originalNative, liquidity2);
            assertBn(position2.originalForeign, liquidity2);

            // Check the reserves
            assertBn(
                reserves.reserveForeign,
                liquidity0.add(liquidity1.add(liquidity2)).sub(swapedAmount)
            );
            assertBn(
                reserves.reserveNative,
                liquidity0.add(liquidity1.add(liquidity2)).add(amountToSwap)
            );
        });
    });

    describe("Vader -> swap tokens for exact tokens", () => {
        it("should calculate amounts properly", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);

            const { router, factory, mockUsdv, dai } = await deployMock(
                accounts
            );

            // Get the latest block timestamp and add to it
            const latestBlock = await web3.eth.getBlock("latest");
            const timestampAhead = latestBlock.timestamp + 1000;

            // Initialize the factory and get the navite asset address
            await factory.initialize(mockUsdv.address, accounts.dao, {
                from: accounts.administrator,
            });
            const nativeAssetAdress = await factory.nativeAsset();

            // Create pool native asset <-> dai
            await factory.createPool(nativeAssetAdress, dai.address);

            // Get the created pool address
            const poolAddress = await factory.getPool(
                dai.address,
                nativeAssetAdress
            );

            const balance = parseUnits(5000000, 18);

            // Mint some tokens and approve for account0
            await mintAndApprove(
                accounts.account0,
                router.address,
                mockUsdv,
                balance
            );
            await mintAndApprove(
                accounts.account0,
                router.address,
                dai,
                balance
            );

            // Provide big liquidity
            const liquidity0 = parseUnits(1000000, 18);

            // Add liquidity
            await router.addLiquidity(
                nativeAssetAdress,
                dai.address,
                liquidity0,
                liquidity0,
                poolAddress,
                timestampAhead
            );

            const amount = parseUnits(100, 18);

            // Swap tokens V-> E
            let amountIn = await router.calculateInGivenOut(amount, [
                nativeAssetAdress,
                dai.address,
            ]);

            let amountOut = await router.calculateOutGivenIn(amountIn, [
                nativeAssetAdress,
                dai.address,
            ]);

            // Swap tokens E-> V
            amountIn = await router.calculateInGivenOut(amount, [
                dai.address,
                nativeAssetAdress,
            ]);

            amountOut = await router.calculateOutGivenIn(amountIn, [
                dai.address,
                nativeAssetAdress,
            ]);

            amountOut = await router.calculateOutGivenIn(amount.mul(big(2)), [
                dai.address,
                nativeAssetAdress,
            ]);
        });

        it("should swap tokens for exact tokens", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);

            const { router, factory, mockUsdv, dai } = await deployMock(
                accounts
            );

            // Get the latest block timestamp and add to it
            const latestBlock = await web3.eth.getBlock("latest");
            const timestampAhead = latestBlock.timestamp + 1000;

            // Initialize the factory and get the navite asset address
            await factory.initialize(mockUsdv.address, accounts.dao, {
                from: accounts.administrator,
            });
            const nativeAssetAdress = await factory.nativeAsset();

            // Create pool native asset <-> dai
            await factory.createPool(nativeAssetAdress, dai.address);

            // Get the created pool address
            const poolAddress = await factory.getPool(
                dai.address,
                nativeAssetAdress
            );

            const balance = parseUnits(5000000, 18);

            // Mint some tokens and approve for account0
            await mintAndApprove(
                accounts.account0,
                router.address,
                mockUsdv,
                balance
            );
            await mintAndApprove(
                accounts.account0,
                router.address,
                dai,
                balance
            );

            // Provide big liquidity
            const liquidity0 = parseUnits(1000000, 18);

            // Add liquidity
            await router.addLiquidity(
                nativeAssetAdress,
                dai.address,
                liquidity0,
                liquidity0,
                poolAddress,
                timestampAhead
            );

            const amountOut = parseUnits(100, 18);
            const amountInMax = parseUnits(300, 18);

            // Swap tokens
            await router.swapTokensForExactTokens(
                amountOut,
                amountInMax,
                [nativeAssetAdress, dai.address],
                accounts.account3,
                timestampAhead
            );
            assertBn(
                amountOut,
                await dai.balanceOf(accounts.account3),
                amountOut.div(big(100))
            );
        });

        it("should not allow swap for exact tokens with a large trade input", async () => {
            const { router, factory, dai } = await deployMock();

            // Get the latest block timestamp and add to it
            const latestBlock = await web3.eth.getBlock("latest");
            const timestampAhead = latestBlock.timestamp + 1000;
            const nativeAssetAdress = await factory.nativeAsset();
            const amountOut = parseUnits(1000, 18);
            const amountInMax = parseUnits(300, 18);

            // Swap tokens
            await assertErrors(
                router.swapTokensForExactTokens(
                    amountOut,
                    amountInMax,
                    [nativeAssetAdress, dai.address],
                    accounts.account3,
                    timestampAhead
                ),
                "VaderRouter::swapTokensForExactTokens: Large Trade Input"
            );
        });

        it("should not allow swap for exact tokens with bad paths", async () => {
            const { router, factory, dai } = await deployMock(accounts);

            // Get the latest block timestamp and add to it
            const latestBlock = await web3.eth.getBlock("latest");
            const timestampAhead = latestBlock.timestamp + 1000;
            const nativeAssetAdress = await factory.nativeAsset();

            const amountOut = parseUnits(1000, 18);
            const amountInMax = parseUnits(300, 18);

            await assertErrors(
                router.swapTokensForExactTokens(
                    amountOut,
                    amountInMax,
                    [UNSET_ADDRESS, dai.address],
                    accounts.account3,
                    timestampAhead
                ),
                ""
            );
            await assertErrors(
                router.swapTokensForExactTokens(
                    amountOut,
                    amountInMax,
                    [nativeAssetAdress, UNSET_ADDRESS],
                    accounts.account3,
                    timestampAhead
                ),
                ""
            );
            await assertErrors(
                router.swapTokensForExactTokens(
                    amountOut,
                    amountInMax,
                    [UNSET_ADDRESS, UNSET_ADDRESS],
                    accounts.account3,
                    timestampAhead
                ),
                ""
            );
        });

        it("should not allow swap exact tokens with bad args", async () => {
            const { router, factory, dai } = await deployMock(accounts);

            // Get the latest block timestamp and add to it
            const latestBlock = await web3.eth.getBlock("latest");
            const timestampAhead = latestBlock.timestamp + 1000;
            const nativeAssetAdress = await factory.nativeAsset();

            const amountOut = parseUnits(1000, 18);
            const amountInMax = parseUnits(300, 18);

            await assertErrors(
                router.swapTokensForExactTokens(
                    0,
                    amountInMax,
                    [nativeAssetAdress, dai.address],
                    accounts.account3,
                    timestampAhead
                ),
                ""
            );
            await assertErrors(
                router.swapTokensForExactTokens(
                    amountOut,
                    0,
                    [nativeAssetAdress, dai.address],
                    accounts.account3,
                    timestampAhead
                ),
                ""
            );
            await assertErrors(
                router.swapTokensForExactTokens(
                    amountOut,
                    amountInMax,
                    [nativeAssetAdress, dai.address],
                    UNSET_ADDRESS,
                    timestampAhead
                ),
                ""
            );
        });

        it("should add small liquidity and swap tokens for exact tokens and validate the state", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);

            const { router, factory, mockUsdv, dai } = await deployMock(
                accounts
            );

            // Get the latest block timestamp and add to it
            const latestBlock = await web3.eth.getBlock("latest");
            const timestampAhead = latestBlock.timestamp + 1000;

            // Initialize the factory and get the navite asset address
            await factory.initialize(mockUsdv.address, accounts.dao, {
                from: accounts.administrator,
            });
            const nativeAssetAdress = await factory.nativeAsset();

            // Create pool native asset <-> dai
            await factory.createPool(nativeAssetAdress, dai.address);

            // Get the created pool address
            const poolAddress = await factory.getPool(
                dai.address,
                nativeAssetAdress
            );

            const balance = parseUnits(5000000, 18);

            // Mint some tokens and approve for account0
            await mintAndApprove(
                accounts.account0,
                router.address,
                mockUsdv,
                balance
            );
            await mintAndApprove(
                accounts.account0,
                router.address,
                dai,
                balance
            );

            // Provide small liquidity
            const liquidity0 = parseUnits(1000, 18);

            // Add liquidity
            await router.addLiquidity(
                nativeAssetAdress,
                dai.address,
                liquidity0,
                liquidity0,
                poolAddress,
                timestampAhead
            );

            // Due to low liquidity in the pool we need to provide a large amountInMax
            const amountOut = parseUnits(100, 18);
            const amountInMax = parseUnits(300, 18);

            // Swap tokens
            await router.swapTokensForExactTokens(
                amountOut,
                amountInMax,
                [nativeAssetAdress, dai.address],
                accounts.account3,
                timestampAhead
            );
            assertBn(
                amountOut,
                await dai.balanceOf(accounts.account3),
                amountOut.div(big(100))
            );
        });

        it("should add big liquidity and swap tokens for exact tokens and validate the state", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);

            const { router, factory, mockUsdv, dai } = await deployMock(
                accounts
            );

            // Get the latest block timestamp and add to it
            const latestBlock = await web3.eth.getBlock("latest");
            const timestampAhead = latestBlock.timestamp + 1000;

            // Initialize the factory and get the navite asset address
            await factory.initialize(mockUsdv.address, accounts.dao, {
                from: accounts.administrator,
            });
            const nativeAssetAdress = await factory.nativeAsset();

            // Create pool native asset <-> dai
            await factory.createPool(nativeAssetAdress, dai.address);

            // Get the created pool address
            const poolAddress = await factory.getPool(
                dai.address,
                nativeAssetAdress
            );

            const balance = parseUnits(5000000, 18);

            // Mint some tokens and approve for account0
            await mintAndApprove(
                accounts.account0,
                router.address,
                mockUsdv,
                balance
            );
            await mintAndApprove(
                accounts.account0,
                router.address,
                dai,
                balance
            );

            // Provide big liquidity
            const liquidity0 = parseUnits(1000000, 18);

            // Add liquidity
            await router.addLiquidity(
                nativeAssetAdress,
                dai.address,
                liquidity0,
                liquidity0,
                poolAddress,
                timestampAhead
            );

            // Due to the large liquidity in the pool we should be able to call a swap with these values
            const amountOut = parseUnits(100, 18);
            const amountInMax = parseUnits(105, 18);

            // Swap tokens
            await router.swapTokensForExactTokens(
                amountOut,
                amountInMax,
                [nativeAssetAdress, dai.address],
                accounts.account3,
                timestampAhead
            );
            assertBn(
                amountOut,
                await dai.balanceOf(accounts.account3),
                amountOut.div(big(100))
            );
        });

        it("should add liquidity from many accounts and swap for exact tokens from others and evaluate the state", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);

            const { router, factory, mockUsdv, dai } = await deployMock(
                accounts
            );

            // Get the latest block timestamp and add to it
            const latestBlock = await web3.eth.getBlock("latest");
            const timestampAhead = latestBlock.timestamp + 1000;

            // Initialize the factory and get the navite asset address
            await factory.initialize(mockUsdv.address, accounts.dao, {
                from: accounts.administrator,
            });
            const nativeAssetAdress = await factory.nativeAsset();

            // Create pool native asset <-> dai
            await factory.createPool(nativeAssetAdress, dai.address);

            // Get the created pool address
            const poolAddress = await factory.getPool(
                dai.address,
                nativeAssetAdress
            );

            const balance = parseUnits(5000000, 18);

            // Mint some tokens and approve for account0
            await mintAndApprove(
                accounts.account0,
                router.address,
                mockUsdv,
                balance
            );
            await mintAndApprove(
                accounts.account0,
                router.address,
                dai,
                balance
            );

            // Mint some tokens and approve for account1
            await mintAndApprove(
                accounts.account1,
                router.address,
                mockUsdv,
                balance
            );
            await mintAndApprove(
                accounts.account1,
                router.address,
                dai,
                balance
            );

            // Mint some tokens and approve for account2
            await mintAndApprove(
                accounts.account2,
                router.address,
                mockUsdv,
                balance
            );
            await mintAndApprove(
                accounts.account2,
                router.address,
                dai,
                balance
            );

            // Asking for half of the pool
            const amountOut = parseUnits(500, 18);

            const amountInMax = parseUnits(600, 18);

            const liquidity0 = parseUnits(10000, 18);
            const liquidity1 = parseUnits(5000, 18);
            const liquidity2 = parseUnits(22000, 18);
            // Add liquidity
            await router.addLiquidity(
                nativeAssetAdress,
                dai.address,
                liquidity0,
                liquidity0,
                poolAddress,
                timestampAhead
            );

            await router.addLiquidity(
                nativeAssetAdress,
                dai.address,
                liquidity1,
                liquidity1,
                poolAddress,
                timestampAhead,
                { from: accounts.account1 }
            );

            await router.addLiquidity(
                nativeAssetAdress,
                dai.address,
                liquidity2,
                liquidity2,
                poolAddress,
                timestampAhead,
                { from: accounts.account2 }
            );

            // Pre-calculate the amount that swap will cost us
            const amountNeededForSwap = await router.calculateInGivenOut(
                amountOut,
                [nativeAssetAdress, dai.address]
            );

            // Swap tokens
            await router.swapTokensForExactTokens(
                amountOut,
                amountInMax,
                [nativeAssetAdress, dai.address],
                accounts.account3,
                timestampAhead
            );

            // Make sure we got what we wanted from the swap
            const swapedAmount = await dai.balanceOf(accounts.account3);
            assertBn(swapedAmount, amountOut, swapedAmount.div(big(100)));

            // Get the pool object
            const pool = await BasePool.at(poolAddress);

            const reserves = await pool.getReserves();

            const position0 = await pool.positions(0);
            const position1 = await pool.positions(1);
            const position2 = await pool.positions(2);

            // Checks for account0
            assertBn(position0.liquidity, liquidity0);
            assertBn(position0.originalNative, liquidity0);
            assertBn(position0.originalForeign, liquidity0);

            // Checks for account1
            assertBn(position1.liquidity, liquidity1);
            assertBn(position1.originalNative, liquidity1);
            assertBn(position1.originalForeign, liquidity1);

            // Checks for account2
            assertBn(position2.liquidity, liquidity2);
            assertBn(position2.originalNative, liquidity2);
            assertBn(position2.originalForeign, liquidity2);

            // Check the reserves
            assertBn(
                reserves.reserveForeign,
                liquidity0.add(liquidity1.add(liquidity2)).sub(swapedAmount)
            );

            assertBn(
                reserves.reserveNative,
                liquidity0
                    .add(liquidity1.add(liquidity2))
                    .add(amountNeededForSwap)
            );
        });
    });
});
