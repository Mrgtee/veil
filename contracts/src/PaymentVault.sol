// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract PaymentVault {
    event PaymentSettled(
        address indexed payer,
        address indexed recipient,
        uint256 amount,
        bool confidential,
        bytes32 indexed commitmentId,
        bytes32 externalId
    );

    error ZeroValue();
    error ZeroAddress();

    function payOpen(address recipient, bytes32 externalId) external payable {
        if (msg.value == 0) revert ZeroValue();
        if (recipient == address(0)) revert ZeroAddress();

        (bool sent, ) = payable(recipient).call{value: msg.value}("");
        require(sent, "TRANSFER_FAILED");

        emit PaymentSettled(msg.sender, recipient, msg.value, false, bytes32(0), externalId);
    }

    function payConfidential(
        address recipient,
        bytes32 commitmentId,
        bytes32 externalId
    ) external payable {
        if (msg.value == 0) revert ZeroValue();
        if (recipient == address(0)) revert ZeroAddress();

        (bool sent, ) = payable(recipient).call{value: msg.value}("");
        require(sent, "TRANSFER_FAILED");

        emit PaymentSettled(msg.sender, recipient, msg.value, true, commitmentId, externalId);
    }
}
