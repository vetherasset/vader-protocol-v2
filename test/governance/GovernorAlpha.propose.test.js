const {
    // Deployment Function
    deployMock,

    // Testing Utilities
    assertBn,
    assertErrors,
    assertEvents,

    // Library Functions
    verboseAccounts,
    big,
    parseUnits,
} = require("../utils")(artifacts);

const { prepareTargetsAndData, proposalFee, description } =
    require("./helpers")({
        artifacts,
        parseUnits,
        big,
    });

contract("GovernorAlpha.propose", (accounts) => {
    it("fails when array arguments lengths' are mismatching", async () => {
        if (Array.isArray(accounts)) accounts = await verboseAccounts(accounts);

        const { governorAlpha, timelock } = await deployMock(accounts);

        const { targetsData } = await prepareTargetsAndData({
            timelock,
            deploy: true,
        });

        const { signatures, targetAddresses, values, calldatas } = targetsData;

        await assertErrors(
            governorAlpha.propose(
                targetAddresses.slice(1),
                values,
                signatures,
                calldatas,
                description
            ),
            "GovernorAlpha::propose: proposal function information arity mismatch"
        );
    });

    it("fails when array arguments lengths' are zero", async () => {
        const { governorAlpha } = await deployMock();

        const emptyArray = [];
        await assertErrors(
            governorAlpha.propose(
                emptyArray,
                emptyArray,
                emptyArray,
                emptyArray,
                description
            ),
            "GovernorAlpha::propose: must provide actions"
        );
    });

    it("fails when proposer has not set allowance", async () => {
        const { governorAlpha, mockXVader, timelock } = await deployMock();

        await mockXVader.mint(accounts.account0, proposalFee);

        const { targetsData } = await prepareTargetsAndData({
            timelock,
        });

        const { signatures, targetAddresses, values, calldatas } = targetsData;

        await assertErrors(
            governorAlpha.propose(
                targetAddresses,
                values,
                signatures,
                calldatas,
                description
            ),
            "ERC20: transfer amount exceeds allowance"
        );
    });

    it("fails when proposer does not have sufficient balance", async () => {
        const { governorAlpha, mockXVader, timelock } = await deployMock();

        await mockXVader.approve(governorAlpha.address, proposalFee, {
            from: accounts.account1,
        });

        const { targetsData } = await prepareTargetsAndData({
            timelock,
        });

        const { signatures, targetAddresses, values, calldatas } = targetsData;

        await assertErrors(
            governorAlpha.propose(
                targetAddresses,
                values,
                signatures,
                calldatas,
                description,
                {
                    from: accounts.account1,
                }
            ),
            "ERC20: transfer amount exceeds balance"
        );
    });

    it("fails when proposer already has a pending proposal", async () => {
        const { governorAlpha, mockXVader, timelock } = await deployMock();

        const { targetsData } = await prepareTargetsAndData({
            timelock,
        });

        await mockXVader.mint(accounts.account0, proposalFee.mul(big(2)));

        await mockXVader.approve(governorAlpha.address, proposalFee.mul(big(2)));

        const { signatures, targetAddresses, values, calldatas } = targetsData;

        await governorAlpha.propose(
            targetAddresses,
            values,
            signatures,
            calldatas,
            description
        );

        await assertErrors(
            governorAlpha.propose(
                targetAddresses,
                values,
                signatures,
                calldatas,
                description
            ),
            "GovernorAlpha::propose: one live proposal per proposer, found an already pending proposal"
        );
    });

    it("fails when proposer has an already active proposal", async () => {
        const { governorAlpha, timelock } = await deployMock();

        const { targetsData } = await prepareTargetsAndData({
            timelock,
        });

        const { signatures, targetAddresses, values, calldatas } = targetsData;

        await assertErrors(
            governorAlpha.propose(
                targetAddresses,
                values,
                signatures,
                calldatas,
                description
            ),
            "GovernorAlpha::propose: one live proposal per proposer, found an already active proposal"
        );
    });

    it("fails when there are too many actions", async () => {
        const { governorAlpha, timelock } = await deployMock();
        const maxActions = await governorAlpha.proposalMaxOperations();

        const { targetsData } = await prepareTargetsAndData({
            timelock,
            deploy: true,
            numberOfMocks: maxActions.add(big(1)).toNumber(),
        });

        const { signatures, targetAddresses, values, calldatas } = targetsData;

        await assertErrors(
            governorAlpha.propose(
                targetAddresses,
                values,
                signatures,
                calldatas,
                description
            ),
            "GovernorAlpha::propose: too many actions"
        );
    });

    describe("successfully propose and", () => {
        before(async function () {
            const { governorAlpha, timelock, mockXVader } = await deployMock(
                accounts
            );

            const { targetsData } = await prepareTargetsAndData({
                timelock,
                deploy: true,
            });

            await mockXVader.mint(accounts.account0, proposalFee);

            await mockXVader.approve(governorAlpha.address, proposalFee);

            this.governorAlpha = governorAlpha;
            this.targetsData = targetsData;
            this.mockXVader = mockXVader;
            this.proposer = accounts.account0;
            this.feeReceiver = accounts.account1;

            this.balancesBefore = {
                [this.proposer]: await mockXVader.balanceOf(this.proposer),
                [this.feeReceiver]: await mockXVader.balanceOf(this.feeReceiver),
            };

            this.amountsChanged = {
                [this.proposer]: proposalFee.neg(),
                [this.feeReceiver]: proposalFee,
            };
        });

        it("assert the ProposalCreated event's data", async function () {
            const { signatures, targetAddresses, values, calldatas } =
                this.targetsData;

            const startBlockExpected = big(
                (await web3.eth.getBlock("latest")).number + 1
            ).add(await this.governorAlpha.votingDelay());

            const endBlockExpected = startBlockExpected.add(
                await this.governorAlpha.votingPeriod()
            );

            assertEvents(
                await this.governorAlpha.propose(
                    targetAddresses,
                    values,
                    signatures,
                    calldatas,
                    description
                ),
                {
                    ProposalCreated: {
                        proposer: accounts.account0,
                        startBlock: startBlockExpected,
                        endBlock: endBlockExpected,
                        id: big(1),
                    },
                }
            );
        });

        it("assert the balances transfer from propose call", async function () {
            const balancesAfter = {
                [this.proposer]: await this.mockXVader.balanceOf(this.proposer),
                [this.feeReceiver]: await this.mockXVader.balanceOf(
                    this.feeReceiver
                ),
            };

            Object.entries(this.balancesBefore).forEach(
                ([account, balance]) => {
                    assertBn(
                        balance.add(this.amountsChanged[account]),
                        balancesAfter[account]
                    );
                }
            );
        });

        it("should assert the proposal's actions data", async function () {
            const data = {
                targets: this.targetsData.targetAddresses,
                values: this.targetsData.values,
                signatures: this.targetsData.signatures,
                calldatas: this.targetsData.calldatas,
            };

            const actions = await this.governorAlpha.getActions(1);

            Object.entries(data).forEach(([key, value]) => {
                assert.deepEqual(value, actions[key]);
            });
        });
    });
});
