const {
    // Deployment Function
    deployMock,

    // Testing Utilities
    assertBn,
    assertErrors,
    assertEvents,
    UNSET_ADDRESS,
    parseUnits,

    // Library Functions
    verboseAccounts,
    MockAggregatorV3,
    UniswapV2Pair,
    mintAndApprove,

    // Project Specific Constants
    PROJECT_CONSTANTS,
} = require("../utils")(artifacts);

const { time } = require("@openzeppelin/test-helpers");
const { advanceBlock } = require("@openzeppelin/test-helpers/src/time");

const keccak256 = require("keccak256");
const { MerkleTree } = require("merkletreejs");

const salt = 123;
const chainId = 1337;

contract("LBTwap", (accounts) => {
    describe("LBTwap -> construction", () => {
        it("should not allow construction of the twap with bad arguments", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);

            await assertErrors(
                deployMock(accounts, {
                    LBTwap: (_, { poolV2 }) => [UNSET_ADDRESS, poolV2.address],
                }),
                "LBTWAP::construction: Zero Address"
            );

            await assertErrors(
                deployMock(accounts, {
                    LBTwap: (_, { vader }) => [vader.address, UNSET_ADDRESS],
                }),
                "LBTWAP::construction: Zero Address"
            );
        });

        it("should construct the LBTwap and check the state", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);

            const { lbtwap, vader, usdv, poolV2 } = await deployMock(accounts);

            assert.equal(await lbtwap.vader(), await vader.address);
            assert.equal(await lbtwap.usdv(), await usdv.address);
            assert.equal(await lbtwap.vaderPool(), await poolV2.address);
        });

        it("should setup the vader usdv pair and perform various swaps", async () => {
            // Snapshot Mock Start //
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);
            const { mockMTree } = await deployMock(accounts);

            const vetherSnapShotAmount = parseUnits(10000, 18);

            // Create the data for the proof
            const data = await mockMTree.getRoot(
                accounts.account0,
                vetherSnapShotAmount,
                salt,
                chainId
            );

            // Construct the tree
            const tree = new MerkleTree([data], keccak256, {
                hashLeaves: true,
                sortPairs: true,
            });

            // Get the leaf
            const leaf = keccak256(data);

            // Get the leaf proof
            const proof = tree.getHexProof(leaf);

            // Get the root
            const merkelRoot = tree.getHexRoot();

            // Snapshot Mock End //

            const {
                lbtwap,
                vader,
                mockUniswapV2Factory,
                usdv,
                lpWrapper,
                routerV2,
                poolV2,
                synthFactory,
                converter,
                vesting,
                vether,
                reserve,
                token,
                ADMINISTRATOR,
            } = await deployMock(accounts, {
                Converter: (_, { vader, vether, ADMINISTRATOR }) => [
                    vether.address,
                    vader.address,
                    merkelRoot,
                    salt,
                    ADMINISTRATOR,
                ],
            });

            // Set vesting address
            await converter.setVesting(vesting.address, {
                from: ADMINISTRATOR.from,
            });

            await usdv.initialize(lbtwap.address, { from: ADMINISTRATOR.from });

            await reserve.initialize(
                lbtwap.address,
                routerV2.address,
                accounts.dao
            );

            const { TEAM_ALLOCATION } = PROJECT_CONSTANTS;

            // Set the values for converter, vesting and usdv
            await vader.setComponents(
                converter.address,
                vesting.address,
                [accounts.account1],
                [TEAM_ALLOCATION],
                ADMINISTRATOR
            );

            // Set the usdv from the owner account
            await vader.setUSDV(usdv.address, { from: ADMINISTRATOR.from });

            // Make the vether available
            await vether.mint(accounts.account0, vetherSnapShotAmount);
            await vether.approve(converter.address, vetherSnapShotAmount, {
                from: accounts.account0,
            });

            // Perfom the conversion
            await converter.convert(proof, vetherSnapShotAmount, 100);

            // Initialize the pool
            await poolV2.initialize(
                lpWrapper.address,
                synthFactory.address,
                routerV2.address
            );

            // Construct the deadline
            const latestBlock = await web3.eth.getBlock("latest");
            const deadline = latestBlock.timestamp + 1000;

            // Amount to mint approve
            const accountsAmount = parseUnits(100000000, 18);

            const liquidity = parseUnits(10000, 18);

            // ====== Setup Uniswap pool Vader <-> USDV and add liquidity ======
            await mockUniswapV2Factory.createPair(vader.address, usdv.address);

            const uniswapPairAddress = await mockUniswapV2Factory.getPair(
                vader.address,
                usdv.address
            );
            const uniswapPair = await UniswapV2Pair.at(uniswapPairAddress);

            // // Amounts
            // const amountInSwap = parseUnits(10000, 18);
            // const amountOutSwap = parseUnits(50, 18);
            // // Swap Tokens
            // await routerV2.swapExactTokensForTokens(
            //     amountInSwap,
            //     amountOutSwap,
            //     [usdv.address, vader.address],
            //     accounts.account1,
            //     deadline
            // );

            // 1 USDV = $1 - 1 Vader = $2
            const usdvAggregator = await MockAggregatorV3.new(
                usdv.address,
                parseUnits(1, 8)
            );
            const vaderAggregator = await MockAggregatorV3.new(
                vader.address,
                parseUnits(2, 8)
            );

            // Setup vader and vader usdv pair
            await lbtwap.setupVader(
                uniswapPair.address,
                vaderAggregator.address,
                100,
                parseUnits(2, 8)
            );

            await lbtwap.addVaderPair(
                uniswapPair.address,
                usdvAggregator.address,
                100
            );

            // Setup usdv and usdv vader pair
            await lbtwap.setupUSDV(
                vader.address,
                usdvAggregator.address,
                100,
                parseUnits(1, 8)
            );

            await lbtwap.addUSDVPair(
                vader.address,
                vaderAggregator.address,
                100
            );

            // Mint and approve all tokens for the router
            await usdv.mint(accountsAmount);
            await usdv.approve(poolV2.address);

            await mintAndApprove(
                accounts.account0,
                poolV2.address,
                token,
                accountsAmount
            );

            await vader.approve(uniswapPair.address, liquidity);
            await usdv.approve(uniswapPair.address, liquidity);

            await vader.transfer(uniswapPair.address, liquidity);
            await usdv.transfer(uniswapPair.address, liquidity);

            await uniswapPair.mint(accounts.account0);

            // Approve all needed contracts
            await vader.approve(poolV2.address, accountsAmount);
            await vader.approve(routerV2.address, accountsAmount);
            await usdv.approve(routerV2.address, accountsAmount);
            await token.approve(routerV2.address, accountsAmount);

            // Set the supported tokens
            await poolV2.setTokenSupport(
                vader.address,
                true,
                liquidity,
                liquidity,
                accounts.account0,
                accounts.account0
            );
            await poolV2.setTokenSupport(
                token.address,
                true,
                liquidity.mul(parseUnits(4000, 0)),
                liquidity,
                accounts.account0,
                accounts.account0
            );

            // // Add liquidity
            // await routerV2.addLiquidity(
            //     vader.address,
            //     usdv.address,
            //     liquidity,
            //     liquidity,
            //     accounts.account0,
            //     deadline
            // );

            // await routerV2.addLiquidity(
            //     usdv.address,
            //     token.address,
            //     liquidity.mul(parseUnits(4000, 0)),
            //     liquidity,
            //     accounts.account0,
            //     deadline
            // );

            // Time increase
            await time.increaseTo(
                (await time.latest()).add(parseUnits(20000, 0))
            );

            await advanceBlock();

            await lbtwap.getVaderPrice();

            const latestBlockNow = await web3.eth.getBlock("latest");
            const deadlineNow = latestBlockNow.timestamp + 1000;

            await routerV2.swapExactTokensForTokens(
                amountInSwap,
                amountOutSwap,
                [vader.address, usdv.address],
                accounts.account2,
                deadlineNow
            );

            const swap1 = await usdv.balanceOf(accounts.account2);

            console.log("Swap 1  10000 Vader to USDV: ", swap1.toString());
            const pricePerCoinSwap1 = swap1 / amountInSwap;
            console.log(
                "Swap 1 price per coin : ",
                pricePerCoinSwap1.toString()
            );

            await routerV2.swapExactTokensForTokens(
                amountInSwap,
                amountOutSwap,
                [vader.address, usdv.address],
                accounts.account3,
                deadlineNow
            );

            const swap2 = await usdv.balanceOf(accounts.account3);

            console.log("Swap 2  10000 Vader to USDV: ", swap2.toString());
            const pricePerCoinSwap2 = swap2 / amountInSwap;
            console.log(
                "Swap 2 price per coin : ",
                pricePerCoinSwap2.toString()
            );

            await routerV2.swapExactTokensForTokens(
                parseUnits(100000, 18),
                amountOutSwap,
                [vader.address, usdv.address],
                accounts.account4,
                deadlineNow
            );

            const swap3 = await usdv.balanceOf(accounts.account4);

            console.log("Swap 3 100000 Vader to USDV: ", swap3.toString());

            const pricePerCoinSwap3 = swap3 / parseUnits(100000, 18);
            console.log(
                "Swap 3 price per coin : ",
                pricePerCoinSwap3.toString()
            );

            await routerV2.swapExactTokensForTokens(
                parseUnits(100000, 18),
                amountOutSwap,
                [usdv.address, vader.address],
                accounts.account5,
                deadlineNow
            );

            const swap4 = await vader.balanceOf(accounts.account5);

            console.log("Swap 4 100000 USDV to Vader: ", swap4.toString());

            const pricePerCoinSwap4 = swap4 / parseUnits(100000, 18);
            console.log(
                "Swap 4 price per coin : ",
                pricePerCoinSwap4.toString()
            );

            await routerV2.swapExactTokensForTokens(
                parseUnits(100000, 18),
                amountOutSwap,
                [usdv.address, vader.address],
                accounts.account6,
                deadlineNow
            );

            const swap5 = await vader.balanceOf(accounts.account6);

            console.log("Swap 5 100000 USDV to Vader: ", swap5.toString());

            const pricePerCoinSwap5 = swap5 / parseUnits(100000, 18);
            console.log(
                "Swap 5 price per coin : ",
                pricePerCoinSwap5.toString()
            );

            const tokenAggregator = await MockAggregatorV3.new(
                token.address,
                parseUnits(4000, 8)
            );

            await mockUniswapV2Factory.createPair(usdv.address, token.address);

            const tokenUniswapPairAddress = await mockUniswapV2Factory.getPair(
                usdv.address,
                token.address
            );

            const tokenUniswapPair = await UniswapV2Pair.at(
                tokenUniswapPairAddress
            );

            await token.approve(tokenUniswapPair.address, liquidity);
            await usdv.approve(tokenUniswapPair.address, liquidity);

            await usdv.transfer(tokenUniswapPair.address, liquidity);
            await token.transfer(tokenUniswapPair.address, liquidity);

            await tokenUniswapPair.mint(accounts.account0);

            await lbtwap.addUSDVPair(
                token.address,
                tokenAggregator.address,
                100
            );

            // Time increase
            await time.increaseTo(
                (await time.latest()).add(parseUnits(20000, 0))
            );

            await advanceBlock();

            const latestBlockF = await web3.eth.getBlock("latest");
            const deadlineNowF = latestBlockF.timestamp + 1000;

            const amountToSwapF = parseUnits(4000, 18);

            await routerV2.swapExactTokensForTokens(
                amountToSwapF,
                parseUnits(5, 17),
                [usdv.address, token.address],
                accounts.account1,
                deadlineNowF
            );

            const swaptoken = await token.balanceOf(accounts.account1);

            console.log("Swaped 4000 USDV for tokens : ", swaptoken.toString());
            const pricePerCoinSwapToken1 = swaptoken / amountToSwapF;
            console.log(
                "Token price per coin : ",
                pricePerCoinSwapToken1.toString()
            );

            await lbtwap.getUSDVPrice();

            const usdvPrice = await lbtwap.getStaleUSDVPrice();
            console.log("Stale USDV Price  : ", usdvPrice.toString());

            const vaderPrice = await lbtwap.getStaleVaderPrice();
            console.log("Stale Vader Price : ", vaderPrice.toString());

            console.log(
                "Token Price : ",
                (await lbtwap.getChainlinkPrice(token.address)).toString()
            );

            console.log(
                "Vader Price : ",
                (await lbtwap.getChainlinkPrice(vader.address)).toString()
            );

            console.log(
                "USDV Price  : ",
                (await lbtwap.getChainlinkPrice(usdv.address)).toString()
            );
        });

        it("should add a usdv pair, swap against dai and check the state", async () => {
            const {
                usdv,
                routerV2,
                poolV2,
                dai,
                mockUniswapV2Factory,
                lbtwap,
            } = await deployMock();

            const OneMillion = parseUnits(1000000, 18);

            const liquidity = parseUnits(100000, 18);

            await mintAndApprove(
                accounts.account0,
                poolV2.address,
                dai,
                OneMillion
            );

            await dai.approve(routerV2.address, OneMillion);

            const daiAggregator = await MockAggregatorV3.new(
                dai.address,
                parseUnits(1, 8)
            );

            const latestBlock = await web3.eth.getBlock("latest");
            const deadline = latestBlock.timestamp + 1000;

            await poolV2.setTokenSupport(
                dai.address,
                true,
                liquidity,
                liquidity,
                accounts.account0,
                accounts.account0
            );

            // await routerV2.addLiquidity(
            //     usdv.address,
            //     dai.address,
            //     liquidity,
            //     liquidity,
            //     accounts.account0,
            //     deadline
            // );

            await mockUniswapV2Factory.createPair(usdv.address, dai.address);

            const usdvDaiUniswapPair = await mockUniswapV2Factory.getPair(
                usdv.address,
                dai.address
            );

            const uniswapPair = await UniswapV2Pair.at(usdvDaiUniswapPair);

            await dai.approve(uniswapPair.address, OneMillion);
            await usdv.approve(uniswapPair.address, OneMillion);

            await usdv.transfer(uniswapPair.address, liquidity);
            await dai.transfer(uniswapPair.address, liquidity);

            await uniswapPair.mint(accounts.account0);

            await lbtwap.addUSDVPair(dai.address, daiAggregator.address, 100);

            await mintAndApprove(
                accounts.account1,
                poolV2.address,
                usdv,
                OneMillion,
                { from: accounts.account1 }
            );

            await usdv.approve(routerV2.address, OneMillion, {
                from: accounts.account1,
            });

            const amountInSwap = parseUnits(10000, 18);
            const amountOutSwap = parseUnits(100, 18);

            const latestBlockNow = await web3.eth.getBlock("latest");
            const deadlineNow = latestBlockNow.timestamp + 1000;

            await routerV2.swapExactTokensForTokens(
                amountInSwap,
                amountOutSwap,
                [usdv.address, dai.address],
                accounts.account2,
                deadlineNow,
                { from: accounts.account1 }
            );

            const swapedDai = await dai.balanceOf(accounts.account2);

            console.log("Dai Swap Amount : ", swapedDai.toString());

            console.log(
                "Price per coin : ",
                (swapedDai / amountInSwap).toString()
            );
        });

        it("should add a usdv pair, swap against mock token and check the state", async () => {
            const {
                usdv,
                routerV2,
                poolV2,
                mockUniswapV2Factory,
                lbtwap,
                token,
            } = await deployMock();

            const OneMillion = parseUnits(1000000, 18);

            const liquidity = parseUnits(10000, 18);

            await mintAndApprove(
                accounts.account0,
                poolV2.address,
                token,
                OneMillion
            );

            await token.approve(routerV2.address, OneMillion);

            const tokenAggregator = await MockAggregatorV3.new(
                token.address,
                parseUnits(4000, 8)
            );

            const latestBlock = await web3.eth.getBlock("latest");
            const deadline = latestBlock.timestamp + 1000;

            await routerV2.addLiquidity(
                usdv.address,
                token.address,
                liquidity.mul(parseUnits(4000, 0)),
                liquidity,
                accounts.account0,
                deadline
            );

            const usdvTokenUniswapPair = await mockUniswapV2Factory.getPair(
                usdv.address,
                token.address
            );

            const uniswapPair = await UniswapV2Pair.at(usdvTokenUniswapPair);

            await token.approve(uniswapPair.address, OneMillion);
            await usdv.approve(uniswapPair.address, OneMillion);

            await usdv.transfer(uniswapPair.address, liquidity);
            await token.transfer(uniswapPair.address, liquidity);

            await uniswapPair.mint(accounts.account0);

            await lbtwap.addUSDVPair(
                token.address,
                tokenAggregator.address,
                100
            );

            await mintAndApprove(
                accounts.account3,
                poolV2.address,
                usdv,
                OneMillion,
                { from: accounts.account3 }
            );

            await usdv.approve(routerV2.address, OneMillion, {
                from: accounts.account3,
            });

            const amountInSwap = parseUnits(10000, 18);
            const amountOutSwap = parseUnits(5, 17);

            const latestBlockNow = await web3.eth.getBlock("latest");
            const deadlineNow = latestBlockNow.timestamp + 1000;

            await routerV2.swapExactTokensForTokens(
                amountInSwap,
                amountOutSwap,
                [usdv.address, token.address],
                accounts.account4,
                deadlineNow,
                { from: accounts.account3 }
            );

            const swapedToken = await token.balanceOf(accounts.account4);

            console.log("Token Swap Amount : ", swapedToken.toString());

            const swaped = amountInSwap.toString() / swapedToken.toString();

            console.log("Price per coin : ", swaped.toString());
        });

        it("should add a vader pair, swap against mock token and check the state", async () => {
            const {
                routerV2,
                poolV2,
                mockUniswapV2Factory,
                lbtwap,
                token,
                vader,
                usdv,
            } = await deployMock();

            const OneMillion = parseUnits(1000000, 18);

            const liquidity = parseUnits(100000, 18);

            await mintAndApprove(
                accounts.account0,
                poolV2.address,
                token,
                OneMillion
            );

            await token.approve(routerV2.address, OneMillion);

            const tokenAggregator = await MockAggregatorV3.new(
                token.address,
                parseUnits(4000, 8)
            );

            await mockUniswapV2Factory.createPair(vader.address, token.address);

            const vaderTokenUniswapPair = await mockUniswapV2Factory.getPair(
                vader.address,
                token.address
            );

            const uniswapPair = await UniswapV2Pair.at(vaderTokenUniswapPair);

            await token.approve(uniswapPair.address, OneMillion);
            await vader.approve(uniswapPair.address, OneMillion);

            await vader.transfer(uniswapPair.address, liquidity);
            await token.transfer(uniswapPair.address, liquidity);

            await uniswapPair.mint(accounts.account0);

            await lbtwap.addVaderPair(
                uniswapPair.address,
                tokenAggregator.address,
                100
            );

            const amountInSwap = parseUnits(10000, 18);
            const amountOutSwap = parseUnits(5, 17);

            const latestBlockNow = await web3.eth.getBlock("latest");
            const deadlineNow = latestBlockNow.timestamp + 1000;

            await routerV2.swapExactTokensForTokens(
                amountInSwap,
                amountOutSwap,
                [vader.address, usdv.address, token.address],
                accounts.account5,
                deadlineNow
            );

            const swapedToken = await token.balanceOf(accounts.account5);

            console.log("Token Swap Amount : ", swapedToken.toString());

            const swapAmount = amountInSwap.toString() / swapedToken.toString();

            console.log("Price per coin : ", swapAmount);
        });
    });
});
