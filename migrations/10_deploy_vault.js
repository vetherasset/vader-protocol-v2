// TODO: deploy Vault
const MockVault = artifacts.require("MockVault");

module.exports = async function (deployer, network) {
    if (network !== "kovan") {
        throw new Error("fix parameters for mainnet");
    }
    await deployer.deploy(MockVault);
};
