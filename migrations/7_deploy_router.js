const VaderMath = artifacts.require("VaderMath");
const VaderPoolFactory = artifacts.require("VaderPoolFactory");
const VaderRouter = artifacts.require("VaderRouter");

module.exports = async function (deployer) {
    const factory = await VaderPoolFactory.deployed();

    await deployer.link(VaderMath, VaderRouter);
    await deployer.deploy(VaderRouter, factory.address);
};
