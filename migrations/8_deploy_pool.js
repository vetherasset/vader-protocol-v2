const VaderMath = artifacts.require("VaderMath");
const VaderPoolV2 = artifacts.require("VaderPoolV2");
const USDV = artifacts.require("USDV");

module.exports = async function (deployer, network) {
    // skip development
    if (network == "development") {
        return
    }
    await deployer.link(VaderMath, VaderPoolV2);
    
    // TODO: queue active and native asset (USDV) for mainnet
    if (network !== "kovan") {
        throw new Error("fix parameters for mainnet");
    }

    const usdv = await USDV.deployed()
    await deployer.deploy(VaderPoolV2, false, usdv.address);
};
