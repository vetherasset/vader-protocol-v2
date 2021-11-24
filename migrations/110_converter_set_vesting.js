const { VESTING, CONVERTER } = require("./constants");
const Converter = artifacts.require("Converter");

module.exports = async function (deployer, network) {
    // skip development
    if (network == "development") {
        return;
    }

    const vesting = VESTING[network];
    const converter = await Converter.at(CONVERTER[network]);

    const tx = await converter.setVesting(vesting);

    console.log(tx);
};
