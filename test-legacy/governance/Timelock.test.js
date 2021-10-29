const { time } = require("@openzeppelin/test-helpers");
const {
    // Deployment Function
    deployMock,

    // Testing Utilities
    assertErrors,
    assertEvents,
    assertBn,
    UNSET_ADDRESS,

    // Library Functions
    verboseAccounts,
    big,
    parseUnits,
} = require("../utils")(artifacts);

const { getTxHash } = require("./helpers")({
    artifacts,
    parseUnits,
    big,
});

const [
    // eslint-disable-next-line no-unused-vars
    TARGET_INDEX,
    VALUE_INDEX,
    SIGNATURE_INDEX,
    DATA_INDEX,
    ETA_INDEX,
] = [0, 1, 2, 3, 4];

contract("Timelock", (accounts) => {
    describe("construction", () => {
        it("should prevent contract deploy with zero admin address and out of bounds delay range", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);

            // valid delay from timelock contract is between 5-15 minutes
            const validDelay = 10 * 60; // 10 minutes
            const aboveValidDelay = 20 * 60; // 20 minutes
            const belowValidDelay = 2 * 60; // 2 minutes

            await assertErrors(
                deployMock(accounts, {
                    Timelock: () => [accounts.account0, aboveValidDelay],
                }),
                "Timelock::constructor: Delay must not exceed maximum delay."
            );

            await assertErrors(
                deployMock(accounts, {
                    Timelock: () => [accounts.account0, belowValidDelay],
                }),
                "Timelock::constructor: Delay must exceed minimum delay."
            );

            await assertErrors(
                deployMock(accounts, {
                    Timelock: () => [UNSET_ADDRESS, validDelay],
                }),
                "Timelock::constructor: Admin cannot be zero"
            );
        });

        it("should deploy Timelock contract with correct state", async () => {
            const { timelock, governorAlpha } = await deployMock(accounts);
            const validDelay = big(10).mul(big(60)); // 10 minutes

            assertBn(await timelock.delay(), validDelay);

            assert.equal(await timelock.admin(), governorAlpha.address);
        });
    });

    describe("set delay and admin", () => {
        before(async function () {
            const { timelock } = await deployMock(accounts, {
                Timelock: () => [accounts.account0, 10 * 60],
            });

            this.args = [
                timelock.address,
                0,
                "setPendingAdmin(address)",
                web3.eth.abi.encodeParameters(["address"], [accounts.account1]),
                big((await web3.eth.getBlock("latest")).timestamp)
                    .add(await timelock.delay())
                    .add(big(60).mul(big(60))),
            ];
            this.timelock = timelock;
        });

        it("fails to set delay by an address not the contract itself ", async function () {
            const validDelay = 10 * 60; // 10 minutes

            await assertErrors(
                this.timelock.setDelay(validDelay),
                "Timelock::setDelay: Call must come from Timelock."
            );
        });

        it("fails to set delay when it is below than minimum delay", async function () {
            const args = [...this.args];
            const belowValidDelay = 2 * 60; // 2 minutes

            args[SIGNATURE_INDEX] = "setDelay(uint256)";
            args[DATA_INDEX] = web3.eth.abi.encodeParameters(
                ["uint256"],
                [belowValidDelay]
            );

            await this.timelock.queueTransaction(...args);

            await time.increaseTo(args[ETA_INDEX]);

            await assertErrors(
                this.timelock.executeTransaction(...args),
                "Timelock::executeTransaction: Transaction execution reverted."
            );
        });

        it("fails to set delay when it is above than maximum delay", async function () {
            this.args[ETA_INDEX] = big(
                (await web3.eth.getBlock("latest")).timestamp
            )
                .add(await this.timelock.delay())
                .add(big(60).mul(big(60)));

            const args = [...this.args];
            const aboveValidDelay = 20 * 60; // 20 minutes

            args[SIGNATURE_INDEX] = "setDelay(uint256)";
            args[DATA_INDEX] = web3.eth.abi.encodeParameters(
                ["uint256"],
                [aboveValidDelay]
            );

            await this.timelock.queueTransaction(...args);

            await time.increaseTo(args[ETA_INDEX]);

            await assertErrors(
                this.timelock.executeTransaction(...args),
                "Timelock::executeTransaction: Transaction execution reverted."
            );
        });

        it("should successfully set delay", async function () {
            this.args[ETA_INDEX] = big(
                (await web3.eth.getBlock("latest")).timestamp
            )
                .add(await this.timelock.delay())
                .add(big(60).mul(big(60)));

            const args = [...this.args];
            const validDelay = 10 * 60; // 10 minutes

            args[SIGNATURE_INDEX] = "setDelay(uint256)";
            args[DATA_INDEX] = web3.eth.abi.encodeParameters(
                ["uint256"],
                [validDelay]
            );

            await this.timelock.queueTransaction(...args);

            await time.increaseTo(args[ETA_INDEX]);

            assertEvents(await this.timelock.executeTransaction(...args), {
                NewDelay: {
                    newDelay: validDelay,
                },
            });
        });

        it("fails to set pending admin by an address not the contract itself", async function () {
            await assertErrors(
                this.timelock.setPendingAdmin(accounts.account1),
                "Timelock::setPendingAdmin: Call must come from Timelock."
            );
        });

        it("should set pending admin through queueing of action", async function () {
            this.args[ETA_INDEX] = big(
                (await web3.eth.getBlock("latest")).timestamp
            )
                .add(await this.timelock.delay())
                .add(big(60).mul(big(60)));

            await this.timelock.queueTransaction(...this.args);

            await time.increaseTo(this.args[ETA_INDEX]);

            assertEvents(await this.timelock.executeTransaction(...this.args), {
                NewPendingAdmin: {
                    newPendingAdmin: accounts.account1,
                },
            });
        });

        it("should fail to accept admin by non pending admin", async function () {
            await assertErrors(
                this.timelock.acceptAdmin(),
                "Timelock::acceptAdmin: Call must come from pendingAdmin."
            );
        });

        it("should accept admin role by pending admin", async function () {
            assertEvents(
                await this.timelock.acceptAdmin({
                    from: accounts.account1,
                }),
                {
                    NewAdmin: {
                        newAdmin: accounts.account1,
                    },
                }
            );
        });
    });

    describe("queue, execute and cancel transaction", () => {
        before(async function () {
            const { timelock } = await deployMock(accounts, {
                Timelock: () => [accounts.account0, 10 * 60],
            });

            this.args = [
                timelock.address,
                0,
                "setPendingAdmin(address)",
                web3.eth.abi.encodeParameters(["address"], [accounts.account1]),
                big((await web3.eth.getBlock("latest")).timestamp)
                    .add(await timelock.delay())
                    .add(big(60).mul(big(60))),
            ];
            this.timelock = timelock;
        });

        describe("queueTransaction", () => {
            it("fails to queue transaction by non admin", async function () {
                await assertErrors(
                    this.timelock.queueTransaction(...this.args, {
                        from: accounts.account1,
                    }),
                    "Timelock::queueTransaction: Call must come from admin."
                );
            });

            it("fails to queue transaction with invalid eta", async function () {
                const args = [...this.args];
                args[ETA_INDEX] = (await web3.eth.getBlock("latest")).timestamp;

                await assertErrors(
                    this.timelock.queueTransaction(...args),
                    "Timelock::queueTransaction: Estimated execution block must satisfy delay."
                );
            });

            it("successfully queue transaction", async function () {
                const [target, value, signature, data, eta] = this.args;

                const txHash = getTxHash(this.args);

                assertEvents(
                    await this.timelock.queueTransaction(...this.args),
                    {
                        QueueTransaction: {
                            txHash,
                            target,
                            value,
                            signature,
                            data,
                            eta,
                        },
                    }
                );

                assert.equal(
                    await this.timelock.queuedTransactions(txHash),
                    true
                );
            });
        });

        describe("cancelTransaction", () => {
            before(async function () {
                this.args[ETA_INDEX] = big(
                    (await web3.eth.getBlock("latest")).timestamp
                )
                    .add(await this.timelock.delay())
                    .add(big(60).mul(big(60)));

                await this.timelock.queueTransaction(...this.args);
            });

            it("should fail to cancel transaction by non admin", async function () {
                await assertErrors(
                    this.timelock.cancelTransaction(...this.args, {
                        from: accounts.account1,
                    }),
                    "Timelock::cancelTransaction: Call must come from admin."
                );
            });

            it("should successfully cancel transaction", async function () {
                const [target, value, signature, data, eta] = this.args;

                const txHash = getTxHash(this.args);

                assertEvents(
                    await this.timelock.cancelTransaction(...this.args),
                    {
                        CancelTransaction: {
                            txHash,
                            target,
                            value,
                            signature,
                            data,
                            eta,
                        },
                    }
                );

                assert.equal(
                    await this.timelock.queuedTransactions(txHash),
                    false
                );
            });
        });

        describe("executeTransaction", () => {
            before(async function () {
                this.args[ETA_INDEX] = big(
                    (await web3.eth.getBlock("latest")).timestamp
                )
                    .add(await this.timelock.delay())
                    .add(big(60).mul(big(60)));

                await this.timelock.queueTransaction(...this.args);
            });

            it("should fail to execute transaction by non admin", async function () {
                await assertErrors(
                    this.timelock.executeTransaction(...this.args, {
                        from: accounts.account1,
                    }),
                    "Timelock::executeTransaction: Call must come from admin."
                );
            });

            it("should fail to execute non-queued transaction", async function () {
                const args = [...this.args];
                args[VALUE_INDEX] = 2;
                await assertErrors(
                    this.timelock.executeTransaction(...args),
                    "Timelock::executeTransaction: Transaction hasn't been queued."
                );
            });

            it("should fail to execute transaction when eta has not arrived", async function () {
                await assertErrors(
                    this.timelock.executeTransaction(...this.args),
                    "Timelock::executeTransaction: Transaction hasn't surpassed time lock."
                );
            });

            it("should fail to execute transaction when one of actions fail", async function () {
                const args = [...this.args];
                args[SIGNATURE_INDEX] = "acceptAdmin()";

                await this.timelock.queueTransaction(...args);

                await time.increaseTo(args[ETA_INDEX].add(big(1)));

                await assertErrors(
                    this.timelock.executeTransaction(...args),
                    "Timelock::executeTransaction: Transaction execution reverted."
                );
            });

            it("should fail to execute transaction when grace period has passed", async function () {
                await time.increaseTo(
                    this.args[ETA_INDEX].add(
                        await this.timelock.GRACE_PERIOD()
                    ).add(big(1))
                );

                await assertErrors(
                    this.timelock.executeTransaction(...this.args),
                    "Timelock::executeTransaction: Transaction is stale."
                );
            });

            it("should successfully execute transaction", async function () {
                this.args[ETA_INDEX] = big(
                    (await web3.eth.getBlock("latest")).timestamp
                )
                    .add(await this.timelock.delay())
                    .add(big(60).mul(big(60))); // add eta delay of 1 hour further

                const args = [...this.args];

                await this.timelock.queueTransaction(...args);

                await time.increaseTo(args[ETA_INDEX].add(big(1)));

                const txHash = getTxHash(this.args);

                const [target, value, signature, data, eta] = args;

                assertEvents(await this.timelock.executeTransaction(...args), {
                    ExecuteTransaction: {
                        txHash,
                        target,
                        value,
                        signature,
                        data,
                        eta,
                    },
                });
            });

            it("should fail to execute same transaction twice", async function () {
                await assertErrors(
                    this.timelock.executeTransaction(...this.args),
                    "Timelock::executeTransaction: Transaction hasn't been queued."
                );
            });
        });
    });
});
