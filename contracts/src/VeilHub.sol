// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "./access/Ownable.sol";
import {Pausable} from "./security/Pausable.sol";
import {IERC20} from "./token/IERC20.sol";
import {SafeERC20} from "./utils/SafeERC20.sol";
import {ReentrancyGuard} from "./utils/ReentrancyGuard.sol";

/// @title VeilHub
/// @notice Main on-chain identity for open Veil payments on Arc.
/// @dev Closed hidden-amount settlement belongs in VeilShield, not in this visible ERC20 router.
contract VeilHub is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;

    mapping(bytes32 paymentId => bool recorded) public paymentRecorded;
    mapping(bytes32 batchId => bool recorded) public batchRecorded;

    event OpenPaymentRouted(
        bytes32 indexed paymentId,
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        address token,
        bytes32 appReference
    );

    event OpenBatchRouted(
        bytes32 indexed batchId,
        address indexed sender,
        uint256 recipientCount,
        uint256 totalAmount,
        address token,
        bytes32 appReference
    );

    event UnifiedBalanceReferenceRecorded(
        bytes32 indexed paymentId,
        address indexed payer,
        address indexed recipient,
        uint256 amount,
        bytes32 settlementReference
    );

    error ZeroAddress();
    error ZeroAmount();
    error ZeroId();
    error AlreadyRecorded(bytes32 id);
    error EmptyBatch();
    error LengthMismatch();

    constructor(IERC20 usdc_, address initialOwner) Ownable(initialOwner) {
        if (address(usdc_) == address(0)) revert ZeroAddress();
        usdc = usdc_;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function payOpen(
        bytes32 paymentId,
        address recipient,
        uint256 amount,
        bytes32 appReference
    ) external nonReentrant whenNotPaused {
        _validatePayment(paymentId, recipient, amount);
        paymentRecorded[paymentId] = true;

        usdc.safeTransferFrom(msg.sender, recipient, amount);

        emit OpenPaymentRouted(paymentId, msg.sender, recipient, amount, address(usdc), appReference);
    }

    function payOpenBatch(
        bytes32 batchId,
        address[] calldata recipients,
        uint256[] calldata amounts,
        bytes32[] calldata paymentIds,
        bytes32 appReference
    ) external nonReentrant whenNotPaused {
        if (batchId == bytes32(0)) revert ZeroId();
        if (batchRecorded[batchId]) revert AlreadyRecorded(batchId);
        if (recipients.length == 0) revert EmptyBatch();
        if (recipients.length != amounts.length || recipients.length != paymentIds.length) {
            revert LengthMismatch();
        }

        batchRecorded[batchId] = true;

        uint256 totalAmount;
        for (uint256 i = 0; i < recipients.length; i++) {
            _validatePayment(paymentIds[i], recipients[i], amounts[i]);
            paymentRecorded[paymentIds[i]] = true;
            totalAmount += amounts[i];

            usdc.safeTransferFrom(msg.sender, recipients[i], amounts[i]);
            emit OpenPaymentRouted(paymentIds[i], msg.sender, recipients[i], amounts[i], address(usdc), appReference);
        }

        emit OpenBatchRouted(batchId, msg.sender, recipients.length, totalAmount, address(usdc), appReference);
    }

    function recordUnifiedBalanceOpenPayment(
        bytes32 paymentId,
        address recipient,
        uint256 amount,
        bytes32 settlementReference
    ) external whenNotPaused {
        _validatePayment(paymentId, recipient, amount);
        paymentRecorded[paymentId] = true;

        emit UnifiedBalanceReferenceRecorded(paymentId, msg.sender, recipient, amount, settlementReference);
    }

    function _validatePayment(bytes32 paymentId, address recipient, uint256 amount) internal view {
        if (paymentId == bytes32(0)) revert ZeroId();
        if (paymentRecorded[paymentId]) revert AlreadyRecorded(paymentId);
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
    }
}
