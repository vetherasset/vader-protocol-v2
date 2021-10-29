const VaderMath = artifacts.require("VaderMath");
const VaderPoolV2 = artifacts.require("VaderPoolV2");
const VaderRouterV2 = artifacts.require("VaderRouterV2");

module.exports = async function (deployer) {
    const pool = await VaderPoolV2.deployed();

    await deployer.link(VaderMath, VaderRouterV2);
    await deployer.deploy(VaderRouterV2, pool.address);
};
