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

    mintAndApprove,
} = require("./utils")(artifacts);

const keccak256 = require("keccak256");
const { MerkleTree } = require("merkletreejs");

const salt = 123;
const chainId = 1337;

contract("Phase 1", (accounts) => {
    describe("Scenarios", () => {
        it("should deploy the system and check the complete state. Checks for malicious proofs and access/state control along the way", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);
            const { mockMTree } = await deployMock(accounts);

            // ----- GOOD TREE ----- //

            // Create the data for the proof
            const data = await mockMTree.getRoot(
                accounts.account0,
                TEN_UNITS,
                salt,
                chainId
            );

            // Construct the tree
            const tree = new MerkleTree([data], keccak256, {
                hashLeaves: true,
                sortPairs: true,
            });

            // Get the leaf
            const leaf = keccak256(data);

            // Get the leaf proof
            const proof = tree.getHexProof(leaf);

            // Get the root
            const merkelRoot = tree.getHexRoot();

            // ----- MALICIOUS TREE ----- //

            // Create the malicious data for the proof
            const maliciousData = await mockMTree.getRoot(
                accounts.account2,
                TEN_UNITS.mul(TEN_UNITS),
                salt,
                chainId
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
                    salt,
                    ADMINISTRATOR,
                ],
            });

            // Try to convert early should fail
            await assertErrors(
                converter.convert(proof, TEN_UNITS, 1000),
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
            await converter.setVesting(vesting.address, {
                from: ADMINISTRATOR.from,
            });

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

            // Try to mine vader via the mint function by calling it before the setting of the usdv
            await assertErrors(
                vader.mint(accounts.account3, parseUnits(1000, 18)),
                "Vader::_onlyUSDV: Insufficient Privileges"
            );

            // Try to set usdv with a non owner account
            await assertErrors(
                vader.setUSDV(mockUsdv.address, { from: accounts.account2 }),
                "Ownable: caller is not the owner"
            );

            // Try to set usdv with a zero address
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

            // Check if we can get a huge amount back
            await assertErrors(
                converter.convert(proof, TEN_UNITS, TEN_UNITS.mul(TEN_UNITS)),
                "Converter::convert: Vader < min"
            );

            // Perfom the conversion
            await converter.convert(proof, TEN_UNITS, 100);

            // Check if we can convert with a malicious proof
            await assertErrors(
                converter.convert(maliciousProof, TEN_UNITS, 100),
                "Converter::convert: Incorrect Proof Provided"
            );

            // Check if we can reuse the proof
            await assertErrors(
                converter.convert(proof, TEN_UNITS, 100),
                "Converter::convert: Incorrect Proof Provided"
            );

            // Try to mine vader via the mint function by calling it
            await assertErrors(
                vader.mint(accounts.account3, parseUnits(1000, 18)),
                "Vader::_onlyUSDV: Insufficient Privileges"
            );
        });

        it("should check the case of adding a vester in tree and in setComponents and validate the state", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);
            const { mockMTree } = await deployMock(accounts);

            // ----- GOOD TREE ----- //

            // Create the data for the proof
            const data = await mockMTree.getRoot(
                accounts.account1,
                TEN_UNITS,
                salt,
                chainId
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

            const { converter, vader, vesting, ADMINISTRATOR, mockUsdv } =
                await deployMock(accounts, {
                    Converter: (_, { vader, vether, ADMINISTRATOR }) => [
                        vether.address,
                        vader.address,
                        merkelRoot,
                        salt,
                        ADMINISTRATOR,
                    ],
                });

            // Set vesting address
            await converter.setVesting(vesting.address, {
                from: ADMINISTRATOR.from,
            });

            const { TEAM_ALLOCATION } = PROJECT_CONSTANTS;

            // Set the values for converter, vesting and usdv
            await vader.setComponents(
                converter.address,
                vesting.address,
                [accounts.account1],
                [TEAM_ALLOCATION],
                ADMINISTRATOR
            );

            // Set the usdv from the owner account
            await vader.setUSDV(mockUsdv.address, { from: ADMINISTRATOR.from });

            // Check if we can convert a staking spot that is already in the tree
            await assertErrors(
                converter.convert(proof, TEN_UNITS, 100),
                "Converter::convert: Incorrect Proof Provided"
            );

            // Get the vesting data for the account1
            const acc1Vesting = await vesting.vest(accounts.account1);

            // Check if we got the amount that we want
            assertBn(acc1Vesting.amount, TEAM_ALLOCATION);
        });

        // it("should convert from different accounts and check the state", async () => {
        //     if (Array.isArray(accounts))
        //         accounts = await verboseAccounts(accounts);
        //     const { mockMTree, vether } = await deployMock(accounts);

        //     const vetherHolders = [
        //         [accounts.account1, TEN_UNITS],
        //         [accounts.account2, TEN_UNITS],
        //         [accounts.account3, TEN_UNITS],
        //         [accounts.account4, TEN_UNITS],
        //     ];

        //     for (let [account, amount] of vetherHolders) {
        //         await vether.mint(account, amount);
        //     }

        //     for (let [account, amount] of vetherHolders) {
        //         assertBn(await vether.balanceOf(account), amount);
        //     }

        //     // Create the datas for the proofs
        //     const data = [];

        //     for (let [account, amount] of vetherHolders) {
        //         data.push(
        //             await mockMTree.getRoot(account, amount, salt, chainId)
        //         );
        //     }

        //     // Construct the tree
        //     const tree = new MerkleTree(data, keccak256, {
        //         hashLeaves: true,
        //         sortPairs: true,
        //     });

        //     // Get the root
        //     const merkelRoot = tree.getHexRoot();

        //     // Verify proofs soundness
        //     for (let [account, amount] of vetherHolders) {
        //         let leaf = keccak256(
        //             await mockMTree.getRoot(account, amount, salt, chainId)
        //         );
        //         let proof = tree.getProof(leaf);
        //         assert(tree.verify(proof, leaf, merkelRoot), true);
        //     }

        //     const { converter, vader, vesting, ADMINISTRATOR, mockUsdv } =
        //         await deployMock(accounts, {
        //             Converter: (_, { vader, vether, ADMINISTRATOR }) => [
        //                 vether.address,
        //                 vader.address,
        //                 merkelRoot,
        //                 salt,
        //                 ADMINISTRATOR,
        //             ],
        //         });

        //     for (let [account, amount] of vetherHolders) {
        //         await vether.mint(account, amount);
        //     }

        //     await vader.createEmission(
        //         accounts.account5,
        //         parseUnits(523000000, 18),
        //         ADMINISTRATOR
        //     );

        //     // Set vesting address
        //     await converter.setVesting(vesting.address, {
        //         from: ADMINISTRATOR.from,
        //     });

        //     const { TEAM_ALLOCATION } = PROJECT_CONSTANTS;

        //     // Set the values for converter, vesting and usdv
        //     await vader.setComponents(
        //         converter.address,
        //         vesting.address,
        //         [accounts.account0],
        //         [TEAM_ALLOCATION],
        //         ADMINISTRATOR
        //     );

        //     // Set the usdv from the owner account
        //     await vader.setUSDV(mockUsdv.address, { from: ADMINISTRATOR.from });

        //     for (let [account, amount] of vetherHolders) {
        //         let leaf = keccak256(
        //             await mockMTree.getRoot(account, amount, salt, chainId)
        //         );
        //         let proof = tree.getHexProof(leaf);

        //         await vether.approve(converter.address, amount, {
        //             from: account,
        //         });

        //         await vader.approve(
        //             converter.address,
        //             parseUnits(1000000000, 18)
        //         );

        //         await converter.convert(proof, amount, 100, {
        //             from: account,
        //         });
        //     }

        //     for (let [account, amount] of vetherHolders) {
        //         console.log((await vader.balanceOf(account)).toString());
        //     }
        // });
    });
});
