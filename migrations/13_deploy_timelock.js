const Timelock = artifacts.require("Timelock");

module.exports = async function (deployer, network, accounts) {
    // skip development
    if (network == "development") {
        return;
    }
    if (network !== "kovan") {
        throw new Error("fix parameters for mainnet");
    }

    const admin = accounts[0];
    // TODO: delay
    const delay = 60;

    await deployer.deploy(Timelock, admin, delay);
};
