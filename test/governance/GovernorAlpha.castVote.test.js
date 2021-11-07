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
} = require("../utils")(artifacts);

const {
    prepareTargetsAndData,
    getTypedDataForVoteBySignature,
    decodeSignature,
    proposalFee,
    description,
} = require("./helpers")({
    artifacts,
    parseUnits,
    big,
});

const proposalId = big(1);

contract("GovernorAlpha.castVote", (accounts) => {
    before(async function () {
        if (Array.isArray(accounts)) accounts = await verboseAccounts(accounts);

        const { governorAlpha, timelock, mockXVader } =
            await deployMock(accounts);

        const { targetsData } = await prepareTargetsAndData({
            timelock,
            deploy: true,
        });

        await mockXVader.mint(accounts.account0, proposalFee.mul(big(3)));
        await mockXVader.approve(governorAlpha.address, proposalFee.mul(big(3)));

        await mockXVader.mint(accounts.voter, parseUnits(1000, 18));
        await mockXVader.delegate(accounts.voter, {
            from: accounts.voter
        });

        await mockXVader.mint(accounts.account3, parseUnits(1000, 18));
        await mockXVader.delegate(accounts.account3, {
            from: accounts.account3
        });

        await mockXVader.mint(accounts.account4, parseUnits(1000, 18));
        await mockXVader.delegate(accounts.account4, {
            from: accounts.account4
        });

        const { signatures, targetAddresses, values, calldatas } = targetsData;

        await governorAlpha.propose(
            targetAddresses,
            values,
            signatures,
            calldatas,
            description
        );

        this.governorAlpha = governorAlpha;
        this.mockXVader = mockXVader;
    });

    it("fails when proposal is pending", async function () {
        await assertErrors(
            this.governorAlpha.castVote(proposalId, true),
            "GovernorAlpha::_castVote: voting is closed"
        );
    });

    it("fails when voter has already casted vote", async function () {
        await this.governorAlpha.castVote(proposalId, true, {
            from: accounts.voter
        });

        await assertErrors(
            this.governorAlpha.castVote(proposalId, true, {
                from: accounts.voter
            }),
            "GovernorAlpha::_castVote: voter already voted"
        );
    });

    it("should cast vote and assert the VoteCast event's data", async function () {
        const startBlock = (await this.governorAlpha.proposals(proposalId)).startBlock;
        const votes = await this.mockXVader.getPastVotes(accounts.account3, startBlock);
        const support = true;

        assertEvents(
            await this.governorAlpha.castVote(proposalId, support, {
                from: accounts.account3,
            }),
            {
                VoteCast: {
                    voter: accounts.account3,
                    proposalId,
                    support,
                    votes,
                },
            }
        );

        assert.equal(
            (
                await this.governorAlpha.getReceipt(proposalId, accounts.account3)
            )[0],
            true
        );
    });

    describe("vote by signature", () => {
        before(async function () {
            this.voter = accounts.account4;
            const typedData = getTypedDataForVoteBySignature({
                verifyingContract: this.governorAlpha.address,
                chainId: (await this.governorAlpha.CHAINID()).toNumber(),
            });

            const result = await rpc({
                method: "eth_signTypedData",
                params: [this.voter, typedData],
                from: this.voter,
            });

            [this.v, this.r, this.s] = Object.values(
                decodeSignature(result.result)
            );

            [this.id, this.support] = Object.values(typedData.message);

            const startBlock = (await this.governorAlpha.proposals(proposalId)).startBlock;
            this.votes = await this.mockXVader.getPastVotes(this.voter, startBlock)
        });

        it("should successfully cast vote", async function () {
            const { id, support, v, r, s, voter, votes } = this;

            assertEvents(
                await this.governorAlpha.castVoteBySig(id, support, v, r, s, {
                    from: voter,
                }),
                {
                    VoteCast: {
                        voter,
                        proposalId: big(id),
                        support,
                        votes,
                    },
                }
            );
        });

        it("fails to replay signature of vote casting", async function () {
            const { id, support, v, r, s, voter } = this;

            await assertErrors(
                this.governorAlpha.castVoteBySig(id, support, v, r, s, {
                    from: voter,
                }),
                "GovernorAlpha::_castVote: voter already voted"
            );
        });
    });
});
