// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "forge-std/Test.sol";
import {VeilShieldVerifierAdapter} from "../src/VeilShieldVerifierAdapter.sol";
import {TransferVerifier} from "../src/verifiers/TransferVerifier.sol";
import {WithdrawVerifier} from "../src/verifiers/WithdrawVerifier.sol";

contract VeilShieldGeneratedVerifierTest is Test {
    TransferVerifier internal transferVerifier;
    WithdrawVerifier internal withdrawVerifier;
    VeilShieldVerifierAdapter internal adapter;

    address internal sender = address(0xB0B);
    address internal recipient = address(0xCAFE);
    address internal token = address(0x3600000000000000000000000000000000000000);

    function setUp() public {
        transferVerifier = new TransferVerifier();
        withdrawVerifier = new WithdrawVerifier();
        adapter = new VeilShieldVerifierAdapter(transferVerifier, withdrawVerifier);
    }

    function testGeneratedTransferVerifierRejectsInvalidProof() public view {
        bool ok = adapter.verifyTransferProof(
            hex"01",
            keccak256("nullifier"),
            keccak256("input"),
            keccak256("output"),
            keccak256("change"),
            sender,
            recipient,
            token
        );

        assertFalse(ok);
    }

    function testGeneratedWithdrawVerifierRejectsInvalidProof() public view {
        bool ok = adapter.verifyWithdrawProof(
            hex"01",
            keccak256("nullifier"),
            keccak256("note"),
            sender,
            token,
            25e6
        );

        assertFalse(ok);
    }
}
