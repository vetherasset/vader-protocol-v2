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
} = require("./../utils")(artifacts);

contract("VaderPoolFactory", (accounts) => {
    describe("createPool", () => {
        it("should not allow to create pool with identical tokens", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);

            const { factory } = await deployMock(accounts);
            await factory.initialize(accounts.account1, accounts.dao, {
                from: accounts.administrator,
            });
            const nativeAssetAdress = await factory.nativeAsset();
            await assertErrors(
                factory.createPool(nativeAssetAdress, nativeAssetAdress),
                "VaderPoolFactory::createPool: Identical Tokens"
            );
        });

        it("should not allow to create pool with inexistent token", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);

            const { factory } = await deployMock(accounts);
            await factory.initialize(accounts.account1, accounts.dao, {
                from: accounts.administrator,
            });
            const nativeAssetAdress = await factory.nativeAsset();
            await assertErrors(
                factory.createPool(nativeAssetAdress, UNSET_ADDRESS),
                "VaderPoolFactory::createPool: Inexistent Token"
            );
        });

        it("should not allow to create pool if pair already exists", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);

            const { factory, mockUsdv } = await deployMock(accounts);
            await factory.initialize(accounts.account1, accounts.dao, {
                from: accounts.administrator,
            });
            const nativeAssetAdress = await factory.nativeAsset();
            await factory.createPool(nativeAssetAdress, mockUsdv.address);
            await assertErrors(
                factory.createPool(nativeAssetAdress, mockUsdv.address),
                "VaderPoolFactory::createPool: Pair Exists"
            );
        });

        it("should create a pool with proper arguments", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);

            const { factory, mockUsdv } = await deployMock(accounts);

            await factory.initialize(accounts.account1, accounts.dao, {
                from: accounts.administrator,
            });
            const nativeAssetAdress = await factory.nativeAsset();

            const pool = await factory.createPool(
                nativeAssetAdress,
                mockUsdv.address
            );
            const poolAddress = pool.logs[1].address;
            assert.notEqual(poolAddress, UNSET_ADDRESS);
        });
    });

    describe("initialize", () => {
        it("should not initialize with incorrect arguments", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);

            const { factory } = await deployMock(accounts);
            await assertErrors(
                factory.initialize(UNSET_ADDRESS, accounts.dao, {
                    from: accounts.administrator,
                }),
                "VaderPoolFactory::initialize: Incorrect Arguments"
            );
            await assertErrors(
                factory.initialize(accounts.account1, UNSET_ADDRESS, {
                    from: accounts.administrator,
                }),
                "VaderPoolFactory::initialize: Incorrect Arguments"
            );
        });
    });

    describe("toggleQueue", () => {
        it("should not allow to toggleQueue if not the dao account", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);

            const { factory } = await deployMock(accounts);
            await assertErrors(
                factory.toggleQueue(accounts.account1, accounts.dao, {
                    from: accounts.account1,
                }),
                "BasePool::_onlyDAO: Insufficient Privileges"
            );
        });
    });
});
