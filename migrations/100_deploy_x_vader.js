const Vader = artifacts.require("Vader");
const XVader = artifacts.require("XVader");

module.exports = async function (deployer, network) {
    // skip development
    if (network == "development") {
        return;
    }
    const vader = await Vader.deployed();

    await deployer.deploy(XVader, vader.address);
};
