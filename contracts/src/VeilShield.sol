// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "./access/Ownable.sol";
import {Pausable} from "./security/Pausable.sol";
import {IERC20} from "./token/IERC20.sol";
import {SafeERC20} from "./utils/SafeERC20.sol";
import {ReentrancyGuard} from "./utils/ReentrancyGuard.sol";
import {IVeilShieldVerifier} from "./interfaces/IVeilShieldVerifier.sol";

/// @title VeilShield
/// @notice Experimental testnet-only architecture for sender-visible, recipient-visible, amount-hidden transfers.
/// @dev This is not production-ready cryptography. Full Noir/ZK circuits and an audit are required before mainnet use.
contract VeilShield is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bool public constant EXPERIMENTAL_TESTNET_ONLY = true;

    IERC20 public immutable usdc;
    IVeilShieldVerifier public verifier;
    uint256 public totalShieldedPool;

    mapping(bytes32 noteCommitment => bool exists) public noteCommitments;
    mapping(bytes32 nullifierHash => bool spent) public nullifiers;

    event VerifierUpdated(address indexed verifier);
    event ShieldDeposit(address indexed sender, bytes32 indexed noteCommitment, bytes32 encryptedNoteRef);
    event ShieldTransfer(
        address indexed sender,
        address indexed recipient,
        bytes32 indexed nullifierHash,
        bytes32 inputNoteCommitment,
        bytes32 outputNoteCommitment,
        bytes32 changeNoteCommitment,
        bytes32 encryptedNoteRef
    );
    event ShieldWithdraw(address indexed recipient, bytes32 indexed nullifierHash);

    error ZeroAddress();
    error ZeroAmount();
    error ZeroCommitment();
    error CommitmentAlreadyExists(bytes32 commitment);
    error CommitmentNotFound(bytes32 commitment);
    error NullifierAlreadySpent(bytes32 nullifierHash);
    error InsufficientPoolBalance(uint256 requested, uint256 available);
    error InvalidProof();

    constructor(IERC20 usdc_, IVeilShieldVerifier verifier_, address initialOwner) Ownable(initialOwner) {
        if (address(usdc_) == address(0) || address(verifier_) == address(0)) revert ZeroAddress();
        usdc = usdc_;
        verifier = verifier_;
        emit VerifierUpdated(address(verifier_));
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function setVerifier(IVeilShieldVerifier nextVerifier) external onlyOwner {
        if (address(nextVerifier) == address(0)) revert ZeroAddress();
        verifier = nextVerifier;
        emit VerifierUpdated(address(nextVerifier));
    }

    function deposit(
        uint256 amount,
        bytes32 noteCommitment,
        bytes32 encryptedNoteRef
    ) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        _registerCommitment(noteCommitment);

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        totalShieldedPool += amount;
        emit ShieldDeposit(msg.sender, noteCommitment, encryptedNoteRef);
    }

    function transferNote(
        bytes calldata proof,
        bytes32 nullifierHash,
        bytes32 inputNoteCommitment,
        bytes32 outputNoteCommitment,
        bytes32 changeNoteCommitment,
        bytes32 encryptedNoteRef,
        address recipient
    ) external nonReentrant whenNotPaused {
        if (recipient == address(0)) revert ZeroAddress();
        _requireCommitment(inputNoteCommitment);
        _spendNullifier(nullifierHash);
        _registerCommitment(outputNoteCommitment);
        _registerCommitment(changeNoteCommitment);

        bool ok = verifier.verifyTransferProof(
            proof,
            nullifierHash,
            inputNoteCommitment,
            outputNoteCommitment,
            changeNoteCommitment,
            msg.sender,
            recipient,
            address(usdc)
        );
        if (!ok) revert InvalidProof();

        emit ShieldTransfer(
            msg.sender,
            recipient,
            nullifierHash,
            inputNoteCommitment,
            outputNoteCommitment,
            changeNoteCommitment,
            encryptedNoteRef
        );
    }

    function withdraw(
        bytes calldata proof,
        bytes32 nullifierHash,
        bytes32 noteCommitment,
        address recipient,
        uint256 amount
    ) external nonReentrant whenNotPaused {
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        _requireCommitment(noteCommitment);
        _spendNullifier(nullifierHash);

        bool ok = verifier.verifyWithdrawProof(proof, nullifierHash, noteCommitment, msg.sender, address(usdc), amount);
        if (!ok) revert InvalidProof();

        if (amount > totalShieldedPool) revert InsufficientPoolBalance(amount, totalShieldedPool);
        totalShieldedPool -= amount;
        usdc.safeTransfer(recipient, amount);
        emit ShieldWithdraw(recipient, nullifierHash);
    }

    function _registerCommitment(bytes32 noteCommitment) internal {
        if (noteCommitment == bytes32(0)) revert ZeroCommitment();
        if (noteCommitments[noteCommitment]) revert CommitmentAlreadyExists(noteCommitment);
        noteCommitments[noteCommitment] = true;
    }

    function _requireCommitment(bytes32 noteCommitment) internal view {
        if (noteCommitment == bytes32(0)) revert ZeroCommitment();
        if (!noteCommitments[noteCommitment]) revert CommitmentNotFound(noteCommitment);
    }

    function _spendNullifier(bytes32 nullifierHash) internal {
        if (nullifierHash == bytes32(0)) revert ZeroCommitment();
        if (nullifiers[nullifierHash]) revert NullifierAlreadySpent(nullifierHash);
        nullifiers[nullifierHash] = true;
    }
}
