// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Verifier interface for future Noir/ZK VeilShield circuits.
interface IVeilShieldVerifier {
    function verifyTransferProof(
        bytes calldata proof,
        bytes32 nullifierHash,
        bytes32 inputNoteCommitment,
        bytes32 outputNoteCommitment,
        bytes32 changeNoteCommitment,
        address sender,
        address recipient,
        address token
    ) external view returns (bool);

    function verifyWithdrawProof(
        bytes calldata proof,
        bytes32 nullifierHash,
        bytes32 noteCommitment,
        address owner,
        address token,
        uint256 amount
    ) external view returns (bool);
}
