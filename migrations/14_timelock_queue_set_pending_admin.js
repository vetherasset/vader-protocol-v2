const GovernorAlpha = artifacts.require("GovernorAlpha");
const Timelock = artifacts.require("Timelock");

module.exports = async function (deployer, network, accounts) {
    const gov = await GovernorAlpha.deployed();
    const timelock = await Timelock.deployed();

    // TODO: time lock delay
    const DELAY = 5 * 60;
    const eta = Math.floor(new Date() / 1000) + DELAY;
    const data = web3.eth.abi.encodeParameter("address", gov.address);

    // log ETA, used for next migration script
    console.log(`ETA: ${eta}`);

    const tx = await timelock.queueTransaction(
        timelock.address,
        0,
        "setPendingAdmin(address)",
        data,
        eta
    );

    console.log(tx);
};
