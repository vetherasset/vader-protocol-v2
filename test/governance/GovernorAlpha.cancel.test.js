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

contract('GovernorAlpha.cancel', (accounts) => {
    before(async function () {
        if (Array.isArray(accounts)) accounts = await verboseAccounts(accounts);

        const {
            governorAlpha,
            timelock,
            mockUsdv,
        } = await deployMock(accounts);
        await governorAlpha.setTimelock(timelock.address);

        const {
            targetsData,
        } = await prepareTargetsAndData({
            timelock,
            deploy: true,
        });

        await mockUsdv.mint(
            accounts.account0,
            proposalFee.mul(big(4)),
        );

        await mockUsdv.approve(
            governorAlpha.address,
            proposalFee.mul(big(4)),
        );

        this.governorAlpha = governorAlpha;
        this.targetsData = targetsData;
        this.mockUsdv = mockUsdv;
    });

    it('should not cancel proposal by non guardian', async function () {
        await this.mockUsdv.mint(accounts.account1, proposalFee);
        await this.mockUsdv.approve(
            this.governorAlpha.address,
            proposalFee,
            {
                from: accounts.account1,
            },
        );

        const {
            signatures,
            targetAddresses,
            values,
            calldatas,
        } = this.targetsData;

        await this.governorAlpha.propose(
            targetAddresses,
            values,
            signatures,
            calldatas,
            description,
            {
                from: accounts.account1,
            },
        );

        await assertErrors(
            this.governorAlpha.cancel(
                proposalId,
                {
                    from: accounts.account1,
                },
            ),
            'only guardian can call',
        );
    });

    it('should successfully cancel proposal when it is pending', async function () {
        const proposalTwoId = big(2);
        const {
            signatures,
            targetAddresses,
            values,
            calldatas,
        } = this.targetsData;

        await this.governorAlpha.propose(
            targetAddresses,
            values,
            signatures,
            calldatas,
            description,
        );

        assertEvents(
            await this.governorAlpha.cancel(proposalTwoId),
            {
                ProposalCanceled: {
                    id: proposalTwoId,
                },
            },
        );
    });

    it('should successfully cancel proposal when it is active', async function () {
        const proposalThreeId = big(3);
        const {
            signatures,
            targetAddresses,
            values,
            calldatas,
        } = this.targetsData;

        await this.governorAlpha.propose(
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

        assertEvents(
            await this.governorAlpha.cancel(proposalThreeId),
            {
                ProposalCanceled: {
                    id: proposalThreeId,
                },
            },
        );
    });

    it('should successully cancel proposal when it is queued', async function () {
        const proposalFourId = big(4);
        const {
            signatures,
            targetAddresses,
            values,
            calldatas,
        } = this.targetsData;

        await this.governorAlpha.propose(
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

        await this.governorAlpha.castVote(
            proposalFourId,
            true,
        );

        await advanceBlockToVotingPeriodEnd({
            governorAlpha: this.governorAlpha,
        });

        await this.governorAlpha.queue(proposalFourId);

        assertEvents(
            await this.governorAlpha.cancel(proposalFourId),
            {
                ProposalCanceled: {
                    id: big(proposalFourId),
                },
            },
        );
    });

    it('should not cancel proposal when it is already executed', async function () {
        const proposalFiveId = big(5);
        const {
            signatures,
            targetAddresses,
            values,
            calldatas,
        } = this.targetsData;

        await this.governorAlpha.propose(
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

        await this.governorAlpha.castVote(
            proposalFiveId,
            true,
        );

        await advanceBlockToVotingPeriodEnd({
            governorAlpha: this.governorAlpha,
        });

        await this.governorAlpha.queue(proposalFiveId);

        await time.increaseTo(
            big((await web3.eth.getBlock('latest')).timestamp)
                .add(big(15 * 60)),
        );

        await this.governorAlpha.execute(proposalFiveId);

        await assertErrors(
            this.governorAlpha.cancel(proposalFiveId),
            'GovernorAlpha::cancel: cannot cancel executed proposal',
        );
    });
});
