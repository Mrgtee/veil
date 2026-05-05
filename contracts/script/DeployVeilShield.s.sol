// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console2} from "forge-std/Script.sol";
import {VeilShield} from "../src/VeilShield.sol";
import {VeilShieldVerifierAdapter} from "../src/VeilShieldVerifierAdapter.sol";
import {IERC20} from "../src/token/IERC20.sol";
import {TransferVerifier} from "../src/verifiers/TransferVerifier.sol";
import {WithdrawVerifier} from "../src/verifiers/WithdrawVerifier.sol";

contract DeployVeilShield is Script {
    uint256 internal constant ARC_TESTNET_CHAIN_ID = 5_042_002;

    function run()
        external
        returns (
            TransferVerifier transferVerifier,
            WithdrawVerifier withdrawVerifier,
            VeilShieldVerifierAdapter verifierAdapter,
            VeilShield shield
        )
    {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address usdc = vm.envAddress("ARC_USDC_ADDRESS");
        uint256 configuredChainId = vm.envUint("ARC_CHAIN_ID");

        require(configuredChainId == ARC_TESTNET_CHAIN_ID, "ARC_CHAIN_ID must be 5042002");
        require(usdc != address(0), "ARC_USDC_ADDRESS is required");
        require(block.chainid == configuredChainId, "Connected RPC chain id does not match ARC_CHAIN_ID");

        address deployer = vm.addr(privateKey);

        console2.log("VeilShield deployer", deployer);
        console2.log("Arc USDC", usdc);
        console2.log("Chain ID", block.chainid);

        vm.startBroadcast(privateKey);
        transferVerifier = new TransferVerifier();
        withdrawVerifier = new WithdrawVerifier();
        verifierAdapter = new VeilShieldVerifierAdapter(transferVerifier, withdrawVerifier);
        shield = new VeilShield(IERC20(usdc), verifierAdapter, deployer);
        vm.stopBroadcast();

        console2.log("Transfer verifier deployed", address(transferVerifier));
        console2.log("Withdraw verifier deployed", address(withdrawVerifier));
        console2.log("Verifier adapter deployed", address(verifierAdapter));
        console2.log("VeilShield deployed", address(shield));
    }
}
