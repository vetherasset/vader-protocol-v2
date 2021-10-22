const GovernorAlpha = artifacts.require("GovernorAlpha");

module.exports = async function (deployer, network, accounts) {
    const gov = await GovernorAlpha.deployed();

    const tx = await gov.__acceptAdmin();

    console.log(tx);
};
