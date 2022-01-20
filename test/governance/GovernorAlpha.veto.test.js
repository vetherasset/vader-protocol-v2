const { time } = require("@openzeppelin/test-helpers");
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

contract("GovernorAlpha.veto", (accounts) => {
    before(async function () {
        if (Array.isArray(accounts)) accounts = await verboseAccounts(accounts);

        const { governorAlpha, timelock, mockXVader } = await deployMock(
            accounts
        );
        await governorAlpha.setTimelock(timelock.address);

        const { targetsData } = await prepareTargetsAndData({
            timelock,
            deploy: true,
        });

        await mockXVader.mint(accounts.account0, proposalFee.mul(big(4)));

        await mockXVader.approve(governorAlpha.address, proposalFee.mul(big(4)));

        this.governorAlpha = governorAlpha;
        this.targetsData = targetsData;
        this.count = 1;
    });

    afterEach(async function () {
        await this.governorAlpha.cancel(this.count);
        this.count += 1;
    });

    it("non-council should not be able to veto proposal", async function () {
        const { signatures, targetAddresses, values, calldatas } =
            this.targetsData;

        await this.governorAlpha.propose(
            targetAddresses,
            values,
            signatures,
            calldatas,
            description
        );

        await assertErrors(
            this.governorAlpha.veto(1, true, {
                from: accounts.account1,
            }),
            "only council can call"
        );
    });

    it("fails to veto proposal when it is succeeded", async function () {
        const { signatures, targetAddresses, values, calldatas } =
            this.targetsData;

        await this.governorAlpha.propose(
            targetAddresses,
            values,
            signatures,
            calldatas,
            description
        );

        await time.advanceBlockTo(
            (await web3.eth.getBlock("latest")).number + 1
        );

        await this.governorAlpha.castVote(2, true);

        await advanceBlockToVotingPeriodEnd({
            governorAlpha: this.governorAlpha,
        });

        await assertErrors(
            this.governorAlpha.veto(2, true),
            "Proposal can only be vetoed when active"
        );
    });

    it("fails to veto a proposal for changing council", async function () {
        const { signatures, targetAddresses, values, calldatas } =
            this.targetsData;

        const _targetAddresses = [
            ...targetAddresses,
            this.governorAlpha.address,
        ];
        _targetAddresses.shift();

        const _calldatas = [
            ...calldatas,
            web3.eth.abi.encodeParameters(
                [
                    'bytes4',
                    'address'
                ],
                [
                    web3.utils.keccak256('changeCouncil(address)').slice(0, 10),
                    accounts.account5
                ])
        ];
        _calldatas.shift();

        await this.governorAlpha.propose(
            _targetAddresses,
            values,
            signatures,
            _calldatas,
            description
        );

        await advanceBlockToVotingPeriodEnd({
            governorAlpha: this.governorAlpha,
        });

        await assertErrors(
            this.governorAlpha.veto(3, true),
            "GovernorAlpha::veto: council cannot veto a council changing proposal"
        );
    });

    it("successfully vetoes a proposal and asserts ProposalVetoed's data", async function () {
        const { signatures, targetAddresses, values, calldatas } =
            this.targetsData;

        await this.governorAlpha.propose(
            targetAddresses,
            values,
            signatures,
            calldatas,
            description
        );

        const proposalId = 4;
        const support = true;

        assertEvents(await this.governorAlpha.veto(proposalId, support), {
            ProposalVetoed: {
                proposalId,
                support,
            },
        });
    });
});
