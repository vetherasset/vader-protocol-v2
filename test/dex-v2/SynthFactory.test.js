const {
    // Deployment Function
    deployMock,

    // Testing Utilities
    assertBn,
    assertErrors,
    assertEvents,
    UNSET_ADDRESS,
    DEFAULT_CONFIGS,
    TEN_UNITS,

    // Library Functions
    verboseAccounts,
    time,
    big,
    parseUnits,

    // Project Specific Constants
    PROJECT_CONSTANTS,
} = require("../utils")(artifacts);

contract("SynthFactory", (accounts) => {
    describe("construction", () => {
        it("should now allow construction with bad arguments", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);

            await assertErrors(
                deployMock(accounts, {
                    SynthFactory: () => [UNSET_ADDRESS],
                }),
                "SynthFactory::constructor: Misconfiguration"
            );
        });
    });

    describe("create synth", () => {
        it("should now allow to create synths from a non owner account", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);

            const { synthFactory, dai, poolV2, lpWrapper } = await deployMock(
                accounts
            );

            await poolV2.initialize(lpWrapper.address, synthFactory.address);

            await assertErrors(
                synthFactory.createSynth(await dai.address),
                "Ownable: caller is not the owner"
            );
        });
    });
});
