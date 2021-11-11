const BN = require("bn.js");
const Vader = artifacts.require("Vader");
const LinearVesting = artifacts.require("LinearVesting");

module.exports = async function (deployer, network) {
    // skip development
    if (network == "development") {
        return;
    }

    const vader = await Vader.deployed();

    // TODO: fix migration for mainnet
    if (network !== "kovan") {
        throw new Error("fix parameters for mainnet");
    }

    const vesters = ["0x95693eB2857B3dcae39E000B0F7a5A40cB0B1Daf"];
    const amounts = [
        // 2,500,000,000
        new BN(2500000000).mul(new BN(10).pow(new BN(18))),
    ];

    await deployer.deploy(LinearVesting, vader.address, vesters, amounts);
};
