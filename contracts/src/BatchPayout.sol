// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract BatchPayout {
    event BatchSettled(
        address indexed payer,
        bytes32 indexed batchId,
        bytes32 indexed batchCommitment,
        uint256 count,
        uint256 totalAmount,
        bool confidential
    );

    error LengthMismatch();
    error ZeroRecipients();
    error AmountMismatch();

    function payBatchOpen(
        address[] calldata recipients,
        uint256[] calldata amounts,
        bytes32 batchId
    ) external payable {
        _pay(recipients, amounts, batchId, bytes32(0), false);
    }

    function payBatchConfidential(
        address[] calldata recipients,
        uint256[] calldata amounts,
        bytes32 batchCommitment,
        bytes32 batchId
    ) external payable {
        _pay(recipients, amounts, batchId, batchCommitment, true);
    }

    function _pay(
        address[] calldata recipients,
        uint256[] calldata amounts,
        bytes32 batchId,
        bytes32 batchCommitment,
        bool confidential
    ) internal {
        if (recipients.length == 0) revert ZeroRecipients();
        if (recipients.length != amounts.length) revert LengthMismatch();

        uint256 total;
        for (uint256 i = 0; i < recipients.length; i++) {
            total += amounts[i];
        }
        if (msg.value != total) revert AmountMismatch();

        for (uint256 i = 0; i < recipients.length; i++) {
            (bool sent, ) = payable(recipients[i]).call{value: amounts[i]}("");
            require(sent, "TRANSFER_FAILED");
        }

        emit BatchSettled(msg.sender, batchId, batchCommitment, recipients.length, total, confidential);
    }
}
