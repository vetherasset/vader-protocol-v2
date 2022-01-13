const assert = require("assert");
const MockToken = artifacts.require("MockToken");

module.exports = function (deployer, network) {
    // skip development
    if (network == "development") {
        return;
    }

    assert(network == "kovan", "network != Kovan");

    deployer.deploy(MockToken, "VADER", "VADER", 18);
};
