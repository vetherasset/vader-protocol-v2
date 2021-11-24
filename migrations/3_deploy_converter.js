const { VETHER, VADER, MERKLE_ROOTS, CONVERTER_SALTS } = require("./constants");

const Converter = artifacts.require("Converter");

module.exports = async function (deployer, network) {
    // skip development
    if (network == "development") {
        return;
    }

    const vether = VETHER[network];
    const vader = VADER[network];
    const root = MERKLE_ROOTS[network];
    const salt = CONVERTER_SALTS[network];

    await deployer.deploy(Converter, vether, vader, root, salt);
};
