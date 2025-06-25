// SPDX-License-Identifier: BUSL-1.1
pragma solidity >=0.7.0;

interface ILayerZeroUltraLightNodeV1 {
    function validateTransactionProof(
        uint16 _srcChainId,
        address _dstAddress,
        uint _gasLimit,
        bytes32 _lookupHash,
        bytes calldata _transactionProof
    ) external;

    function updateHash(
        uint16 _remoteChainId,
        bytes32 _lookupHash,
        uint _confirmations,
        bytes32 _data
    ) external;

    function withdrawNative(
        uint8 _type,
        address _owner,
        address payable _to,
        uint _amount
    ) external;

    function withdrawZRO(address _to, uint _amount) external;

    function oracleQuotedAmount(address _oracle) external view returns (uint);

    function relayerQuotedAmount(address _relayer) external view returns (uint);

function setAppConfig(
    uint16 _srcChainId,
    address _dstAddress,
    address _relayer,
    address _oracle,
    uint16 _inboundProofLibraryVersion,
    uint16 _inboundBlockConfirmations
) external;



    function getAppConfig(
        uint16 _srcChainId,
        address _dstAddress
    ) external view returns (
        address relayer,
        address oracle,
        uint16 inboundProofLibraryVersion,
        uint16 inboundBlockConfirmations
    );
}
