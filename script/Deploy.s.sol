// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {MinorityGame} from "../src/MinorityGame.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        MinorityGame game = new MinorityGame();
        console.log("MinorityGame deployed at:", address(game));

        // Seed initial markets (0.01 ETH each)
        uint256 fee = game.CREATION_FEE();
        game.createGame{value: fee}("Will ETH hit $5,000 this month?", "Yes", "No");
        game.createGame{value: fee}("Bitcoin dominance above 55% by Q2?", "Above 55%", "Below 55%");
        game.createGame{value: fee}("Next Ethereum upgrade on time?", "On time", "Delayed");
        game.createGame{value: fee}("Will Solana flip Ethereum in TVL?", "Solana", "Ethereum");
        game.createGame{value: fee}("Fed rate cut in next meeting?", "Cut", "Hold");
        game.createGame{value: fee}("NFT market recovery by summer?", "Recovery", "Still down");
        console.log("Seeded 6 initial markets");

        vm.stopBroadcast();
    }
}
