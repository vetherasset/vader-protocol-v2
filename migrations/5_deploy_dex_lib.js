const VaderMath = artifacts.require("VaderMath");

module.exports = async function (deployer, network) {
    // skip development
    if (network == "development") {
        return
    }
    await deployer.deploy(VaderMath);
};
