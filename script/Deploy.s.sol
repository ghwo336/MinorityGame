// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {MinorityGame} from "../src/MinorityGame.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        address resolver = vm.envAddress("RESOLVER_ADDRESS");
        MinorityGame game = new MinorityGame(resolver);
        console.log("MinorityGame deployed at:", address(game));
        console.log("Resolver set to:", resolver);

        vm.stopBroadcast();
    }
}
