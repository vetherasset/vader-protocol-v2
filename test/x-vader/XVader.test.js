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
    parseUnits,

    // Project Specific Constants
    PROJECT_CONSTANTS,

    mintAndApprove,
} = require("../utils")(artifacts);

contract("XVader", (accounts) => {
    describe("construction", () => {
        it("should fail to deploy contract with zero vader address", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);

            await assertErrors(
                deployMock(accounts, {
                    MockXVader: () => [UNSET_ADDRESS],
                }),
                "XVader::constructor: _vader cannot be a zero address",
            );
        });

        it("should deploy XVader and assert its state", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);

            const name = "XVader";
            const symbol = "xVADER";
            const { mockXVader, vader } = await deployMock(accounts);

            assert.equal(await mockXVader.name(), name);
            assert.equal(await mockXVader.symbol(), symbol);
            assert.equal(await mockXVader.vader(), vader.address);
        });
    });

    describe("test 'enter' and 'leave' functions", () => {
        it("should mint 1:1 of Vader to XVader when XVader supply is zero", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);

            const { mockXVader, token } = await deployMock(accounts, {
                MockXVader: (_, { token }) => [token.address],
            });

            await token.mint(accounts.account0, parseUnits(1000, 18));
            await token.approve(mockXVader.address, parseUnits(1000, 18));
            await mockXVader.enter(parseUnits(1000, 18));

            assertBn(await token.balanceOf(mockXVader.address), parseUnits(1000, 18));
            assertBn(await token.balanceOf(accounts.account0), big(0));
            assertBn(await mockXVader.balanceOf(accounts.account0), parseUnits(1000, 18));
            assertBn(await mockXVader.totalSupply(), parseUnits(1000, 18));
        });

        it("should successfully redeem vader from XVader", async () => {
            const { mockXVader, token } = await deployMock();
            await mockXVader.leave(parseUnits(1000, 18));

            assertBn(await token.balanceOf(mockXVader.address), big(0));
            assertBn(await token.balanceOf(accounts.account0), parseUnits(1000, 18));
            assertBn(await mockXVader.balanceOf(accounts.account0), big(0));
            assertBn(await mockXVader.totalSupply(), big(0));
        });

        it("should mint XVader on pro-rata basis to its vader supply", async () => {
            const { mockXVader, token } = await deployMock();
            await token.approve(mockXVader.address, parseUnits(1000, 18));
            await mockXVader.enter(parseUnits(500, 18));

            // mint XVader when its supply is non zero.
            const oldXVaderBalance = await mockXVader.balanceOf(accounts.account0);
            const expectedIncrease = await parseUnits(500, 18)
                .mul(await token.balanceOf(mockXVader.address))
                .div(await mockXVader.totalSupply());

            await mockXVader.enter(parseUnits(500, 18));
            assertBn(await mockXVader.balanceOf(accounts.account0), oldXVaderBalance.add(expectedIncrease));
        });
    });
});