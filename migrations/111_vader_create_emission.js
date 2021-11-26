const BN = require("bn.js");
const { VADER, CONVERTER, VESTING } = require("./constants");
const Vader = artifacts.require("Vader");

module.exports = async function (deployer, network) {
    // skip development
    if (network == "development") {
        return;
    }

    const vader = await Vader.at(VADER[network]);

    const TO = "0x4a4ac2f0993ccb237a85c05b7c463c5c6e2f2a2d";
    const EMISSION = new BN(534_000_000).mul(new BN(10).pow(new BN(18)));

    const tx = await vader.createEmission(TO, EMISSION);

    console.log(tx);
};
