// TODO: use Vault
const MockVault = artifacts.require("MockVault");
const USDV = artifacts.require("USDV");
const GovernorAlpha = artifacts.require("GovernorAlpha");

module.exports = async function (deployer, network, accounts) {
    // skip development
    if (network == "development") {
        return
    }
    const vault = await MockVault.deployed();
    const usdv = await USDV.deployed();

    // TODO: guardian address
    const guardian = accounts[0];
    // TODO: fee receiver address
    const feeReceiver = accounts[0];
    // TODO: fee amount
    const feeAmount = 1;
    // TODO: council address
    const council = accounts[0];

    if (network !== "kovan") {
        throw new Error("fix parameters for mainnet");
    }

    await deployer.deploy(
        GovernorAlpha,
        vault.address,
        guardian,
        usdv.address,
        feeReceiver,
        feeAmount,
        council
    );
};
