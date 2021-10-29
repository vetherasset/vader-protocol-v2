const { time } = require("@openzeppelin/test-helpers");

const {
    // Deployment Function
    deployMock,

    // Testing Utilities
    assertErrors,
    assertEvents,
    assertBn,

    // Library Functions
    verboseAccounts,
    big,
    parseUnits,
} = require("../utils")(artifacts);

const {
    prepareTargetsAndData,
    advanceBlockToVotingPeriodEnd,
    proposalFee,
    description,
} = require("./helpers")({
    artifacts,
    parseUnits,
    big,
});

const proposalId = big(1);

contract("GovernorAlpha.queue", (accounts) => {
    before(async function () {
        if (Array.isArray(accounts)) accounts = await verboseAccounts(accounts);

        const { governorAlpha, timelock, mockUSDV } = await deployMock(
            accounts
        );

        const { targetsData } = await prepareTargetsAndData({
            timelock,
            deploy: true,
        });

        await mockUSDV.mint(accounts.account0, proposalFee);
        await mockUSDV.approve(governorAlpha.address, proposalFee);

        const { signatures, targetAddresses, values, calldatas } = targetsData;

        await governorAlpha.propose(
            targetAddresses,
            values,
            signatures,
            calldatas,
            description
        );

        await time.advanceBlockTo(
            (await web3.eth.getBlock("latest")).number + 1
        );

        await governorAlpha.castVote(proposalId, true);

        this.governorAlpha = governorAlpha;
        this.mockUSDV = mockUSDV;
    });

    it("fails when for-votes are less than or equal to-against votes", async function () {
        await this.governorAlpha.castVote(proposalId, false, {
            from: accounts.account1,
        });

        await advanceBlockToVotingPeriodEnd({
            governorAlpha: this.governorAlpha,
        });

        await assertErrors(
            this.governorAlpha.queue(proposalId),
            "GovernorAlpha::queue: proposal can only be queued if it is succeeded"
        );
    });

    it("fails when for-votes are less than quorum required", async function () {
        await this.mockUSDV.mint(accounts.account0, parseUnits(500000, 18));

        await advanceBlockToVotingPeriodEnd({
            governorAlpha: this.governorAlpha,
        });

        await assertErrors(
            this.governorAlpha.queue(proposalId),
            "GovernorAlpha::queue: proposal can only be queued if it is succeeded"
        );
    });

    it("should not queue a defeated proposal", async () => {
        const proposalTwoId = big(2);
        const { governorAlpha, timelock, mockUSDV } = await deployMock();
        await governorAlpha.setTimelock(timelock.address);

        const { targetsData } = await prepareTargetsAndData({
            timelock,
        });

        await mockUSDV.mint(accounts.account0, proposalFee);
        await mockUSDV.approve(governorAlpha.address, proposalFee);

        const { signatures, targetAddresses, values, calldatas } = targetsData;

        await governorAlpha.propose(
            targetAddresses,
            values,
            signatures,
            calldatas,
            description
        );

        await time.advanceBlockTo(
            (await web3.eth.getBlock("latest")).number + 1
        );

        await governorAlpha.castVote(proposalTwoId, false);

        await advanceBlockToVotingPeriodEnd({
            governorAlpha,
        });

        assertBn(
            await governorAlpha.state(proposalTwoId),
            big(artifacts.require("GovernorAlpha").ProposalState.Defeated)
        );

        await assertErrors(
            governorAlpha.queue(proposalTwoId),
            "GovernorAlpha::queue: proposal can only be queued if it is succeeded"
        );
    });

    it("test an expired proposal after it is queued", async () => {
        const { governorAlpha, timelock, mockUSDV } = await deployMock(
            accounts
        );
        await governorAlpha.setTimelock(timelock.address);

        const { targetsData } = await prepareTargetsAndData({
            timelock,
            deploy: true,
        });

        await mockUSDV.mint(accounts.account0, proposalFee);
        await mockUSDV.approve(governorAlpha.address, proposalFee);

        const { signatures, targetAddresses, values, calldatas } = targetsData;

        await governorAlpha.propose(
            targetAddresses,
            values,
            signatures,
            calldatas,
            description
        );

        await time.advanceBlockTo(
            (await web3.eth.getBlock("latest")).number + 1
        );

        await governorAlpha.castVote(proposalId, true);

        await advanceBlockToVotingPeriodEnd({
            governorAlpha,
        });

        await governorAlpha.queue(proposalId);

        const { eta } = await governorAlpha.proposals(proposalId);
        const gracePeriod = await timelock.GRACE_PERIOD();
        await time.increaseTo(eta.add(gracePeriod));

        assert.equal(
            await governorAlpha.state(proposalId),
            artifacts.require("GovernorAlpha").ProposalState.Expired
        );
    });

    describe("queue proposal", () => {
        before(async function () {
            const { governorAlpha, timelock, mockUSDV } = await deployMock(
                accounts
            );

            await governorAlpha.setTimelock(timelock.address);

            const { targetsData } = await prepareTargetsAndData({
                timelock,
                deploy: true,
            });

            await mockUSDV.mint(accounts.account0, proposalFee);
            await mockUSDV.approve(governorAlpha.address, proposalFee);

            const {
                signatures,
                targetAddresses,
                values,
                calldatas,
            } = targetsData;

            await governorAlpha.propose(
                targetAddresses,
                values,
                signatures,
                calldatas,
                description
            );

            await time.advanceBlockTo(
                (await web3.eth.getBlock("latest")).number + 1
            );

            await governorAlpha.castVote(proposalId, true);
            await advanceBlockToVotingPeriodEnd({
                governorAlpha,
            });

            this.governorAlpha = governorAlpha;
            this.timelock = timelock;
        });

        it("and should assert eta and ProposalQueued event's data", async function () {
            const delay = await this.timelock.delay();

            assertEvents(await this.governorAlpha.queue(proposalId), {
                ProposalQueued: {
                    eta: big((await web3.eth.getBlock("latest")).timestamp).add(
                        delay
                    ),
                    id: proposalId,
                },
            });
        });

        it("and fails when the same proposal is tried to be queued the second time", async function () {
            await assertErrors(
                this.governorAlpha.queue(proposalId),
                "GovernorAlpha::queue: proposal can only be queued if it is succeeded"
            );
        });
    });
});
