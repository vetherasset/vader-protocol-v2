const {
    // Deployment Function
    deployMock,

    // Testing Utilities
    assertBn,
    assertErrors,
    assertEvents,
    TEN_UNITS,
    UNSET_ADDRESS,

    // Library Functions
    verboseAccounts,

    // Project Specific Constants
    PROJECT_CONSTANTS,
} = require("./utils")(artifacts);

contract("Converter", (accounts) => {
    describe("construction", () => {
        it("should prevent deployment of the converter with a zero address Vether / Vader contract", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);

            await assertErrors(
                deployMock(accounts, {
                    Converter: () => [UNSET_ADDRESS, accounts.account0],
                }),
                "Converter::constructor: Misconfiguration"
            );

            await assertErrors(
                deployMock(accounts, {
                    Converter: () => [accounts.account0, UNSET_ADDRESS],
                }),
                "Converter::constructor: Misconfiguration"
            );
        });

        it("should deploy the Converter contract with a correct state", async () => {
            const { converter, vether, vader } = await deployMock(accounts);
            assert.ok(converter.address);

            assert.equal(await converter.vether(), vether.address);
            assert.equal(await converter.vader(), vader.address);
        });
    });

    describe("initialization", () => {
        it("should properly initialize the converter by having Vader mint the corresponding amount of tokens to it", async () => {
            const { vader, vesting, converter, usdv, ADMINISTRATOR } =
                await deployMock();

            const { VETH_ALLOCATION } = PROJECT_CONSTANTS;

            assertBn(await vader.balanceOf(converter.address), 0);

            await vader.setComponents(
                converter.address,
                vesting.address,
                usdv.address,
                accounts.dao,
                ADMINISTRATOR
            );

            assertBn(await vader.balanceOf(converter.address), VETH_ALLOCATION);
        });
    });

    describe("conversion", () => {
        it("should disallow zero-value conversions", async () => {
            const { converter } = await deployMock();

            await assertErrors(
                converter.convert(0),
                "Converter::convert: Non-Zero Conversion Amount Required"
            );
        });

        it("should fail to convert if it has insufficient allowance", async () => {
            const { converter, vether } = await deployMock();

            await vether.mint(accounts.account0, TEN_UNITS);

            await assertErrors(
                converter.convert(TEN_UNITS),
                "ERC20: transfer amount exceeds allowance"
            );
        });

        it("should properly support one-way conversion from Vader to Vether", async () => {
            const { converter, vether, vader } = await deployMock();

            const { VADER_VETHER_CONVERSION_RATE, VETH_ALLOCATION, BURN } =
                PROJECT_CONSTANTS;

            await vether.approve(converter.address, TEN_UNITS, {
                from: accounts.account0,
            });

            assertBn(await vether.balanceOf(accounts.account0), TEN_UNITS);
            assertBn(await vether.balanceOf(BURN), 0);
            assertBn(await vader.balanceOf(accounts.account0), 0);
            assertBn(await vader.balanceOf(converter.address), VETH_ALLOCATION);

            const expectedConversion = TEN_UNITS.mul(
                VADER_VETHER_CONVERSION_RATE
            );
            assertEvents(await converter.convert(TEN_UNITS), {
                Conversion: {
                    user: accounts.account0,
                    vetherAmount: TEN_UNITS,
                    vaderAmount: expectedConversion,
                },
            });

            assertBn(await vether.balanceOf(accounts.account0), 0);
            assertBn(await vether.balanceOf(BURN), TEN_UNITS);
            assertBn(
                await vader.balanceOf(accounts.account0),
                expectedConversion
            );
            assertBn(
                await vader.balanceOf(converter.address),
                VETH_ALLOCATION.sub(expectedConversion)
            );
        });
    });
});
