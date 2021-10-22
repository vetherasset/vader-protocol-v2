const VaderMath = artifacts.require("VaderMath");

module.exports = async function (deployer) {
    await deployer.deploy(VaderMath);
};
