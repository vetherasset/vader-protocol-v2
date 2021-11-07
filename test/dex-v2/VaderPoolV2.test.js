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
    Synth,
    LPToken,
} = require("../utils")(artifacts);

contract("VaderPool V2", (accounts) => {
    describe("construction", () => {
        it("should should not allow to construct the singleton pool with bad arguments", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);
            const { poolV2, lpWrapper, synthFactory, routerV2 } = await deployMock(
                accounts
            );

            await assertErrors(
                poolV2.initialize(UNSET_ADDRESS, synthFactory.address, routerV2.address),
                "VaderPoolV2::initialize: Incorrect Wrapper Specified"
            );

            await assertErrors(
                poolV2.initialize(lpWrapper.address, UNSET_ADDRESS, routerV2.address),
                "VaderPoolV2::initialize: Incorrect SynthFactory Specified"
            );

            await assertErrors(
                poolV2.initialize(lpWrapper.address, synthFactory.address, UNSET_ADDRESS),
                "VaderPoolV2::initialize: Incorrect Router Specified"
            );
        });

        it("should construct the singleton pool and check the state", async () => {
            const { poolV2, mockUsdv, lpWrapper, synthFactory, routerV2 } =
                await deployMock();

            await poolV2.initialize(lpWrapper.address, synthFactory.address, routerV2.address);

            assert.equal(await poolV2.queueActive(), true);
            assert.equal(await poolV2.nativeAsset(), await mockUsdv.address);
            assert.equal(await poolV2.wrapper(), lpWrapper.address);
            assert.equal(await poolV2.synthFactory(), synthFactory.address);
            assert.equal(await poolV2.router(), routerV2.address);
        });
    });

    describe("should fail when called by non router address", () => {
        it("VaderPoolV2::burn", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);

            const { poolV2 } = await deployMock(accounts);
            const mockAddress = accounts.account5;

            await assertErrors(
                poolV2.burn(
                    0,
                    mockAddress
                ),
                "BasePoolV2::_onlyRouter: Only Router is allowed to call"
            )
        });
    });

    describe("set support token", () => {
        it("should not allow to add support for a asset if already supported", async () => {
            const { poolV2, dai, token, mockUsdv, erc20Dec8, lpWrapper, synthFactory, routerV2 } =
                await deployMock();

            await poolV2.initialize(lpWrapper.address, synthFactory.address, routerV2.address);
            // Set support for the tokens
            await poolV2.setTokenSupport(dai.address, true);
            await poolV2.setTokenSupport(token.address, true);
            await poolV2.setTokenSupport(mockUsdv.address, true);
            await poolV2.setTokenSupport(erc20Dec8.address, true);

            // Try to set it again
            await assertErrors(
                poolV2.setTokenSupport(dai.address, true),
                "VaderPoolV2::supportToken: Already At Desired State"
            );
        });
    });

    describe("toggle queue", () => {
        it("should now allow to toggle queue from an non owner account", async () => {
            const { poolV2 } = await deployMock();

            await assertErrors(
                poolV2.toggleQueue({ from: accounts.account1 }),
                "Ownable: caller is not the owner"
            );
        });
    });

    describe("mint synth", () => {
        it("should mint some synths and check the state", async () => {
            const { poolV2, dai, mockUsdv, routerV2, synthFactory, erc20Dec8 } =
                await deployMock();

            const amount = parseUnits(100, 18);
            const balance = parseUnits(10000000, 18);

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

            mintAndApprove(
                accounts.account0,
                routerV2.address,
                erc20Dec8,
                balance
            );

            await mockUsdv.approve(poolV2.address, balance);
            await dai.approve(poolV2.address, balance);
            await erc20Dec8.approve(poolV2.address, balance);

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

            // Add liquidity
            await routerV2.addLiquidity(
                mockUsdv.address,
                erc20Dec8.address,
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

            // Mint erc20 8 decimals
            await poolV2.mintSynth(
                erc20Dec8.address,
                amount,
                accounts.account0,
                accounts.account0
            );

            // Get the synths
            const synthDai = await Synth.at(
                await synthFactory.synths(dai.address)
            );

            const synthErc20Dec8 = await Synth.at(
                await synthFactory.synths(await erc20Dec8.address)
            );

            // Check the synths atributes
            assert.equal(await synthDai.name(), "DAI - vSynth");
            assert.equal(await synthDai.symbol(), "DAI.v");
            assert.equal(await synthErc20Dec8.name(), "DEC8 - vSynth");
            assert.equal(await synthErc20Dec8.symbol(), "DEC8.v");

            // Check if the states are valid
            assert.equal(await synthDai.owner(), await poolV2.address);
            assertBn(
                await synthDai.balanceOf(accounts.account0),
                await synthDai.totalSupply()
            );
            assertBn(
                await synthErc20Dec8.balanceOf(accounts.account0),
                await synthErc20Dec8.totalSupply()
            );
        });
    });

    describe("burn synth", () => {
        it("should not allow burning with inexistant token", async () => {
            const { poolV2, token } = await deployMock();

            const amount = parseUnits(50, 18);
            await assertErrors(
                poolV2.burnSynth(token.address, amount, accounts.account0),
                "VaderPoolV2::burnSynth: Inexistent Synth"
            );
        });

        it("should not allow burning with zero amount token", async () => {
            const { poolV2, dai } = await deployMock();

            const amount = parseUnits(0, 18);
            await assertErrors(
                poolV2.burnSynth(dai.address, amount, accounts.account0),
                "VaderPoolV2::burnSynth: Insufficient Synth Amount"
            );
        });

        it("should not allow burning with bad to address", async () => {
            const { poolV2, dai, synthFactory } = await deployMock();

            // Approve amount for synthDai
            const approveAmount = parseUnits(1000000, 18);

            // Get the synth
            const synthDai = await Synth.at(
                await synthFactory.synths(dai.address)
            );

            // Approve the pool for synthDai
            await synthDai.approve(poolV2.address, approveAmount);

            const amount = parseUnits(20, 18);

            await assertErrors(
                poolV2.burnSynth(dai.address, amount, UNSET_ADDRESS),
                "ERC20: transfer to the zero address"
            );
        });

        it("should burn portion of the synth and check the state", async () => {
            const { poolV2, dai, synthFactory } = await deployMock();
            // Portion of the synth
            const amount = parseUnits(50, 18);

            // Get the synth
            const synthDai = await Synth.at(
                await synthFactory.synths(dai.address)
            );

            // Get account0 current synth dai balance before partial burn
            const currentDaiSynthBalance = await synthDai.balanceOf(
                accounts.account0
            );

            // Burn portion of the synth
            await poolV2.burnSynth(dai.address, amount, accounts.account2);

            const daiSynthBalanceAfterPartialBurn = await synthDai.balanceOf(
                accounts.account0
            );

            // Check that we still have the synth
            assert.notEqual(synthFactory.synths(dai.address), UNSET_ADDRESS);

            // Check if the state is valid
            assertBn(
                daiSynthBalanceAfterPartialBurn,
                currentDaiSynthBalance.sub(amount)
            );
            assertBn(
                await synthDai.totalSupply(),
                currentDaiSynthBalance.sub(amount)
            );
        });

        it("should burn whole synth and check the state", async () => {
            const { poolV2, dai, synthFactory } = await deployMock();

            const approveAmount = parseUnits(1000000, 18);

            // Get the synth
            const synthDai = await Synth.at(
                await synthFactory.synths(dai.address)
            );

            const synthDaiBalance = await synthDai.balanceOf(accounts.account0);

            // Approve the pool for synthDai
            await synthDai.approve(poolV2.address, approveAmount);

            // Burn the synth
            await poolV2.burnSynth(
                dai.address,
                synthDaiBalance,
                accounts.account2
            );

            // Check that we still have the synth
            assert.notEqual(
                await synthFactory.synths(dai.address),
                UNSET_ADDRESS
            );

            // Check that state is valid
            assertBn(await synthDai.totalSupply(), 0);
            assertBn(await synthDai.balanceOf(accounts.account0), 0);
        });
    });

    describe("mint fungible", () => {
        it("should not allow to mint fungible with unsupported token", async () => {
            const { poolV2, maliciousToken } = await deployMock();

            const amount = parseUnits(100, 18);

            await assertErrors(
                poolV2.mintFungible(
                    maliciousToken.address,
                    amount,
                    amount,
                    accounts.account0,
                    accounts.account0
                ),
                "VaderPoolV2::mintFungible: Unsupported Token"
            );
        });

        it("should mint fungible tokens and check the state", async () => {
            const { poolV2, dai, lpWrapper, erc20Dec8, synthFactory } =
                await deployMock();

            const amount = parseUnits(100, 18);
            const approveAmount = parseUnits(1000000, 18);

            // Mint dai synth
            await poolV2.mintSynth(
                dai.address,
                amount,
                accounts.account0,
                accounts.account0
            );

            // Mint ERC20 8 decimals
            await poolV2.mintSynth(
                erc20Dec8.address,
                amount,
                accounts.account0,
                accounts.account0
            );

            // Get the synth
            const synthErc20Dec8 = await Synth.at(
                await synthFactory.synths(dai.address)
            );

            // Approve the pool
            await synthErc20Dec8.approve(poolV2.address, approveAmount);

            // Set support for tokens
            await poolV2.setFungibleTokenSupport(dai.address);
            await poolV2.setFungibleTokenSupport(erc20Dec8.address);

            // Mint the synths
            await poolV2.mintFungible(
                dai.address,
                amount,
                amount,
                accounts.account0,
                accounts.account0
            );

            await poolV2.mintFungible(
                erc20Dec8.address,
                amount,
                amount,
                accounts.account0,
                accounts.account0
            );

            // Get the lps
            const lpDai = await LPToken.at(await lpWrapper.tokens(dai.address));
            const lpDec8 = await LPToken.at(
                await lpWrapper.tokens(erc20Dec8.address)
            );

            // Approve the pool on the lps
            await lpDai.approve(poolV2.address, approveAmount);
            await lpDec8.approve(poolV2.address, approveAmount);

            // Check the lp atributes
            assert.equal(await lpDai.name(), "DAI - USDV LP");
            assert.equal(await lpDai.symbol(), "V(DAI|USDV)");
            assert.equal(await lpDec8.name(), "DEC8 - USDV LP");
            assert.equal(await lpDec8.symbol(), "V(DEC8|USDV)");

            // We already have a 10000 allocation
            const allocation = parseUnits(10000, 18);

            // Check if the states are valid
            assert.equal(await lpDai.owner(), await poolV2.address);
            assert.equal(await lpDec8.owner(), await poolV2.address);
            assertBn(
                allocation.add(await lpDai.balanceOf(accounts.account0)),
                await lpDai.totalSupply()
            );
            assertBn(
                allocation.add(await lpDec8.balanceOf(accounts.account0)),
                await lpDec8.totalSupply()
            );
        });
    });

    describe("burn fungible", () => {
        it("should not allow to burn fungible with unsupported token", async () => {
            const { poolV2, maliciousToken } = await deployMock();

            const amount = parseUnits(100, 18);

            await assertErrors(
                poolV2.burnFungible(
                    maliciousToken.address,
                    amount,
                    accounts.account0
                ),
                "VaderPoolV2::burnFungible: Unsupported Token"
            );
        });

        it("should burn portion of fungible tokens and check the state", async () => {
            const { poolV2, dai, erc20Dec8, lpWrapper, synthFactory } =
                await deployMock();

            const portion = parseUnits(50, 18);

            // Get the synths
            const synthDai = await Synth.at(
                await synthFactory.synths(dai.address)
            );
            const synthErc20Dec8 = await Synth.at(
                await synthFactory.synths(dai.address)
            );

            // Get current synth state
            const currentSynthDai = await synthDai.balanceOf(accounts.account0);
            const currentSynthDaiTotalSupply = await synthDai.totalSupply();
            const currentSynthDec8 = await synthErc20Dec8.balanceOf(
                accounts.account0
            );
            const currentSynthDec8TotalSupply =
                await synthErc20Dec8.totalSupply();

            // Get the lps
            const lpDai = await LPToken.at(await lpWrapper.tokens(dai.address));
            const lpDec8 = await LPToken.at(
                await lpWrapper.tokens(erc20Dec8.address)
            );

            // Get current lps state
            const currentLPDai = await lpDai.balanceOf(accounts.account0);
            const currentLPDec8 = await lpDec8.balanceOf(accounts.account0);
            const currentLPDaiTotalSupply = await lpDai.totalSupply();
            const currentLPDec8TotalSupply = await lpDec8.totalSupply();

            await poolV2.burnFungible(dai.address, portion, accounts.account0);
            await poolV2.burnFungible(
                erc20Dec8.address,
                portion,
                accounts.account0
            );

            // Checks all states
            // Synth state should stay as before
            assertBn(
                await synthDai.balanceOf(accounts.account0),
                currentSynthDai
            );
            assertBn(await synthDai.totalSupply(), currentSynthDaiTotalSupply);

            assertBn(
                await synthErc20Dec8.balanceOf(accounts.account0),
                currentSynthDec8
            );
            assertBn(
                await synthErc20Dec8.totalSupply(),
                currentSynthDec8TotalSupply
            );

            // LPs state should properly mutate
            assertBn(
                await lpDai.balanceOf(accounts.account0),
                currentLPDai.sub(portion)
            );
            assertBn(
                await lpDai.totalSupply(),
                currentLPDaiTotalSupply.sub(portion)
            );

            assertBn(
                await lpDec8.balanceOf(accounts.account0),
                currentLPDec8.sub(portion)
            );
            assertBn(
                await lpDec8.totalSupply(),
                currentLPDec8TotalSupply.sub(portion)
            );
        });
    });
});
