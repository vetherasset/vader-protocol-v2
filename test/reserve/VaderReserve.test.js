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

    // Project Specific Constants
    PROJECT_CONSTANTS,
} = require("../utils")(artifacts);

contract("VaderReserve", (accounts) =>  {
    describe("construction", () => {
        it("should not allow construction with incorrect arguments", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);

            await assertErrors(
                deployMock(accounts, {
                    VaderReserve: () => [UNSET_ADDRESS, UNSET_ADDRESS, UNSET_ADDRESS],
                }),
                "VaderReserve::constructor: Incorrect Arguments"
            );
        });

        it("should construct the reserve", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);

            const { router, vader, reserve } = await deployMock(accounts);
            assert.notEqual(reserve.address, UNSET_ADDRESS);
            assert.equal(await reserve.vader(), await vader.address);
            assert.equal(await reserve.router(), await router.address);
        });
    });

    describe("reserve", () => {
        it("should return the vader balance of the reserve contract", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);

            const { reserve } = await deployMock(accounts);
            const amount = await reserve.reserve();
            // We dont have a reserve balance yet
            assert.equal(amount, 0);
        });
    });

    describe("reimburseImpermanentLoss", () => {
        it("should not allow to reimburseImpermanentLoss if caller is not the router", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);

            const { reserve } = await deployMock(accounts);
            await assertErrors(reserve.reimburseImpermanentLoss(accounts.account1, 1000), 
            "VaderReserve::reimburseImpermanentLoss: Insufficient Priviledges");
        });
    });

    describe("throttle", () => {
        it("should not allow to call grant to fast", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);

            const { reserve } = await deployMock(accounts);
            // Grant once
            await reserve.grant(accounts.account1, 1000, { from: accounts.dao });
            // Grant again
            await assertErrors(reserve.grant(accounts.account1, 2000, { from: accounts.dao }), 
            "VaderReserve::throttle: Grant Too Fast");
        });
    });
});