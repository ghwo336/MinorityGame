// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {MinorityGame} from "../src/MinorityGame.sol";

contract MinorityGameTest is Test {
    MinorityGame public game;

    address public deployer;
    address public creator;
    address public alice;
    address public bob;
    address public charlie;
    address public dave;

    uint256 constant BET_AMOUNT = 0.001 ether;
    uint256 constant CREATION_FEE = 0.005 ether;
    uint256 constant GAME_DURATION = 24 hours;

    event GameCreated(uint256 indexed gameId, address indexed creator, uint256 startTime, string question, string optionA, string optionB);
    event Joined(uint256 indexed gameId, address indexed player, MinorityGame.Choice choice);
    event Resolved(uint256 indexed gameId, MinorityGame.Choice winningChoice, bool isTie);
    event Claimed(uint256 indexed gameId, address indexed player, uint256 amount);

    function setUp() public {
        deployer = makeAddr("deployer");
        creator = makeAddr("creator");
        alice = makeAddr("alice");
        bob = makeAddr("bob");
        charlie = makeAddr("charlie");
        dave = makeAddr("dave");

        vm.deal(creator, 10 ether);
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
        vm.deal(charlie, 10 ether);
        vm.deal(dave, 10 ether);

        vm.prank(deployer);
        game = new MinorityGame();
    }

    // ─── Helper ──────────────────────────────────────────────

    function _createGame() internal returns (uint256) {
        vm.prank(creator);
        return game.createGame{value: CREATION_FEE}("Who will win?", "Team A", "Team B");
    }

    function _join(address player, uint256 gameId, MinorityGame.Choice choice) internal {
        vm.prank(player);
        game.joinGame{value: BET_AMOUNT}(gameId, choice);
    }

    // ─── 1. 게임 생성 성공 ───────────────────────────────────

    function test_CreateGame_Success() public {
        vm.expectEmit(true, true, false, true);
        emit GameCreated(0, creator, block.timestamp, "Who will win?", "Team A", "Team B");

        uint256 gameId = _createGame();

        assertEq(gameId, 0);
        assertEq(game.gameCount(), 1);

        MinorityGame.Game memory g = game.getGame(gameId);
        assertEq(g.creator, creator);
        assertEq(g.totalPool, 0);
        assertEq(g.countA, 0);
        assertEq(g.countB, 0);
        assertEq(uint8(g.status), uint8(MinorityGame.GameStatus.Active));
    }

    // ─── 2. 생성 fee 부족 시 실패 ───────────────────────────

    function test_RevertWhen_CreateGame_InsufficientFee() public {
        vm.prank(creator);
        vm.expectRevert("Incorrect creation fee");
        game.createGame{value: 0.002 ether}("Q", "A", "B");
    }

    // ─── 3. 게임 참여 성공 ───────────────────────────────────

    function test_JoinGame_Success() public {
        uint256 gameId = _createGame();

        vm.expectEmit(true, true, false, true);
        emit Joined(gameId, alice, MinorityGame.Choice.A);

        _join(alice, gameId, MinorityGame.Choice.A);

        MinorityGame.Game memory g = game.getGame(gameId);
        assertEq(g.countA, 1);
        assertEq(g.countB, 0);
        assertEq(g.totalPool, BET_AMOUNT);
        assertEq(uint8(game.getPlayerChoice(gameId, alice)), uint8(MinorityGame.Choice.A));
    }

    // ─── 4. 중복 참여 시 실패 ───────────────────────────────

    function test_RevertWhen_JoinGame_AlreadyJoined() public {
        uint256 gameId = _createGame();
        _join(alice, gameId, MinorityGame.Choice.A);

        vm.prank(alice);
        vm.expectRevert("Already joined");
        game.joinGame{value: BET_AMOUNT}(gameId, MinorityGame.Choice.B);
    }

    // ─── 5. 만료된 게임 참여 시 실패 ────────────────────────

    function test_RevertWhen_JoinGame_GameExpired() public {
        uint256 gameId = _createGame();

        vm.warp(block.timestamp + GAME_DURATION);

        vm.prank(alice);
        vm.expectRevert("Game expired");
        game.joinGame{value: BET_AMOUNT}(gameId, MinorityGame.Choice.A);
    }

    // ─── 6. 잘못된 베팅 금액 시 실패 ────────────────────────

    function test_RevertWhen_JoinGame_WrongBetAmount() public {
        uint256 gameId = _createGame();

        vm.prank(alice);
        vm.expectRevert("Must bet exactly 0.001 ETH");
        game.joinGame{value: 0.002 ether}(gameId, MinorityGame.Choice.A);
    }

    // ─── 7. 24시간 전 resolve 시 실패 ───────────────────────

    function test_RevertWhen_ResolveGame_BeforeExpiry() public {
        uint256 gameId = _createGame();
        _join(alice, gameId, MinorityGame.Choice.A);

        vm.expectRevert("Game not expired yet");
        game.resolveGame(gameId);
    }

    // ─── 8. 소수결 승리 처리 ────────────────────────────────

    function test_ResolveGame_MinorityWins() public {
        uint256 gameId = _createGame();

        // A: alice, bob / B: charlie → B가 소수 → B 승리
        _join(alice, gameId, MinorityGame.Choice.A);
        _join(bob, gameId, MinorityGame.Choice.A);
        _join(charlie, gameId, MinorityGame.Choice.B);

        vm.warp(block.timestamp + GAME_DURATION);

        vm.expectEmit(true, false, false, true);
        emit Resolved(gameId, MinorityGame.Choice.B, false);

        game.resolveGame(gameId);

        MinorityGame.Game memory g = game.getGame(gameId);
        assertEq(uint8(g.winningChoice), uint8(MinorityGame.Choice.B));
        assertEq(uint8(g.status), uint8(MinorityGame.GameStatus.Resolved));
        assertFalse(g.isTie);

        // 총 풀: 0.003 ETH
        // protocol: 0.003 * 1% = 0.00003 ETH
        // creator: 0.003 * 9% = 0.00027 ETH
        // winner pool: 0.003 - 0.00003 - 0.00027 = 0.0027 ETH
        // 승자 1명(charlie): 0.0027 ETH
        assertEq(g.payoutPerPlayer, 0.0027 ether);
    }

    // ─── 9. 무승부 처리 ─────────────────────────────────────

    function test_ResolveGame_Tie() public {
        uint256 gameId = _createGame();

        // A: alice / B: bob → 무승부
        _join(alice, gameId, MinorityGame.Choice.A);
        _join(bob, gameId, MinorityGame.Choice.B);

        vm.warp(block.timestamp + GAME_DURATION);
        game.resolveGame(gameId);

        MinorityGame.Game memory g = game.getGame(gameId);
        assertTrue(g.isTie);
        assertEq(uint8(g.winningChoice), uint8(MinorityGame.Choice.None));

        // 총 풀: 0.002 ETH
        // protocol: 0.002 * 1% = 0.00002 ETH
        // refund pool: 0.002 - 0.00002 = 0.00198 ETH
        // 참여자 2명: 0.00198 / 2 = 0.00099 ETH
        uint256 expectedRefund = (0.002 ether - (0.002 ether * 100 / 10000)) / 2;
        assertEq(g.payoutPerPlayer, expectedRefund);
    }

    // ─── 10. 정상 클레임 및 금액 검증 ───────────────────────

    function test_ClaimReward_AfterResolve() public {
        uint256 gameId = _createGame();

        // A: alice, bob / B: charlie → B가 소수 → charlie 승리
        _join(alice, gameId, MinorityGame.Choice.A);
        _join(bob, gameId, MinorityGame.Choice.A);
        _join(charlie, gameId, MinorityGame.Choice.B);

        vm.warp(block.timestamp + GAME_DURATION);
        game.resolveGame(gameId);

        MinorityGame.Game memory g = game.getGame(gameId);
        uint256 expectedPayout = g.payoutPerPlayer;

        uint256 balanceBefore = charlie.balance;

        vm.prank(charlie);
        game.claimReward(gameId);

        assertEq(charlie.balance, balanceBefore + expectedPayout);
        assertTrue(game.hasClaimed(gameId, charlie));

        // 다수파(alice)는 클레임 불가
        vm.prank(alice);
        vm.expectRevert("Not a winner");
        game.claimReward(gameId);
    }

    // ─── 11. 중복 클레임 시 실패 ────────────────────────────

    function test_RevertWhen_ClaimReward_DuplicateClaim() public {
        uint256 gameId = _createGame();

        // A: alice / B: bob, charlie → A가 소수 → alice 승리
        _join(alice, gameId, MinorityGame.Choice.A);
        _join(bob, gameId, MinorityGame.Choice.B);
        _join(charlie, gameId, MinorityGame.Choice.B);

        vm.warp(block.timestamp + GAME_DURATION);
        game.resolveGame(gameId);

        vm.prank(alice);
        game.claimReward(gameId);

        vm.prank(alice);
        vm.expectRevert("Already claimed");
        game.claimReward(gameId);
    }

    // ─── 12. 무승부 시 환불 ─────────────────────────────────

    function test_ClaimReward_TieRefund() public {
        uint256 gameId = _createGame();

        _join(alice, gameId, MinorityGame.Choice.A);
        _join(bob, gameId, MinorityGame.Choice.B);

        vm.warp(block.timestamp + GAME_DURATION);
        game.resolveGame(gameId);

        MinorityGame.Game memory g = game.getGame(gameId);
        assertTrue(g.isTie);

        uint256 balanceBefore = alice.balance;
        vm.prank(alice);
        game.claimReward(gameId);
        assertEq(alice.balance, balanceBefore + g.payoutPerPlayer);

        uint256 balanceBefore2 = bob.balance;
        vm.prank(bob);
        game.claimReward(gameId);
        assertEq(bob.balance, balanceBefore2 + g.payoutPerPlayer);
    }
}
