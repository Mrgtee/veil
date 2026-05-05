// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "forge-std/Test.sol";
import {VeilShieldVerifierAdapter} from "../src/VeilShieldVerifierAdapter.sol";
import {IVerifier} from "../src/verifiers/BaseZKHonkVerifier.sol";

contract MockHonkVerifier is IVerifier {
    bool public valid = true;
    bool public shouldRevert;

    function setValid(bool nextValid) external {
        valid = nextValid;
    }

    function setShouldRevert(bool nextShouldRevert) external {
        shouldRevert = nextShouldRevert;
    }

    function verify(bytes calldata, bytes32[] calldata publicInputs) external view override returns (bool) {
        if (shouldRevert) revert("INVALID_PROOF");

        for (uint256 i = 0; i < publicInputs.length; i++) {
            if (publicInputs[i] == bytes32(0)) return false;
        }

        return valid;
    }
}

contract VeilShieldVerifierAdapterTest is Test {
    MockHonkVerifier internal transferVerifier;
    MockHonkVerifier internal withdrawVerifier;
    VeilShieldVerifierAdapter internal adapter;

    address internal sender = address(0xB0B);
    address internal recipient = address(0xCAFE);
    address internal token = address(0x3600000000000000000000000000000000000000);

    function setUp() public {
        transferVerifier = new MockHonkVerifier();
        withdrawVerifier = new MockHonkVerifier();
        adapter = new VeilShieldVerifierAdapter(transferVerifier, withdrawVerifier);
    }

    function testConstructorRejectsZeroTransferVerifier() public {
        vm.expectRevert(VeilShieldVerifierAdapter.ZeroAddress.selector);
        new VeilShieldVerifierAdapter(IVerifier(address(0)), withdrawVerifier);
    }

    function testConstructorRejectsZeroWithdrawVerifier() public {
        vm.expectRevert(VeilShieldVerifierAdapter.ZeroAddress.selector);
        new VeilShieldVerifierAdapter(transferVerifier, IVerifier(address(0)));
    }

    function testInvalidTransferProofReturnsFalse() public {
        transferVerifier.setValid(false);

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

    function testRevertedTransferProofReturnsFalse() public {
        transferVerifier.setShouldRevert(true);

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

    function testWithdrawRejectsAmountLargerThanCircuitRange() public {
        vm.expectRevert(abi.encodeWithSelector(VeilShieldVerifierAdapter.AmountTooLarge.selector, uint256(type(uint128).max) + 1));
        adapter.verifyWithdrawProof(
            hex"01",
            keccak256("nullifier"),
            keccak256("note"),
            sender,
            token,
            uint256(type(uint128).max) + 1
        );
    }

    function testTransferPublicInputsAreOrderedForCircuit() public view {
        bytes32 nullifierHash = keccak256("nullifier");
        bytes32 inputCommitment = keccak256("input");
        bytes32 outputCommitment = keccak256("output");
        bytes32 changeCommitment = keccak256("change");

        bytes32[] memory publicInputs = adapter.transferPublicInputs(
            nullifierHash,
            inputCommitment,
            outputCommitment,
            changeCommitment,
            sender,
            recipient,
            token
        );

        assertEq(publicInputs[0], bytes32(uint256(uint160(sender))));
        assertEq(publicInputs[1], bytes32(uint256(uint160(recipient))));
        assertEq(publicInputs[2], bytes32(uint256(uint160(token))));
        assertEq(publicInputs[3], inputCommitment);
        assertEq(publicInputs[4], outputCommitment);
        assertEq(publicInputs[5], changeCommitment);
        assertEq(publicInputs[6], nullifierHash);
    }

    function testWithdrawPublicInputsAreOrderedForCircuit() public view {
        bytes32 nullifierHash = keccak256("nullifier");
        bytes32 noteCommitment = keccak256("note");
        uint256 amount = 25e6;

        bytes32[] memory publicInputs = adapter.withdrawPublicInputs(nullifierHash, noteCommitment, sender, token, amount);

        assertEq(publicInputs[0], bytes32(uint256(uint160(sender))));
        assertEq(publicInputs[1], bytes32(uint256(uint160(token))));
        assertEq(publicInputs[2], noteCommitment);
        assertEq(publicInputs[3], nullifierHash);
        assertEq(publicInputs[4], bytes32(amount));
    }
}
