const USDV = artifacts.require("USDV");
const { VADER } = require("./constants");

module.exports = async function (deployer, network) {
    // skip development
    if (network == "development") {
        return;
    }

    const vader = VADER[network];
    console.log(`Vader: ${vader}`);

    await deployer.deploy(USDV, vader);
};
