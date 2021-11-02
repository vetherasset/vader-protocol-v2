const VaderRouterV2 = artifacts.require("VaderRouterV2");
const VaderReserve = artifacts.require("VaderReserve");

module.exports = async function (deployer, network, accounts) {
    // skip development
    if (network == "development") {
        return
    }
    const router = await VaderRouterV2.deployed();
    const reserve = await VaderReserve.deployed();

    if (network !== "kovan") {
        throw new Error("fix parameters for mainnet");
    }

    const tx = await router.initialize(
        reserve.address,
    );

    console.log(tx);
};
