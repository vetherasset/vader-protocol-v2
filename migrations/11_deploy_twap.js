const TwapOracle = artifacts.require("TwapOracle");
const VaderPoolV2 = artifacts.require("VaderPoolV2");

module.exports = async function (deployer, network) {
    // skip development
    if (network == "development") {
        return;
    }
    // TODO: fix params for mainnet
    if (network !== "kovan") {
        throw new Error("fix parameters for mainnet");
    }

    const updatePeriod = 100;
    const pool = await VaderPoolV2.deployed();

    await deployer.deploy(TwapOracle, pool.address, updatePeriod);
};
