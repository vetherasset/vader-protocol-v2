const UnlockValidator = artifacts.require("UnlockValidator");

module.exports = async function (deployer, network) {
    // skip development
    if (network == "development") {
        return;
    }

    await deployer.deploy(UnlockValidator);
};
