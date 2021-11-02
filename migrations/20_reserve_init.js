const VaderReserve = artifacts.require("VaderReserve");
const VaderRouterV2 = artifacts.require("VaderRouterV2");

module.exports = async function (deployer, network, accounts) {
    // skip development
    if (network == "development") {
        return
    }
    const reserve = await VaderReserve.deployed();
    const router = await VaderRouterV2.deployed();

    if (network !== "kovan") {
        throw new Error("fix parameters for mainnet");
    }

    // switch to DAO after all contracts are deployed
    const dao = accounts[0];

    const tx = await reserve.initialize(
        router.address,
        dao
    );

    console.log(tx);
};
