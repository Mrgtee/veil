// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {VeilShield} from "../src/VeilShield.sol";
import {IVeilShieldVerifier} from "../src/interfaces/IVeilShieldVerifier.sol";
import {Pausable} from "../src/security/Pausable.sol";
import {MockUSDC} from "./VeilHub.t.sol";

contract MockVerifier is IVeilShieldVerifier {
    bool public valid = true;

    function setValid(bool nextValid) external {
        valid = nextValid;
    }

    function verifyTransferProof(
        bytes calldata,
        bytes32,
        bytes32,
        bytes32,
        bytes32,
        address,
        address,
        address
    ) external view override returns (bool) {
        return valid;
    }

    function verifyWithdrawProof(
        bytes calldata,
        bytes32,
        bytes32,
        address,
        address,
        uint256
    ) external view override returns (bool) {
        return valid;
    }
}

contract VeilShieldTest is Test {
    MockUSDC internal usdc;
    MockVerifier internal verifier;
    VeilShield internal shield;

    address internal owner = address(0xA11CE);
    address internal sender = address(0xB0B);
    address internal recipient = address(0xCAFE);

    function setUp() public {
        usdc = new MockUSDC();
        verifier = new MockVerifier();
        shield = new VeilShield(usdc, verifier, owner);

        usdc.mint(sender, 100e18);
        vm.prank(sender);
        usdc.approve(address(shield), type(uint256).max);
    }

    function testDepositTransfersIntoShieldAndRegistersCommitment() public {
        bytes32 noteCommitment = keccak256("note-1");

        vm.prank(sender);
        shield.deposit(10e18, noteCommitment, keccak256("encrypted-note"));

        assertTrue(shield.noteCommitments(noteCommitment));
        assertEq(usdc.balanceOf(address(shield)), 10e18);
        assertEq(shield.totalShieldedPool(), 10e18);
    }

    function testDepositRejectsZeroAmount() public {
        vm.prank(sender);
        vm.expectRevert(VeilShield.ZeroAmount.selector);
        shield.deposit(0, keccak256("note-2"), bytes32(0));
    }

    function testDepositRejectsDuplicateCommitment() public {
        bytes32 noteCommitment = keccak256("note-3");

        vm.startPrank(sender);
        shield.deposit(1e18, noteCommitment, bytes32(0));
        vm.expectRevert(abi.encodeWithSelector(VeilShield.CommitmentAlreadyExists.selector, noteCommitment));
        shield.deposit(1e18, noteCommitment, bytes32(0));
        vm.stopPrank();
    }

    function testTransferNoteSpendsNullifierOnceAndRegistersOutputAndChange() public {
        bytes32 inputCommitment = keccak256("input-note-1");
        bytes32 nullifierHash = keccak256("nullifier-1");
        bytes32 outputCommitment = keccak256("new-note-1");
        bytes32 changeCommitment = keccak256("change-note-1");

        vm.prank(sender);
        shield.deposit(10e18, inputCommitment, keccak256("encrypted-input-note"));

        vm.startPrank(sender);
        shield.transferNote(
            hex"01",
            nullifierHash,
            inputCommitment,
            outputCommitment,
            changeCommitment,
            keccak256("encrypted-new-note"),
            recipient
        );
        vm.expectRevert(abi.encodeWithSelector(VeilShield.NullifierAlreadySpent.selector, nullifierHash));
        shield.transferNote(
            hex"01",
            nullifierHash,
            inputCommitment,
            keccak256("new-note-2"),
            keccak256("change-note-2"),
            keccak256("encrypted-new-note-2"),
            recipient
        );
        vm.stopPrank();

        assertTrue(shield.noteCommitments(outputCommitment));
        assertTrue(shield.noteCommitments(changeCommitment));
    }

    function testTransferNoteRejectsInvalidProof() public {
        bytes32 inputCommitment = keccak256("input-note-2");
        verifier.setValid(false);

        vm.prank(sender);
        shield.deposit(10e18, inputCommitment, bytes32(0));

        vm.prank(sender);
        vm.expectRevert(VeilShield.InvalidProof.selector);
        shield.transferNote(
            hex"01",
            keccak256("nullifier-2"),
            inputCommitment,
            keccak256("new-note-3"),
            keccak256("change-note-3"),
            bytes32(0),
            recipient
        );
    }

    function testTransferNoteRejectsUnknownInputCommitment() public {
        bytes32 inputCommitment = keccak256("missing-input-note");

        vm.prank(sender);
        vm.expectRevert(abi.encodeWithSelector(VeilShield.CommitmentNotFound.selector, inputCommitment));
        shield.transferNote(
            hex"01",
            keccak256("nullifier-missing"),
            inputCommitment,
            keccak256("new-note-missing"),
            keccak256("change-note-missing"),
            bytes32(0),
            recipient
        );
    }

    function testWithdrawSpendsNullifierAndTransfersUsdc() public {
        bytes32 noteCommitment = keccak256("note-4");
        bytes32 nullifierHash = keccak256("nullifier-3");

        vm.prank(sender);
        shield.deposit(10e18, noteCommitment, bytes32(0));

        vm.prank(sender);
        shield.withdraw(hex"01", nullifierHash, noteCommitment, recipient, 4e18);

        assertTrue(shield.nullifiers(nullifierHash));
        assertEq(usdc.balanceOf(recipient), 4e18);
        assertEq(usdc.balanceOf(address(shield)), 6e18);
        assertEq(shield.totalShieldedPool(), 6e18);
    }

    function testWithdrawCannotExceedPoolAccounting() public {
        bytes32 noteCommitment = keccak256("note-5");
        bytes32 nullifierHash = keccak256("nullifier-4");

        vm.prank(sender);
        shield.deposit(1e18, noteCommitment, bytes32(0));

        vm.prank(sender);
        vm.expectRevert(abi.encodeWithSelector(VeilShield.InsufficientPoolBalance.selector, 2e18, 1e18));
        shield.withdraw(hex"01", nullifierHash, noteCommitment, recipient, 2e18);
    }

    function testPauseBlocksActions() public {
        vm.prank(owner);
        shield.pause();

        vm.prank(sender);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        shield.deposit(1e18, keccak256("paused-note"), bytes32(0));
    }
}
