const { time } = require("@openzeppelin/test-helpers");
const {
    // Deployment Function
    deployMock,

    // Testing Utilities
    assertErrors,
    assertBn,

    // Project Specific Constants
    UNSET_ADDRESS,

    // Library Functions
    verboseAccounts,
    big,
    parseUnits,
} = require("../utils")(artifacts);

const { advanceBlockToVotingPeriodEnd, getTxHash } = require("./helpers")({
    artifacts,
    parseUnits,
    big,
});

contract("GovernorAlpha state change tests", (accounts) => {
    before(async function () {
        if (Array.isArray(accounts)) accounts = await verboseAccounts(accounts);

        const { governorAlpha, timelock, mockUSDV } = await deployMock(
            accounts
        );
        await governorAlpha.setTimelock(timelock.address);

        const { governorAlpha: governorAlphaTwo } = await deployMock(accounts);
        await governorAlphaTwo.setTimelock(timelock.address);

        this.governorAlpha = governorAlpha;
        this.timelock = timelock;
        this.eta = big((await web3.eth.getBlock("latest")).timestamp).add(
            big(12).mul(big(60))
        ); // eta is 12 minutes
        this.governorAlphaTwo = governorAlphaTwo;
        this.mockUSDV = mockUSDV;
    });

    describe("changeFeeReceiver", () => {
        it("non-guardian should fail to call", async function () {
            await assertErrors(
                this.governorAlpha.changeFeeReceiver(accounts.account1, {
                    from: accounts.account1,
                }),
                "only guardian can call"
            );
        });

        it("guardian should successfully call", async function () {
            await this.governorAlpha.changeFeeReceiver(accounts.account1);

            assert.equal(
                await this.governorAlpha.feeReceiver(),
                accounts.account1
            );
        });
    });

    describe("changeFeeAmount", () => {
        it("non-guardian should fail to call", async function () {
            await assertErrors(
                this.governorAlpha.changeFeeAmount(parseUnits(10000, 18), {
                    from: accounts.account1,
                }),
                "only guardian can call"
            );
        });

        it("guardian should successfully call", async function () {
            await this.governorAlpha.changeFeeAmount(parseUnits(10000, 18));

            assertBn(
                await this.governorAlpha.feeAmount(),
                parseUnits(10000, 18)
            );
        });
    });

    describe("__queueSetTimelockPendingAdmin", () => {
        it("non-guardian should fail to call", async function () {
            await assertErrors(
                this.governorAlpha.__queueSetTimelockPendingAdmin(
                    this.governorAlphaTwo.address,
                    this.eta,
                    {
                        from: accounts.account1,
                    }
                ),
                "only guardian can call"
            );
        });

        it("guardian should successfully call", async function () {
            await this.governorAlpha.__queueSetTimelockPendingAdmin(
                this.governorAlphaTwo.address,
                this.eta
            );

            const txHash = getTxHash([
                this.timelock.address,
                0,
                "setPendingAdmin(address)",
                web3.eth.abi.encodeParameters(
                    ["address"],
                    [this.governorAlphaTwo.address]
                ),
                this.eta,
            ]);

            assert.equal(await this.timelock.queuedTransactions(txHash), true);
        });
    });

    describe("__executeSetTimelockPendingAdmin", () => {
        it("non-guardian should fail to call", async function () {
            await assertErrors(
                this.governorAlpha.__executeSetTimelockPendingAdmin(
                    this.governorAlphaTwo.address,
                    this.eta,
                    {
                        from: accounts.account1,
                    }
                ),
                "only guardian can call"
            );
        });

        it("guardian should successfully call", async function () {
            await time.increaseTo(this.eta);

            await this.governorAlpha.__executeSetTimelockPendingAdmin(
                this.governorAlphaTwo.address,
                this.eta
            );
        });
    });

    describe("__acceptAdmin", () => {
        it("non-guardian should fail to call", async function () {
            await assertErrors(
                this.governorAlphaTwo.__acceptAdmin({
                    from: accounts.account1,
                }),
                "only guardian can call"
            );
        });

        it("guardian should successfully call", async function () {
            await this.governorAlphaTwo.__acceptAdmin();

            assert.equal(
                await this.timelock.admin(),
                this.governorAlphaTwo.address
            );
        });
    });

    describe("__abdicate", () => {
        it("non-guardian should fail to call", async function () {
            await assertErrors(
                this.governorAlpha.__abdicate({
                    from: accounts.account1,
                }),
                "only guardian can call"
            );
        });

        it("guardian should successfully call", async function () {
            await this.governorAlpha.__abdicate();

            assert.equal(await this.governorAlpha.guardian(), UNSET_ADDRESS);
        });
    });

    describe("changeCouncil", () => {
        it("non-timelock should fail to call", async function () {
            await assertErrors(
                this.governorAlpha.changeCouncil(accounts.account1),
                "only timelock can call"
            );
        });

        it("time lock successfully changes council", async () => {
            const proposalId = big(1);
            const { governorAlpha, timelock, mockUSDV } = await deployMock(
                accounts
            );
            await governorAlpha.setTimelock(timelock.address);

            await mockUSDV.mint(accounts.account0, parseUnits(1000, 18));
            await mockUSDV.approve(governorAlpha.address, parseUnits(1000, 18));

            const calldata = governorAlpha.contract.methods[
                "changeCouncil(address)"
            ](accounts.account1).encodeABI();

            await governorAlpha.propose(
                [governorAlpha.address],
                [0],
                [""],
                [calldata],
                "change council address"
            );

            await time.advanceBlockTo(
                (await web3.eth.getBlock("latest")).number + 1
            );

            await governorAlpha.castVote(proposalId, true);

            await advanceBlockToVotingPeriodEnd({
                governorAlpha,
            });

            await governorAlpha.queue(proposalId);

            // increase time pass eta
            await time.increaseTo(
                big((await web3.eth.getBlock("latest")).timestamp).add(
                    big(16).mul(big(60))
                )
            );

            await governorAlpha.execute(proposalId);

            assert.equal(await governorAlpha.council(), accounts.account1);
        });
    });
});
