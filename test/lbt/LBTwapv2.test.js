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
    describe("LBTwap -> Init", () => {
        it("should setup the twap along vader and usdv", async () => {
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

            // Amount to mint approve
            const accountsAmount = parseUnits(1000000, 18);
            const liquidity = parseUnits(10000, 18);

            // Mint and approve all tokens for the router
            await usdv.mint(accountsAmount);
            await usdv.approve(poolV2.address);

            await poolV2.setTokenSupport(
                usdv.address,
                true,
                liquidity,
                liquidity,
                accounts.account0,
                accounts.account0
            );
            await poolV2.setTokenSupport(
                vader.address,
                true,
                liquidity,
                liquidity,
                accounts.account0,
                accounts.account0
            );

            const amountInSwap = parseUnits(10000, 18);
            const amountOutSwap = parseUnits(100, 18);

            const latestBlockNow = await web3.eth.getBlock("latest");
            const deadlineNow = latestBlockNow.timestamp + 1000;

            await routerV2.swapExactTokensForTokens(
                amountInSwap,
                amountOutSwap,
                [usdv.address, vader.address],
                accounts.account1,
                deadlineNow
            );

            // ====== Setup Uniswap pool Vader <-> USDV and add liquidity ======
            await mockUniswapV2Factory.createPair(vader.address, usdv.address);

            const uniswapPairAddress = await mockUniswapV2Factory.getPair(
                vader.address,
                usdv.address
            );
            const uniswapPair = await UniswapV2Pair.at(uniswapPairAddress);

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

            // Time increase
            await time.increaseTo(
                (await time.latest()).add(parseUnits(20000, 0))
            );

            await advanceBlock();

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
        });
    });
});
