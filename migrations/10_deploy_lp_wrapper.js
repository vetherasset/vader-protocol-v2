const LPWrapper = artifacts.require("LPWrapper");
const VaderPoolV2 = artifacts.require("VaderPoolV2");

module.exports = async function (deployer, network) {
    // skip development
    if (network == "development") {
        return
    }
    const pool = await VaderPoolV2.deployed();

    await deployer.deploy(LPWrapper, pool.address);
};
