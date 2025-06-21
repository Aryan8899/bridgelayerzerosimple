// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

interface IUltraLightNode {
    function setConfig(uint16 srcChainId, address dstAddress, uint configType, bytes calldata config) external;
}
