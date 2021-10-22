const BN = require("bn.js");
const Vader = artifacts.require("Vader");
const LinearVesting = artifacts.require("LinearVesting");

module.exports = async function (deployer, network) {
    const vader = await Vader.deployed();

    // TODO: fix migration for mainnet
    if (network !== "kovan") {
        throw new Error("Only kovan. Fix vesters and amounts");
    }

    const vesters = ["0x436b9C3A2E29bC2Df6ac1Ef5C5AC35b7b337A43d"];
    const amounts = [
        // 250,000,000
        new BN(250000000).mul(new BN(10).pow(new BN(18))),
    ];

    await deployer.deploy(LinearVesting, vader.address, vesters, amounts);
};
