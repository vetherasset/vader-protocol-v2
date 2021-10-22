// TODO: deploy Vault
const MockVault = artifacts.require("MockVault");

module.exports = async function (deployer, network) {
    await deployer.deploy(MockVault);
};
