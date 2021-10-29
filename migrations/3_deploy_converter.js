const { VETHER } = require("./constants");

const Vader = artifacts.require("Vader");
const Converter = artifacts.require("Converter");

module.exports = async function (deployer, network) {
    // skip development
    if (network == "development") {
        return
    }

    const vether = VETHER[network];
    const vader = await Vader.deployed();

    await deployer.deploy(Converter, vether, vader.address);
};
