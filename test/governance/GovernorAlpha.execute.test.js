const { time } = require('@openzeppelin/test-helpers');
const {
    // Deployment Function
    deployMock,

    // Testing Utilities
    assertErrors,
    assertEvents,

    // Library Functions
    verboseAccounts,
    big,
    parseUnits,
} = require('../utils')(artifacts);

const {
    prepareTargetsAndData,
    advanceBlockToVotingPeriodEnd,
    proposalFee,
    description,
} = require('./helpers')({
    artifacts,
    parseUnits,
    big,
});

const proposalId = big(1);

contract('GovernorAlpha.execute', (accounts) => {
    before(async function () {
        if (Array.isArray(accounts)) accounts = await verboseAccounts(accounts);

        const {
            governorAlpha,
            timelock,
            mockUSDV,
        } = await deployMock(accounts);
        await governorAlpha.setTimelock(timelock.address);

        const {
            targetsData,
        } = await prepareTargetsAndData({
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
            description,
        );

        await time.advanceBlockTo(
            (await web3.eth.getBlock('latest'))
                .number + 1,
        );

        await governorAlpha.castVote(
            proposalId,
            true,
        );

        await advanceBlockToVotingPeriodEnd({
            governorAlpha,
        });

        this.governorAlpha = governorAlpha;
        this.mockUSDV = mockUSDV;
    });

    it('should not execute proposal when not in queue', async function () {
        await assertErrors(
            this.governorAlpha.execute(proposalId),
            'GovernorAlpha::execute: proposal can only be executed if it is queued',
        );
    });

    it("should successfully execute proposal and assert ProposalExecuted event's data", async function () {
        await this.governorAlpha.queue(proposalId);
        await time.increaseTo(
            big((await web3.eth.getBlock('latest')).timestamp)
                .add(big(15 * 60)), // increase time to eta
        );
        assertEvents(
            await this.governorAlpha.execute(proposalId),
            {
                ProposalExecuted: {
                    id: proposalId,
                },
            },
        );
    });
});
