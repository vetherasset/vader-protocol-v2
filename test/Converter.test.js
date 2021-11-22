const {
    // Deployment Function
    deployMock,

    // Testing Utilities
    assertBn,
    assertErrors,
    assertEvents,
    TEN_UNITS,
    UNSET_ADDRESS,
    parseUnits,

    // Library Functions
    verboseAccounts,

    // Project Specific Constants
    PROJECT_CONSTANTS,
} = require("./utils")(artifacts);

const keccak256 = require("keccak256");
const { MerkleTree } = require("merkletreejs");

contract.only("Converter", (accounts) => {
    describe("construction", () => {
        it("should prevent deployment of the converter with a zero address Vether / Vader contract", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);

            const { mockMTree } = await deployMock(accounts);
            const data = await mockMTree.getRoot(
                accounts.account0,
                TEN_UNITS,
                123,
                1337
            );

            const tree = new MerkleTree([data], keccak256, {
                hashLeaves: true,
                sortPairs: true,
            });

            const merkelRoot = tree.getHexRoot();

            await assertErrors(
                deployMock(accounts, {
                    Converter: () => [
                        UNSET_ADDRESS,
                        accounts.account0,
                        merkelRoot,
                        123,
                    ],
                }),
                "Converter::constructor: Misconfiguration"
            );

            await assertErrors(
                deployMock(accounts, {
                    Converter: () => [
                        accounts.account0,
                        UNSET_ADDRESS,
                        merkelRoot,
                        123,
                    ],
                }),
                "Converter::constructor: Misconfiguration"
            );
        });

        it("should deploy the Converter contract with a correct state", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);
            const { converter, vether, vader, vesting } = await deployMock(
                accounts
            );
            await converter.setVesting(vesting.address);
            assert.ok(converter.address);

            assert.equal(await converter.vether(), vether.address);
            assert.equal(await converter.vader(), vader.address);
        });
    });

    describe("initialization", () => {
        it("should properly initialize the converter by having Vader mint the corresponding amount of tokens to it", async () => {
            const { vader, vesting, converter, ADMINISTRATOR } =
                await deployMock();

            const { VETH_ALLOCATION, TEAM_ALLOCATION } = PROJECT_CONSTANTS;

            assertBn(await vader.balanceOf(converter.address), 0);

            await vader.setComponents(
                converter.address,
                vesting.address,
                accounts.dao,
                [accounts.account0],
                [TEAM_ALLOCATION],
                ADMINISTRATOR
            );

            assertBn(await vader.balanceOf(converter.address), VETH_ALLOCATION);
        });
    });

    describe("conversion", () => {
        it("should disallow zero-value conversions", async () => {
            const { converter } = await deployMock();

            await assertErrors(
                converter.convert([], 0),
                "Converter::convert: Non-Zero Conversion Amount Required"
            );
        });

        it("should fail to convert with incorect proof", async () => {
            const { converter, vether } = await deployMock();

            await vether.mint(accounts.account0, TEN_UNITS);

            await assertErrors(
                converter.convert([], TEN_UNITS),
                "Converter::convert: Incorrect Proof Provided"
            );
        });

        it("should properly support one-way conversion from Vader to Vether", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);
            const { mockMTree } = await deployMock(accounts);
            const data = await mockMTree.getRoot(
                accounts.account0,
                TEN_UNITS,
                123,
                1337
            );
            const tree = new MerkleTree([data], keccak256, {
                hashLeaves: true,
                sortPairs: true,
            });
            const leaf = keccak256(data);
            const merkelRoot = tree.getHexRoot();
            const proof = tree.getHexProof(leaf);
            const { converter, vether, vader, vesting, ADMINISTRATOR } =
                await deployMock(accounts, {
                    Converter: (_, { vader, vether, ADMINISTRATOR }) => [
                        vether.address,
                        vader.address,
                        merkelRoot,
                        123, // salt
                        ADMINISTRATOR,
                    ],
                });

            const {
                VADER_VETHER_CONVERSION_RATE,
                VETH_ALLOCATION,
                BURN,
                TEAM_ALLOCATION,
            } = PROJECT_CONSTANTS;
            await vader.setComponents(
                converter.address,
                vesting.address,
                accounts.dao,
                [accounts.account1],
                [TEAM_ALLOCATION],
                ADMINISTRATOR
            );
            await vether.mint(accounts.account0, TEN_UNITS);
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
            await converter.setVesting(vesting.address);
            assertEvents(await converter.convert(proof, TEN_UNITS), {
                Conversion: {
                    user: accounts.account0,
                    vetherAmount: TEN_UNITS,
                    vaderAmount: expectedConversion,
                },
            });
            assertBn(await vether.balanceOf(accounts.account0), 0);
            assertBn(await vether.balanceOf(BURN), TEN_UNITS);
            assertBn(
                await vader.balanceOf(converter.address),
                VETH_ALLOCATION.sub(expectedConversion)
            );
        });
    });
});
