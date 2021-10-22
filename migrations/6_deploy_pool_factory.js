const VaderMath = artifacts.require("VaderMath");
const VaderPoolFactory = artifacts.require("VaderPoolFactory");

module.exports = async function (deployer) {
    await deployer.link(VaderMath, VaderPoolFactory);
    await deployer.deploy(VaderPoolFactory);
};
