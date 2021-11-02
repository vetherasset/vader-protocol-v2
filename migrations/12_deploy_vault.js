// TODO: deploy Vault
const MockVault = artifacts.require("MockVault");

module.exports = async function (deployer, network) {
    // skip development
    if (network == "development") {
        return
    }
    if (network !== "kovan") {
        throw new Error("fix parameters for mainnet");
    }
    await deployer.deploy(MockVault);
};
