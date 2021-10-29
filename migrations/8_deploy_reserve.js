const Vader = artifacts.require("Vader");
const VaderRouterV2 = artifacts.require("VaderRouterV2");
const VaderReserve = artifacts.require("VaderReserve");

module.exports = async function (deployer, network, accounts) {
    // skip development
    if (network == "development") {
        return
    }
    const vader = await Vader.deployed();
    const router = await VaderRouterV2.deployed();

    if (network !== "kovan") {
        throw new Error("fix parameters for mainnet");
    }

    // switch to DAO after all contracts are deployed
    const dao = accounts[0];

    await deployer.deploy(VaderReserve, vader.address, router.address, dao);
};
