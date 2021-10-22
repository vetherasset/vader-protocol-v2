const VaderPoolFactory = artifacts.require("VaderPoolFactory");
const USDV = artifacts.require("USDV");

module.exports = async function (deployer, network, accounts) {
    const factory = await VaderPoolFactory.deployed();
    const usdv = await USDV.deployed();

    // switch to DAO after all contracts are deployed
    const dao = accounts[0];

    const tx = await factory.initialize(usdv.address, dao);
    console.log(tx);
};
