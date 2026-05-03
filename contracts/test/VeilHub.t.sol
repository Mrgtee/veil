// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {VeilHub} from "../src/VeilHub.sol";
import {IERC20} from "../src/token/IERC20.sol";

contract MockUSDC is IERC20 {
    string public constant name = "Mock USDC";
    string public constant symbol = "USDC";
    uint8 public constant decimals = 18;

    uint256 public override totalSupply;
    mapping(address account => uint256) public override balanceOf;
    mapping(address owner => mapping(address spender => uint256)) public override allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }

    function approve(address spender, uint256 value) external override returns (bool) {
        allowance[msg.sender][spender] = value;
        return true;
    }

    function transfer(address to, uint256 value) external override returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external override returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= value, "ALLOWANCE");
        allowance[from][msg.sender] = allowed - value;
        _transfer(from, to, value);
        return true;
    }

    function _transfer(address from, address to, uint256 value) internal {
        require(to != address(0), "ZERO_TO");
        require(balanceOf[from] >= value, "BALANCE");
        balanceOf[from] -= value;
        balanceOf[to] += value;
    }
}

contract VeilHubTest is Test {
    MockUSDC internal usdc;
    VeilHub internal hub;

    address internal owner = address(0xA11CE);
    address internal payer = address(0xB0B);
    address internal recipient = address(0xCAFE);

    function setUp() public {
        usdc = new MockUSDC();
        hub = new VeilHub(usdc, owner);
        usdc.mint(payer, 1_000e18);

        vm.prank(payer);
        usdc.approve(address(hub), type(uint256).max);
    }

    function testPayOpenTransfersUsdcAndRecordsPayment() public {
        bytes32 paymentId = keccak256("payment-1");

        vm.prank(payer);
        hub.payOpen(paymentId, recipient, 25e18, keccak256("invoice-1"));

        assertTrue(hub.paymentRecorded(paymentId));
        assertEq(usdc.balanceOf(recipient), 25e18);
        assertEq(usdc.balanceOf(payer), 975e18);
    }

    function testPayOpenRejectsInvalidRecipient() public {
        vm.prank(payer);
        vm.expectRevert(VeilHub.ZeroAddress.selector);
        hub.payOpen(keccak256("payment-2"), address(0), 1e18, bytes32(0));
    }

    function testPayOpenRejectsZeroAmount() public {
        vm.prank(payer);
        vm.expectRevert(VeilHub.ZeroAmount.selector);
        hub.payOpen(keccak256("payment-3"), recipient, 0, bytes32(0));
    }

    function testPayOpenRejectsDuplicatePaymentId() public {
        bytes32 paymentId = keccak256("payment-4");

        vm.startPrank(payer);
        hub.payOpen(paymentId, recipient, 1e18, bytes32(0));
        vm.expectRevert(abi.encodeWithSelector(VeilHub.AlreadyRecorded.selector, paymentId));
        hub.payOpen(paymentId, recipient, 1e18, bytes32(0));
        vm.stopPrank();
    }

    function testPayOpenBatchTransfersAndRecordsBatch() public {
        address[] memory recipients = new address[](2);
        recipients[0] = address(0x1);
        recipients[1] = address(0x2);

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 2e18;
        amounts[1] = 3e18;

        bytes32[] memory paymentIds = new bytes32[](2);
        paymentIds[0] = keccak256("batch-payment-1");
        paymentIds[1] = keccak256("batch-payment-2");

        bytes32 batchId = keccak256("batch-1");

        vm.prank(payer);
        hub.payOpenBatch(batchId, recipients, amounts, paymentIds, bytes32(0));

        assertTrue(hub.batchRecorded(batchId));
        assertTrue(hub.paymentRecorded(paymentIds[0]));
        assertTrue(hub.paymentRecorded(paymentIds[1]));
        assertEq(usdc.balanceOf(recipients[0]), 2e18);
        assertEq(usdc.balanceOf(recipients[1]), 3e18);
    }

    function testPayOpenBatchRejectsEmptyBatch() public {
        vm.prank(payer);
        vm.expectRevert(VeilHub.EmptyBatch.selector);
        hub.payOpenBatch(keccak256("empty"), new address[](0), new uint256[](0), new bytes32[](0), bytes32(0));
    }

    function testPayOpenBatchRejectsMismatchedArrays() public {
        address[] memory recipients = new address[](1);
        recipients[0] = recipient;

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 1e18;
        amounts[1] = 2e18;

        bytes32[] memory paymentIds = new bytes32[](1);
        paymentIds[0] = keccak256("mismatch-payment");

        vm.prank(payer);
        vm.expectRevert(VeilHub.LengthMismatch.selector);
        hub.payOpenBatch(keccak256("mismatch"), recipients, amounts, paymentIds, bytes32(0));
    }

    function testUnifiedBalanceReferenceRecordsOpenPayment() public {
        bytes32 paymentId = keccak256("unified-payment");

        vm.prank(payer);
        hub.recordUnifiedBalanceOpenPayment(paymentId, recipient, 9e18, keccak256("circle-transfer"));

        assertTrue(hub.paymentRecorded(paymentId));
    }
}

