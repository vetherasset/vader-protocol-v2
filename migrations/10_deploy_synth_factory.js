const SynthFactory = artifacts.require("SynthFactory");
const VaderPoolV2 = artifacts.require("VaderPoolV2");

module.exports = async function (deployer, network) {
    // skip development
    if (network == "development") {
        return
    }
    const pool = await VaderPoolV2.deployed();

    await deployer.deploy(SynthFactory, pool.address);
};
