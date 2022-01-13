// SPDX-License-Identifier: MIT AND AGPL-3.0-or-later

pragma solidity =0.8.9;

contract MockMTree {
    function getRoot(
        address member,
        uint256 amount,
        uint256 salt,
        uint256 chainId
    ) external pure returns (bytes memory) {
        return abi.encodePacked(member, amount, salt, chainId);
    }
}
