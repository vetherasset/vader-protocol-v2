const Timelock = artifacts.require("Timelock");

module.exports = async function (deployer, network, accounts) {
    const admin = accounts[0];
    // TODO: delay
    const delay = 60;

    if (network !== "kovan") {
        throw new Error("fix parameters for mainnet");
    }

    await deployer.deploy(Timelock, admin, delay);
};
