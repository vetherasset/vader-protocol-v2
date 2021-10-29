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
    parseUnits,

    // Library Functions
    verboseAccounts,
    time,
    big,

    // Project Specific Constants
    PROJECT_CONSTANTS,
} = require("../utils")(artifacts);

contract.only("VaderReserve", (accounts) =>  {
    describe("construction", () => {
        it("should not allow construction with incorrect arguments", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);

            await assertErrors(
                deployMock(accounts, {
                    VaderReserve: () => [UNSET_ADDRESS],
                }),
                "VaderReserve::constructor: Incorrect Arguments"
            );
        });

        it("should construct the reserve", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);

            const { reserve, vader } = await deployMock(accounts);
            
            // Check the state
            assert.notEqual(reserve.address, UNSET_ADDRESS);
            assert.equal(await reserve.vader(), vader.address);
            assert.equal(await reserve.router(), UNSET_ADDRESS);
        });
    });

    describe("initialize", () => {
        it("should not allow to initialize with incorrect arguments", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);

            const { reserve, router } = await deployMock(accounts);
            
            await assertErrors(reserve.initialize(UNSET_ADDRESS, accounts.dao), 
            "VaderReserve::initialize: Incorrect Arguments");
            
            await assertErrors(reserve.initialize(router.address, UNSET_ADDRESS), 
            "VaderReserve::initialize: Incorrect Arguments");

            await assertErrors(reserve.initialize(router.address, accounts.dao, { from: accounts.account1 }), 
            "Ownable: caller is not the owner");
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

    describe("grant", () => {
        it("should grant from the owners account and check the balance and state", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);

            const { reserve, routerV2, vader } = await deployMock(accounts);

            // Init
            await reserve.initialize(routerV2.address, accounts.dao);

            // Check if the ownership is now the dao
            assert.equal(await reserve.owner(), accounts.dao);

            const amount = parseUnits(1000, 18);

            // Grant once
            await reserve.grant(accounts.account1, amount, { from: accounts.dao });
            
            // Check the vader balance
            // For the moment it should be 0 as we dont have vader yet
            assertBn(await vader.balanceOf(accounts.account1), 0);
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

            const { reserve, routerV2 } = await deployMock(accounts);

            // Init
            await reserve.initialize(routerV2.address, accounts.dao);

            const amount = parseUnits(1000, 18);

            // Grant once
            await reserve.grant(accounts.account1, amount, { from: accounts.dao });
            // Grant again
            await assertErrors(reserve.grant(accounts.account1, amount, { from: accounts.dao }), 
            "VaderReserve::throttle: Grant Too Fast");
        });
    });
});