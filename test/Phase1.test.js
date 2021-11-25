const {
    // Deployment Function
    deployMock,

    // Testing Utilities
    assertBn,
    assertErrors,
    assertEvents,
    UNSET_ADDRESS,
    DEFAULT_CONFIGS,
    parseUnits,

    // Library Functions
    verboseAccounts,
    time,
    big,

    // Project Specific Constants
    PROJECT_CONSTANTS,
    TEN_UNITS,
} = require("./utils")(artifacts);

const keccak256 = require("keccak256");
const { MerkleTree } = require("merkletreejs");

contract.only("Phase 1", (accounts) => {
    describe("System setup", () => {
        it("should deploy the system and check the complete state. Checks for malicious proofs and access/state control along the way", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);
            const { mockMTree } = await deployMock(accounts);

            // ----- GOOD TREE ----- //

            // Create the data for the proof
            const data = await mockMTree.getRoot(
                accounts.account0,
                TEN_UNITS,
                123,
                1337
            );

            // Construct the tree
            const tree = new MerkleTree([data], keccak256, {
                hashLeaves: true,
                sortPairs: true,
            });

            // Get the leaf
            const leaf = keccak256(data);

            // Get the root
            const merkelRoot = tree.getHexRoot();

            // Get the leaf proof
            const proof = tree.getHexProof(leaf);

            // ----- MALICIOUS TREE ----- //

            // Create the malicious data for the proof
            const maliciousData = await mockMTree.getRoot(
                accounts.account2,
                TEN_UNITS.mul(TEN_UNITS),
                123,
                1337
            );

            // Construct the malicious tree
            const maliciousTree = new MerkleTree([maliciousData], keccak256, {
                hashLeaves: true,
                sortPairs: true,
            });

            // Get the malicious leaf
            const maliciousLeaf = keccak256(maliciousData);

            // Get the leaf malicious proof
            const maliciousProof = maliciousTree.getHexProof(maliciousLeaf);

            const {
                converter,
                vether,
                vader,
                vesting,
                ADMINISTRATOR,
                mockUsdv,
            } = await deployMock(accounts, {
                Converter: (_, { vader, vether, ADMINISTRATOR }) => [
                    vether.address,
                    vader.address,
                    merkelRoot,
                    123, // salt
                    ADMINISTRATOR,
                ],
            });

            // Try to convert early should fail
            await assertErrors(
                converter.convert(proof, TEN_UNITS),
                "Converter::convert: Vesting is not set"
            );

            // Try to get claim to early
            await assertErrors(
                vesting.getClaim(accounts.account0),
                "LinearVesting::_hasStarted: Vesting hasn't started yet"
            );

            // Make sure that vader and converter are good
            assert.notEqual(await vader.address, UNSET_ADDRESS);
            assert.notEqual(await converter.address, UNSET_ADDRESS);

            // Vesting is not set yet
            assert.equal(await converter.vesting(), UNSET_ADDRESS);

            // Set vesting address
            await converter.setVesting(vesting.address);

            // Check if the vesting address is set properly
            assert.equal(await converter.vesting(), await vesting.address);

            // Check if the vader properties are not set
            assert.equal(await vader.converter(), UNSET_ADDRESS);
            assert.equal(await vader.vest(), UNSET_ADDRESS);
            assert.equal(await vader.usdv(), UNSET_ADDRESS);

            const { TEAM_ALLOCATION } = PROJECT_CONSTANTS;

            // Set the values for converter, vesting and usdv
            await vader.setComponents(
                converter.address,
                vesting.address,
                [accounts.account1],
                [TEAM_ALLOCATION],
                ADMINISTRATOR
            );

            // Try with a non owner account
            await assertErrors(
                vader.setUSDV(mockUsdv.address, { from: accounts.account2 }),
                "Ownable: caller is not the owner"
            );

            // Try with a zero address
            await assertErrors(
                vader.setUSDV(UNSET_ADDRESS, { from: ADMINISTRATOR.from }),
                "Vader::setUSDV: Invalid USDV address"
            );

            // Set the usdv from the owner account
            await vader.setUSDV(mockUsdv.address, { from: ADMINISTRATOR.from });

            // Try to reset it with the owner
            await assertErrors(
                vader.setUSDV(mockUsdv.address, { from: ADMINISTRATOR.from }),
                "Vader::setUSDV: USDV already set"
            );

            // Check the values if they are properly set
            assert.equal(await vader.converter(), await converter.address);
            assert.equal(await vader.vest(), await vesting.address);
            assert.equal(await vader.usdv(), await mockUsdv.address);

            await vether.mint(accounts.account0, TEN_UNITS);
            await vether.approve(converter.address, TEN_UNITS, {
                from: accounts.account0,
            });

            await converter.convert(proof, TEN_UNITS);

            // Check if we can convert with a malicious proof
            await assertErrors(
                converter.convert(maliciousProof, TEN_UNITS),
                "Converter::convert: Incorrect Proof Provided"
            );

            await assertErrors(
                converter.convert(proof, TEN_UNITS),
                "Converter::convert: Incorrect Proof Provided"
            );
        });
    });
});
