const { time } = require('@openzeppelin/test-helpers');

module.exports = ({
    artifacts,
    parseUnits,
    big,
}) => {
    // Mocks
    const MockTarget = artifacts.require('MockTarget');

    // governance specific constants
    const proposalFee = parseUnits(1000, 18);
    const defaultSignature = 'setStateToTrue()';
    const description = 'A proposal';

    const cached = {};

    const prepareTargetsAndData = async ({
        timelock,
        numberOfMocks = 3,
        signature = defaultSignature,
        value = 0,
        deploy = false,
        arg,
    }) => {
        if (!deploy) {
            if (cached) return cached;

            log('prepareTargetsAndData: Incorrect Deployment Invocation');
            process.exit(1);
        }

        const basicArray = new Array(numberOfMocks).fill(0);

        cached.targets = await basicArray
            .reduce(
                async (acc) => [
                    ...(await acc),
                    (await MockTarget.new(timelock.address)),
                ],
                [],
            );

        const targetAddresses = basicArray.map((_, idx) => cached.targets[idx].address);

        const values = basicArray.map(() => big(value));

        const signatures = basicArray.map(() => signature);

        const calldata = arg
            ? cached.targets[0].contract.methods[signature](arg).encodeABI()
            : cached.targets[0].contract.methods[signature]().encodeABI();

        const calldatas = basicArray.map(() => calldata);

        cached.targetsData = {
            signatures,
            targetAddresses,
            values,
            calldatas,
        };

        return cached;
    };

    const decodeSignature = (sig) => {
        const signature = sig.substring(2);
        const r = `0x${signature.substring(0, 64)}`;
        const s = `0x${signature.substring(64, 128)}`;
        const v = parseInt(signature.substring(128, 130), 16);

        return {
            v,
            r,
            s,
        };
    };

    const getTypedDataForVoteBySignature = ({
        verifyingContract,
        chainId,
        proposalId = 1,
        support = true,
        name = 'Vader Governor Alpha',
    }) => ({
        types: {
            EIP712Domain: [
                { name: 'name', type: 'string' },
                { name: 'chainId', type: 'uint256' },
                { name: 'verifyingContract', type: 'address' },
            ],
            Ballot: [
                { name: 'proposalId', type: 'uint256' },
                { name: 'support', type: 'bool' },
            ],
        },
        primaryType: 'Ballot',
        domain: {
            // eslint-disable-next-line no-restricted-globals
            name,
            chainId,
            verifyingContract,
        },
        message: {
            proposalId,
            support,
        },
    });

    const advanceBlockToVotingPeriodEnd = async ({
        governorAlpha,
    }) => {
        const votingPeriod = await governorAlpha.VOTING_PERIOD();
        await time.advanceBlockTo(
            (await web3.eth.getBlock('latest'))
                .number + votingPeriod.toNumber(),
        );
    };

    const getTxHash = (args) => web3.utils.keccak256(
        web3.eth.abi.encodeParameters(
            [
                'address',
                'uint256',
                'string',
                'bytes',
                'uint256',
            ],
            [
                ...args,
            ],
        ),
    );

    return {
        prepareTargetsAndData,
        decodeSignature,
        getTypedDataForVoteBySignature,
        advanceBlockToVotingPeriodEnd,
        proposalFee,
        description,
        getTxHash,
    };
};
