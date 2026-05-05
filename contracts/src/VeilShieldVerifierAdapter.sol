// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IVeilShieldVerifier} from "./interfaces/IVeilShieldVerifier.sol";
import {IVerifier} from "./verifiers/BaseZKHonkVerifier.sol";

/// @title VeilShieldVerifierAdapter
/// @notice Maps VeilShield public inputs into generated Barretenberg verifier contracts.
/// @dev Experimental/testnet-only until the full prover, verifier, and note-discovery flow is audited.
contract VeilShieldVerifierAdapter is IVeilShieldVerifier {
    IVerifier public immutable transferVerifier;
    IVerifier public immutable withdrawVerifier;

    error ZeroAddress();
    error AmountTooLarge(uint256 amount);

    constructor(IVerifier transferVerifier_, IVerifier withdrawVerifier_) {
        if (address(transferVerifier_) == address(0) || address(withdrawVerifier_) == address(0)) {
            revert ZeroAddress();
        }

        transferVerifier = transferVerifier_;
        withdrawVerifier = withdrawVerifier_;
    }

    function verifyTransferProof(
        bytes calldata proof,
        bytes32 nullifierHash,
        bytes32 inputNoteCommitment,
        bytes32 outputNoteCommitment,
        bytes32 changeNoteCommitment,
        address sender,
        address recipient,
        address token
    ) external view returns (bool) {
        return _safeVerify(
            transferVerifier,
            proof,
            transferPublicInputs(
                nullifierHash,
                inputNoteCommitment,
                outputNoteCommitment,
                changeNoteCommitment,
                sender,
                recipient,
                token
            )
        );
    }

    function verifyWithdrawProof(
        bytes calldata proof,
        bytes32 nullifierHash,
        bytes32 noteCommitment,
        address owner,
        address token,
        uint256 amount
    ) external view returns (bool) {
        return _safeVerify(withdrawVerifier, proof, withdrawPublicInputs(nullifierHash, noteCommitment, owner, token, amount));
    }

    function transferPublicInputs(
        bytes32 nullifierHash,
        bytes32 inputNoteCommitment,
        bytes32 outputNoteCommitment,
        bytes32 changeNoteCommitment,
        address sender,
        address recipient,
        address token
    ) public pure returns (bytes32[] memory publicInputs) {
        publicInputs = new bytes32[](7);
        publicInputs[0] = _addressToField(sender);
        publicInputs[1] = _addressToField(recipient);
        publicInputs[2] = _addressToField(token);
        publicInputs[3] = inputNoteCommitment;
        publicInputs[4] = outputNoteCommitment;
        publicInputs[5] = changeNoteCommitment;
        publicInputs[6] = nullifierHash;
    }

    function withdrawPublicInputs(
        bytes32 nullifierHash,
        bytes32 noteCommitment,
        address owner,
        address token,
        uint256 amount
    ) public pure returns (bytes32[] memory publicInputs) {
        if (amount > type(uint128).max) revert AmountTooLarge(amount);
        publicInputs = new bytes32[](5);
        publicInputs[0] = _addressToField(owner);
        publicInputs[1] = _addressToField(token);
        publicInputs[2] = noteCommitment;
        publicInputs[3] = nullifierHash;
        publicInputs[4] = bytes32(amount);
    }

    function _safeVerify(
        IVerifier verifier,
        bytes calldata proof,
        bytes32[] memory publicInputs
    ) internal view returns (bool) {
        try verifier.verify(proof, publicInputs) returns (bool ok) {
            return ok;
        } catch {
            return false;
        }
    }

    function _addressToField(address value) internal pure returns (bytes32) {
        return bytes32(uint256(uint160(value)));
    }
}
