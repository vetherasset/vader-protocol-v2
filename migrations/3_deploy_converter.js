const { VETHER, VADER } = require("./constants");

const Converter = artifacts.require("Converter");

const MERKLE_ROOTS = {
    mainnet:
        "0x93bc4275f0e850574c848d04f1a8edbb63a1d961524541e618d28f31b2c6684d",
    kovan: "0x076beee425cd687f1c68f81585d9cd19398b7e80cdcc48465c175e959946fdcd",
};

const CONVERTER_SALTS = {
    mainnet: 13662469,
    kovan: 28516565,
};

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
