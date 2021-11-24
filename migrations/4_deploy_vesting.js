const { VADER, CONVERTER } = require("./constants");
const LinearVesting = artifacts.require("LinearVesting");

module.exports = async function (deployer, network) {
    // skip development
    if (network == "development") {
        return;
    }

    const vader = VADER[network];
    const converter = CONVERTER[network];

    await deployer.deploy(LinearVesting, vader, converter);
};
