const Vader = artifacts.require("Vader");
const VaderRouter = artifacts.require("VaderRouter");
const VaderReserve = artifacts.require("VaderReserve");

module.exports = async function (deployer, network, accounts) {
    const vader = await Vader.deployed();
    const router = await VaderRouter.deployed();

    if (network !== "kovan") {
        throw new Error("fix dao address");
    }

    // switch to DAO after all contracts are deployed
    const dao = accounts[0];

    await deployer.deploy(VaderReserve, vader.address, router.address, dao);
};
