const XVader = artifacts.require("XVader");
const GovernorAlpha = artifacts.require("GovernorAlpha");

module.exports = async function (deployer, network, accounts) {
    // skip development
    if (network == "development") {
        return;
    }
    if (network !== "kovan") {
        throw new Error("fix parameters for mainnet");
    }

    const xVader = await XVader.deployed();

    // TODO: guardian address
    const guardian = accounts[0];
    // TODO: fee receiver address
    const feeReceiver = accounts[0];
    // TODO: fee amount
    const feeAmount = 1;
    // TODO: council address
    const council = accounts[0];

    await deployer.deploy(
        GovernorAlpha,
        guardian,
        xVader.address,
        feeReceiver,
        feeAmount,
        council
    );
};
