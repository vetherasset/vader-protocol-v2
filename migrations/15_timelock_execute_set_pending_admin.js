const GovernorAlpha = artifacts.require("GovernorAlpha");
const Timelock = artifacts.require("Timelock");

module.exports = async function (deployer, network, accounts) {
    const gov = await GovernorAlpha.deployed();
    const timelock = await Timelock.deployed();

    // edit for each transaction
    const eta = 1634800752;
    const data = web3.eth.abi.encodeParameter("address", gov.address);

    const tx = await timelock.executeTransaction(
        timelock.address,
        0,
        "setPendingAdmin(address)",
        data,
        eta
    );

    console.log(tx);
};
