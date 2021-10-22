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
    rpc,
} = require('../utils')(artifacts);

const {
    prepareTargetsAndData,
    getTypedDataForVoteBySignature,
    decodeSignature,
    proposalFee,
    description,
} = require('./helpers')({
    artifacts,
    parseUnits,
    big,
});

const proposalId = big(1);

contract('GovernorAlpha.castVote', (accounts) => {
    before(async function () {
        if (Array.isArray(accounts)) accounts = await verboseAccounts(accounts);

        const {
            governorAlpha,
            timelock,
            mockUsdv,
            mockVault,
        } = await deployMock(accounts);

        const {
            targetsData,
        } = await prepareTargetsAndData({
            timelock,
            deploy: true,
        });

        await mockUsdv.mint(accounts.account0, proposalFee);
        await mockUsdv.approve(governorAlpha.address, proposalFee);

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

        this.governorAlpha = governorAlpha;
        this.mockVault = mockVault;
    });

    it('fails when proposal is pending', async function () {
        await assertErrors(
            this.governorAlpha.castVote(proposalId, true),
            'GovernorAlpha::_castVote: voting is closed',
        );
    });

    it('fails when voter has already casted vote', async function () {
        await this.governorAlpha.castVote(proposalId, true);

        await assertErrors(
            this.governorAlpha.castVote(proposalId, true),
            'GovernorAlpha::_castVote: voter already voted',
        );
    });

    it("should cast vote and assert the VoteCast event's data", async function () {
        const votes = await this.mockVault.getPriorVotes(accounts.voter, 0);
        const support = true;

        assertEvents(
            await this.governorAlpha.castVote(
                proposalId,
                support,
                {
                    from: accounts.voter,
                },
            ),
            {
                VoteCast: {
                    voter: accounts.voter,
                    proposalId,
                    support,
                    votes,
                },
            },
        );

        assert.equal(
            (await this.governorAlpha.getReceipt(proposalId, accounts.voter))[0],
            true,
        );
    });

    describe('vote by signature', () => {
        before(async function () {
            this.voter = accounts.account1;
            const typedData = getTypedDataForVoteBySignature({
                verifyingContract: this.governorAlpha.address,
                chainId: (await this.governorAlpha.CHAINID()).toNumber(),
            });

            const result = await rpc({
                method: 'eth_signTypedData',
                params: [this.voter, typedData],
                from: this.voter,
            });

            [
                this.v,
                this.r,
                this.s,
            ] = Object.values(decodeSignature(result.result));

            [
                this.id,
                this.support,
            ] = Object.values(typedData.message);

            this.votes = await this.mockVault.getPriorVotes(accounts.account1, 0);
        });

        it('should successfully cast vote', async function () {
            const {
                id,
                support,
                v,
                r,
                s,
                voter,
                votes,
            } = this;

            assertEvents(
                await this.governorAlpha.castVoteBySig(
                    id,
                    support,
                    v,
                    r,
                    s,
                    {
                        from: voter,
                    },
                ),
                {
                    VoteCast: {
                        voter,
                        proposalId: big(id),
                        support,
                        votes,
                    },
                },
            );
        });

        it('fails to replay signature of vote casting', async function () {
            const {
                id,
                support,
                v,
                r,
                s,
                voter,
            } = this;

            await assertErrors(
                this.governorAlpha.castVoteBySig(
                    id,
                    support,
                    v,
                    r,
                    s,
                    {
                        from: voter,
                    },
                ),
                'GovernorAlpha::_castVote: voter already voted',
            );
        });
    });
});
