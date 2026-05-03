// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Verifier interface for future Noir/ZK VeilShield circuits.
interface IVeilShieldVerifier {
    function verifyTransferProof(
        bytes calldata proof,
        bytes32 nullifierHash,
        bytes32 newNoteCommitment,
        address sender,
        address recipient
    ) external view returns (bool);

    function verifyWithdrawProof(
        bytes calldata proof,
        bytes32 nullifierHash,
        address recipient,
        uint256 amount
    ) external view returns (bool);
}

