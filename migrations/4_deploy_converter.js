const { VETHER } = require("./constants");

const Vader = artifacts.require("Vader");
const LinearVesting = artifacts.require("LinearVesting");
const Converter = artifacts.require("Converter");

module.exports = async function (deployer, network) {
    // skip development
    if (network == "development") {
        return;
    }

    // TODO: fix migration for mainnet
    if (network !== "kovan") {
        throw new Error("fix parameters for mainnet");
    }

    // TODO: merkle root
    const root =
        "0x0000000000000000000000000000000000000000000000000000000000000000";

    const vether = VETHER[network];
    const vader = await Vader.deployed();
    const vesting = await LinearVesting.deployed();

    await deployer.deploy(
        Converter,
        vether,
        vader.address,
        vesting.address,
        root
    );
};
