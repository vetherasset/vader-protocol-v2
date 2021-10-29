const Vader = artifacts.require("Vader");
const Converter = artifacts.require("Converter");
const LinearVesting = artifacts.require("LinearVesting");
const USDV = artifacts.require("USDV");

module.exports = async function (deployer, network, accounts) {
    // skip development
    if (network == "development") {
        return
    }
    const vader = await Vader.deployed();
    const converter = await Converter.deployed();
    const vesting = await LinearVesting.deployed();
    const usdv = await USDV.deployed();

    if (network !== "kovan") {
        throw new Error("fix parameters for mainnet");
    }

    // switch to DAO after all contracts are deployed
    const dao = accounts[0];

    const tx = await vader.setComponents(
        converter.address,
        vesting.address,
        usdv.address,
        dao
    );

    console.log(tx);
};
