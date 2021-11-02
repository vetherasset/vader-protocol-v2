const GovernorAlpha = artifacts.require("GovernorAlpha");
const Timelock = artifacts.require("Timelock");

module.exports = async function (deployer, network, accounts) {
    // skip development
    if (network == "development") {
        return
    }
    const gov = await GovernorAlpha.deployed();
    const timelock = await Timelock.deployed();

    if (network !== "kovan") {
        throw new Error("fix parameters for mainnet");
    }

    // edit for each transaction
    const eta = 1635234532;
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
