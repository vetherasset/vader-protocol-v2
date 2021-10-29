const Vader = artifacts.require("Vader");

module.exports = function (deployer, network) {
    // skip development
    if (network == "development") {
        return
    }

    deployer.deploy(Vader);
};