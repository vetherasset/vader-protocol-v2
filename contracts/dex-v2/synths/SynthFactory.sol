// SPDX-License-Identifier: MIT AND AGPL-3.0-or-later
pragma solidity =0.8.9;

import "./Synth.sol";

import "../../interfaces/dex-v2/synth/ISynthFactory.sol";

contract SynthFactory is ISynthFactory, ProtocolConstants, Ownable {
    mapping(IERC20 => ISynth) public override synths;

    constructor(address _pool) {
        transferOwnership(_pool);
    }

    function createSynth(IERC20Extended token)
        external
        override
        onlyOwner
        returns (ISynth)
    {
        require(
            synths[IERC20(token)] == ISynth(_ZERO_ADDRESS),
            "SynthFactory::createSynth: Already Created"
        );

        Synth synth = new Synth(token);

        synth.transferOwnership(owner());

        synths[IERC20(token)] = synth;

        return synth;
    }
}
