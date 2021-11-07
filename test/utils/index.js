const {
    time, // Time support with custom block timeouts
} = require("@openzeppelin/test-helpers");

module.exports = (artifacts) => {
    // Mocks
    const MockToken = artifacts.require("MockToken");
    const MockConstants = artifacts.require("MockConstants");
    const GovernorAlpha = artifacts.require("MockGovernorAlpha");
    const MockXVader = artifacts.require("MockXVader");
    const Timelock = artifacts.require("MockTimelock");
    const MockAggregatorV3 = artifacts.require("MockAggregatorV3");

    // Project Contracts
    const Vader = artifacts.require("Vader");
    const VaderReserve = artifacts.require("VaderReserve");
    const VaderPoolFactory = artifacts.require("VaderPoolFactory");
    const VaderPool = artifacts.require("VaderPool");
    const VaderRouter = artifacts.require("VaderRouter");
    const USDV = artifacts.require("USDV");
    const Converter = artifacts.require("Converter");
    const LinearVesting = artifacts.require("LinearVesting");
    const VaderMath = artifacts.require("VaderMath");
    const BasePool = artifacts.require("BasePool");

    // V2
    const VaderRouterV2 = artifacts.require("VaderRouterV2");
    const VaderPoolV2 = artifacts.require("VaderPoolV2");
    const BasePoolV2 = artifacts.require("BasePoolV2");
    const Synth = artifacts.require("Synth");
    const SynthFactory = artifacts.require("SynthFactory");
    const LPToken = artifacts.require("LPToken");
    const LPWrapper = artifacts.require("LPWrapper");
    const TWAP = artifacts.require("TwapOracle");
    const XVader = artifacts.require("XVader");

    // Libraries

    // Generic Utilities

    const big = (n) => web3.utils.toBN(n);

    const parseUnits = (units, pow) => big(+units).mul(big(10).pow(big(pow)));

    const log = (v) => console.log("DEBUG: ", v.toString());

    const compare = (a, b) => {
        if (Array.isArray(b)) {
            const deviance = b.pop();
            [b] = b;
            return b.add(deviance).gte(a) && b.sub(deviance).lte(a);
        } else return a.toString() === b.toString();
    };

    const assertBn = (a, b, deviance, debug) => {
        if (deviance) {
            if (debug) {
                log("Upper: " + b.add(deviance).toString());
                log("Lower: " + b.sub(deviance).toString());
                log("Actual: " + a.toString());
                return;
            }
            return (
                assert.ok(b.add(deviance).gte(a)) &&
                assert.ok(b.sub(deviance).lte(a))
            );
        } else return assert.equal(a.toString(), b.toString());
    };

    const assertEvents = ({ logs }, events) => {
        const names = Object.keys(events);
        names.forEach((name) => {
            const specificLogs = logs.filter((log) => log.event === name);

            if (!specificLogs || specificLogs.length === 0)
                assert.fail(`Event ${name} Not Fired`);

            for (let log of specificLogs) {
                if (!Array.isArray(events[name])) events[name] = [events[name]];

                let matched;
                for (let argSet of events[name]) {
                    const args = Object.keys(argSet);
                    matched =
                        matched ||
                        args.every((arg) => {
                            const value = log.args[arg];
                            if (
                                typeof value === "string" &&
                                value !== argSet[arg]
                            ) {
                                if (specificLogs.length === 1)
                                    assert.fail(
                                        `Event ${name} Argument ${arg} Does Not Match (expected: ${argSet[arg]} vs actual: ${value})`
                                    );

                                return false;
                            } else if (!compare(value, argSet[arg])) {
                                if (specificLogs.length === 1)
                                    assert.fail(
                                        `Event ${name} Argument ${arg} Does Not Match (expected: ${argSet[arg]} vs actual: ${value})`
                                    );

                                return false;
                            }
                            return true;
                        });
                }

                if (!matched)
                    assert.fail(
                        `Event ${name} Did Not Match Any Argument Sets`
                    );
            }
        });
    };

    const assertErrors = async (p, err, d) => {
        let error = { message: "" };
        try {
            await p;
            if (d) return log("Successfully executed");
        } catch (e) {
            if (d) return log(e.message.slice(0, 500));
            error = e;
        }
        assert.ok(
            Array.isArray(err)
                ? err.some((_err) => error.message.indexOf(_err) !== -1)
                : error.message.indexOf(err) !== -1
        );
    };

    const getNativeBalance = async (a) => big(await web3.eth.getBalance(a));

    const verboseAccounts = async (accounts) => {
        const verboseAccounts = [
            "account0",
            "account1",
            "account2",
            "account3",
            "account4",
            "account5",
            "dao",
            "administrator",
            "voter",
        ];
        const usedAccounts = accounts.slice(0, verboseAccounts.length);
        const remaining = accounts.slice(verboseAccounts.length);

        for (let i = 0; i < remaining.length; i++) {
            const balance = await getNativeBalance(remaining[i]);

            if (balance.gt(big(0)))
                for (let j = 0; j < usedAccounts.length; j++)
                    await web3.eth.sendTransaction({
                        from: remaining[i],
                        to: usedAccounts[j],
                        value: balance.div(big(usedAccounts.length)),
                        gasPrice: big(0),
                    });
        }

        return verboseAccounts.reduce((acc, v, i) => {
            acc[v] = usedAccounts[i];
            return acc;
        }, {});
    };

    const rpc = async (request) =>
        new Promise((okay, fail) =>
            web3.currentProvider.send(request, (err, res) =>
                err ? fail(err) : okay(res)
            )
        );

    const UNSET_ADDRESS = "0x0000000000000000000000000000000000000000";
    const TEN_UNITS = parseUnits(10, 18);

    // Project Constants

    const PROJECT_CONSTANTS = {};

    const DEFAULT_CONFIGS = {
        Vader: (_, { ADMINISTRATOR }) => [ADMINISTRATOR],
        VaderPoolFactory: (_, { ADMINISTRATOR }) => [ADMINISTRATOR],
        VaderRouter: (_, { factory }) => [factory.address],
        VaderReserve: (_, { vader }) => [vader.address],
        USDV: (_, { vader, reserve }) => [vader.address, reserve.address],
        LinearVesting: ({ account0 }, { vader, ADMINISTRATOR }) => [
            vader.address,
            [account0],
            [PROJECT_CONSTANTS.TEAM_ALLOCATION],
            ADMINISTRATOR,
        ],
        Converter: (_, { vader, vether }) => [vether.address, vader.address],
        GovernorAlpha: ({ account0, account1 }, { mockXVader }) => [
            account0,
            mockXVader.address,
            account1,
            parseUnits(1000, 18),
            account0,
        ],
        MockXVader: (_, { vader }) => [vader.address],
        Timelock: (_, { governorAlpha }) => [
            governorAlpha.address,
            big(10 * 60), // default delay of 10 minutes
        ],
        VaderPoolV2: (_, { mockUsdv }) => [true, mockUsdv.address],
        VaderRouterV2: (_, { poolV2 }) => [poolV2.address],
        LPWrapper: (_, { poolV2 }) => [poolV2.address],
        SynthFactory: (_, { poolV2 }) => [poolV2.address],
        TWAP: (_, { poolV2 }) => [poolV2.address, big(1200 * 60)],
        XVader: (_, { vader }) => [vader.address],
    };

    // Project Utilities

    const advanceEpochs = async (vader, eras = 1) => {
        await time.increaseTo(
            (
                await vader.lastEmission()
            ).add(PROJECT_CONSTANTS.EMISSION_ERA.mul(big(eras)))
        );
    };

    let initialized;
    let cached;

    // Used to Link Libraries
    const link = async () => {
        const vaderMath = await VaderMath.new();
        await VaderPoolFactory.link("VaderMath", vaderMath.address);
        await VaderRouter.link("VaderMath", vaderMath.address);
        await VaderPoolV2.link("VaderMath", vaderMath.address);
    };

    // Used to retrieve project constants
    const constants = async () => {
        const mockConstants = await MockConstants.new();
        const getters = Object.keys(mockConstants).filter(
            (n) => n.toUpperCase() === n
        );

        for (let i = 0; i < getters.length; i++)
            PROJECT_CONSTANTS[getters[i]] = await mockConstants[getters[i]]();
    };

    const deployMock = async (accounts, configs) => {
        configs = { ...DEFAULT_CONFIGS, ...configs };

        if (accounts === undefined) {
            if (cached) return cached;
            else {
                log("Incorrect Mock Deployment Invocation");
                process.exit(1);
            }
        }

        if (!initialized) {
            await link();
            await constants();
            initialized = true;
        }

        cached = {};

        cached.ADMINISTRATOR = {
            from: accounts.administrator,
            gasPrice: big(0),
        };

        cached.VESTER = {
            from: accounts.account0,
            gasPrice: big(0),
        };

        cached.FAKE_DAO = {
            from: accounts.dao,
            gasPrice: big(0),
        };

        // Mock Deployments
        cached.vether = await MockToken.new("Vether", "VETH", 18);
        cached.mockUsdv = await MockToken.new("Fake USDV", "USDV", 18);
        cached.dai = await MockToken.new("DAI", "DAI", 18);
        cached.token = await MockToken.new("TKN", "TKN", 18);
        cached.erc20Dec8 = await MockToken.new("DEC8", "DEC8", 8);
        cached.erc20Dec12 = await MockToken.new("DEC12", "DEC12", 12);
        cached.maliciousToken = await MockToken.new("MALC", "MALC", 18);

        // Project Deployments
        cached.vader = await Vader.new(...configs.Vader(accounts, cached));

        cached.factory = await VaderPoolFactory.new(
            ...configs.VaderPoolFactory(accounts, cached)
        );

        cached.router = await VaderRouter.new(
            ...configs.VaderRouter(accounts, cached)
        );

        cached.reserve = await VaderReserve.new(
            ...configs.VaderReserve(accounts, cached)
        );

        cached.usdv = await USDV.new(...configs.USDV(accounts, cached));

        cached.vesting = await LinearVesting.new(
            ...configs.LinearVesting(accounts, cached)
        );

        cached.converter = await Converter.new(
            ...configs.Converter(accounts, cached)
        );

        cached.mockXVader = await MockXVader.new(
            ...configs.MockXVader(accounts, cached)
        );

        cached.governorAlpha = await GovernorAlpha.new(
            ...configs.GovernorAlpha(accounts, cached)
        );

        cached.timelock = await Timelock.new(
            ...configs.Timelock(accounts, cached)
        );

        cached.poolV2 = await VaderPoolV2.new(
            ...configs.VaderPoolV2(accounts, cached)
        );
        cached.routerV2 = await VaderRouterV2.new(
            ...configs.VaderRouterV2(accounts, cached)
        );
        cached.lpWrapper = await LPWrapper.new(
            ...configs.LPWrapper(accounts, cached)
        );
        cached.synthFactory = await SynthFactory.new(
            ...configs.SynthFactory(accounts, cached)
        );

        cached.twap = await TWAP.new(...configs.TWAP(accounts, cached));

        cached.xVader = await XVader.new(...configs.XVader(accounts, cached));

        return cached;
    };

    // Helpers

    // Mint and approve will mint the balance on the asset contract and approve for the balance the contract address.
    const mintAndApprove = async (
        accountAddress,
        contractAddress,
        asset,
        balanceBN
    ) => {
        await asset.mint(accountAddress, balanceBN);
        await asset.approve(contractAddress, balanceBN, {
            from: accountAddress,
        });
    };

    return {
        // Deployment Function
        deployMock,

        // Testing Utilities
        log,
        assertBn,
        assertEvents,
        assertErrors,
        UNSET_ADDRESS,
        TEN_UNITS,

        // Library Functions
        parseUnits,
        getNativeBalance,
        verboseAccounts,
        big,
        time,
        rpc,

        // Project Specific Constants
        PROJECT_CONSTANTS,
        DEFAULT_CONFIGS,
        VaderPool,
        BasePool,
        BasePoolV2,
        Synth,
        LPToken,
        MockAggregatorV3,

        // Project Specific Utilities
        advanceEpochs,

        // Helpers
        mintAndApprove,
    };
};
