// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {VeilHub} from "../src/VeilHub.sol";
import {IERC20} from "../src/token/IERC20.sol";

contract DeployVeilHub is Script {
    uint256 internal constant ARC_TESTNET_CHAIN_ID = 5_042_002;

    function run() external returns (VeilHub hub) {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address usdc = vm.envAddress("ARC_USDC_ADDRESS");
        uint256 configuredChainId = vm.envUint("ARC_CHAIN_ID");

        require(configuredChainId == ARC_TESTNET_CHAIN_ID, "ARC_CHAIN_ID must be 5042002");
        require(usdc != address(0), "ARC_USDC_ADDRESS is required");
        require(block.chainid == configuredChainId, "Connected RPC chain id does not match ARC_CHAIN_ID");

        address deployer = vm.addr(privateKey);

        console2.log("VeilHub deployer", deployer);
        console2.log("Arc USDC", usdc);
        console2.log("Chain ID", block.chainid);

        vm.startBroadcast(privateKey);
        hub = new VeilHub(IERC20(usdc), deployer);
        vm.stopBroadcast();

        console2.log("VeilHub deployed", address(hub));
    }
}
