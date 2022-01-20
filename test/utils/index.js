const {
    time, // Time support with custom block timeouts
} = require("@openzeppelin/test-helpers");

module.exports = (artifacts) => {
    // Mocks
    const Mock = artifacts.require("Mock");
    const MockToken = artifacts.require("MockToken");
    const MockConstants = artifacts.require("MockConstants");
    const GovernorAlpha = artifacts.require("MockGovernorAlpha");
    const MockUSDV = artifacts.require("MockUSDV");
    const MockVader = artifacts.require("MockVader");
    const MockXVader = artifacts.require("MockXVader");
    const Timelock = artifacts.require("MockTimelock");
    const MockAggregatorV3 = artifacts.require("MockAggregatorV3");
    const MockLBT = artifacts.require("MockLBT");
    const MockUniswapV2Factory = artifacts.require("MockUniswapV2Factory");
    const MockUniswapV2Router = artifacts.require("MockUniswapV2Router");
    const MockMTree = artifacts.require("MockMTree");

    // Project Contracts
    const Vader = artifacts.require("Vader");
    const VaderReserve = artifacts.require("VaderReserve");
    const USDV = artifacts.require("USDV");
    const Converter = artifacts.require("Converter");
    const LinearVesting = artifacts.require("LinearVesting");
    const VaderMinter = artifacts.require("VaderMinterUpgradeable");
    const UnlockValidator = artifacts.require("UnlockValidator");

    // V2
    const VaderRouterV2 = artifacts.require("VaderRouterV2");
    const VaderPoolV2 = artifacts.require("VaderPoolV2");
    const BasePoolV2 = artifacts.require("BasePoolV2");
    const Synth = artifacts.require("Synth");
    const SynthFactory = artifacts.require("SynthFactory");
    const LPToken = artifacts.require("LPToken");
    const LPWrapper = artifacts.require("LPWrapper");
    // const TWAP = artifacts.require("TwapOracle");
    const XVader = artifacts.require("XVader");
    const UniswapV2Pair = artifacts.require("UniswapV2Pair");
    const LBTwap = artifacts.require("LiquidityBasedTWAP.sol");

    // Libraries
    const VaderMath = artifacts.require("VaderMath");
    // const UniswapV2Library = artifacts.require("UniswapV2Library");

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
            "account6",
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
        VaderReserve: (_, { vader }) => [vader.address],
        USDV: (_, { vader, ADMINISTRATOR }) => [vader.address, ADMINISTRATOR],
        UnlockValidator: (_, { ADMINISTRATOR }) => [ADMINISTRATOR],
        VaderMinter: (_, { usdv, ADMINISTRATOR }) => [
            usdv.address,
            ADMINISTRATOR,
        ],
        Converter: (_, { vader, vether, ADMINISTRATOR }) => [
            vether.address,
            vader.address,
            "0xa940602589189f10b3011b6a878649093c3d87a8a26751a52f10e44ca75e7ba1",
            123, // salt
            ADMINISTRATOR,
        ],
        LinearVesting: (_, { vader, converter, ADMINISTRATOR }) => [
            vader.address,
            converter.address,
            ADMINISTRATOR,
        ],
        GovernorAlpha: ({ account0, account1 }, { mockXVader }) => [
            account0,
            mockXVader.address,
            account1,
            parseUnits(1000, 18),
            account0,
            50, // voting period of 50 blocks for testing
        ],
        MockXVader: (_, { vader }) => [vader.address],
        Timelock: (_, { governorAlpha }) => [
            governorAlpha.address,
            big(10 * 60), // default delay of 10 minutes
        ],
        VaderPoolV2: (_, { usdv }) => [true, usdv.address],
        VaderRouterV2: (_, { poolV2 }) => [poolV2.address],
        LPWrapper: (_, { poolV2 }) => [poolV2.address],
        SynthFactory: (_, { poolV2 }) => [poolV2.address],
        LBTwap: (_, { vader, poolV2 }) => [vader.address, poolV2.address],
        XVader: (_, { vader }) => [vader.address],
        MockUniswapV2Factory: ({ account0 }, _) => [account0],
        MockUniswapV2Router: (_, { mockUniswapV2Factory, weth }) => [
            mockUniswapV2Factory.address,
            weth.address,
        ],
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
        cached.mock = await Mock.new();
        cached.vether = await MockToken.new("Vether", "VETH", 18);
        cached.mockUsdv = await MockUSDV.new();
        cached.mockVader = await MockVader.new();
        cached.mockLbt = await MockLBT.new();
        cached.dai = await MockToken.new("DAI", "DAI", 18);
        cached.token = await MockToken.new("TKN", "TKN", 18);
        cached.erc20Dec8 = await MockToken.new("DEC8", "DEC8", 8);
        cached.erc20Dec12 = await MockToken.new("DEC12", "DEC12", 12);
        cached.maliciousToken = await MockToken.new("MALC", "MALC", 18);
        cached.weth = await MockToken.new("WETH", "WETH", 18);

        // Project Deployments
        cached.vader = await Vader.new(...configs.Vader(accounts, cached));

        cached.reserve = await VaderReserve.new(
            ...configs.VaderReserve(accounts, cached)
        );

        cached.usdv = await USDV.new(...configs.USDV(accounts, cached));

        cached.validator = await UnlockValidator.new(
            ...configs.UnlockValidator(accounts, cached)
        );

        cached.vaderMinter = await VaderMinter.new(
            ...configs.VaderMinter(accounts, cached)
        );

        cached.converter = await Converter.new(
            ...configs.Converter(accounts, cached)
        );

        cached.vesting = await LinearVesting.new(
            ...configs.LinearVesting(accounts, cached)
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

        cached.lbtwap = await LBTwap.new(...configs.LBTwap(accounts, cached));

        cached.xVader = await XVader.new(...configs.XVader(accounts, cached));

        cached.mockUniswapV2Factory = await MockUniswapV2Factory.new(
            ...configs.MockUniswapV2Factory(accounts, cached)
        );

        cached.mockUniswapV2Router = await MockUniswapV2Router.new(
            ...configs.MockUniswapV2Router(accounts, cached)
        );

        cached.mockMTree = await MockMTree.new();

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
        BasePoolV2,
        Synth,
        LPToken,
        MockAggregatorV3,

        // Project Specific Utilities
        advanceEpochs,

        // Helpers
        mintAndApprove,

        UniswapV2Pair,
    };
};
