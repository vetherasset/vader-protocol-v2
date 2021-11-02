const VaderPoolV2 = artifacts.require("VaderPoolV2");
const LPWrapper = artifacts.require("LPWrapper");
const SynthFactory = artifacts.require("SynthFactory");

module.exports = async function (deployer, network, accounts) {
    // skip development
    if (network == "development") {
        return
    }
    const pool = await VaderPoolV2.deployed();
    const wrapper = await LPWrapper.deployed();
    const synthFactory = await SynthFactory.deployed();

    if (network !== "kovan") {
        throw new Error("fix parameters for mainnet");
    }

    const tx = await pool.initialize(
        wrapper.address,
        synthFactory.address,
    );

    console.log(tx);
};
