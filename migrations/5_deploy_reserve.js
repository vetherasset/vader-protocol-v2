const Vader = artifacts.require("Vader");
const VaderReserve = artifacts.require("VaderReserve");

module.exports = async function (deployer, network, accounts) {
    // skip development
    if (network == "development") {
        return
    }
    const vader = await Vader.deployed();

    if (network !== "kovan") {
        throw new Error("fix parameters for mainnet");
    }

    await deployer.deploy(VaderReserve, vader.address)
};
