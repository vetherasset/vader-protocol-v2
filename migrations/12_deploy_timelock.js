const Timelock = artifacts.require("Timelock");

module.exports = async function (deployer, network, accounts) {
    const admin = accounts[0];
    // TODO: delay
    const delay = 60;

    await deployer.deploy(Timelock, admin, delay);
};
