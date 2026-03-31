// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {MinorityGame} from "../src/MinorityGame.sol";

contract MinorityGameTest is Test {
    MinorityGame public game;

    address public deployer;
    address public resolver;
    address public creator;
    address public alice;
    address public bob;
    address public charlie;
    address public dave;

    uint256 constant BET_AMOUNT    = 0.001 ether;
    uint256 constant CREATION_FEE  = 0.003 ether;
    uint256 constant GAME_DURATION = 1 days;

    // 테스트용 salt 저장
    mapping(address => mapping(uint256 => bytes32)) private _salts;

    event GameCreated(uint256 indexed gameId, address indexed creator, uint256 startTime, string question, string optionA, string optionB);
    event Joined(uint256 indexed gameId, address indexed player, MinorityGame.Choice choice);
    event Resolved(uint256 indexed gameId, MinorityGame.Choice winningChoice, bool isTie);
    event Claimed(uint256 indexed gameId, address indexed player, uint256 amount);

    function setUp() public {
        deployer = makeAddr("deployer");
        resolver = makeAddr("resolver");
        creator  = makeAddr("creator");
        alice    = makeAddr("alice");
        bob      = makeAddr("bob");
        charlie  = makeAddr("charlie");
        dave     = makeAddr("dave");

        vm.deal(creator,  10 ether);
        vm.deal(alice,    10 ether);
        vm.deal(bob,      10 ether);
        vm.deal(charlie,  10 ether);
        vm.deal(dave,     10 ether);

        vm.prank(deployer);
        game = new MinorityGame(resolver);
    }

    // ─── Helpers ─────────────────────────────────────────────

    function _createGame() internal returns (uint256) {
        vm.prank(creator);
        return game.createGame{value: CREATION_FEE}("Who will win?", "Team A", "Team B", 1);
    }

    /// @dev 플레이어가 commitVote 호출, salt 내부 저장
    function _commit(address player, uint256 gameId, MinorityGame.Choice choice) internal {
        bytes32 salt = keccak256(abi.encodePacked(player, gameId, block.timestamp));
        _salts[player][gameId] = salt;

        uint8 choiceU8 = uint8(choice);
        bytes32 commitment = keccak256(abi.encodePacked(gameId, choiceU8, salt, player));

        vm.prank(player);
        game.commitVote{value: BET_AMOUNT}(gameId, commitment);
    }

    /// @dev resolver가 저장된 모든 커밋을 revealVotes로 제출
    function _revealAll(
        uint256 gameId,
        address[] memory players,
        MinorityGame.Choice[] memory choices
    ) internal {
        uint8[]   memory choicesU8 = new uint8[](players.length);
        bytes32[] memory salts     = new bytes32[](players.length);

        for (uint256 i = 0; i < players.length; i++) {
            choicesU8[i] = uint8(choices[i]);
            salts[i]     = _salts[players[i]][gameId];
        }

        vm.prank(resolver);
        game.revealVotes(gameId, players, choicesU8, salts);
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

    // ─── 2. 생성 fee 오류 ────────────────────────────────────

    function test_RevertWhen_CreateGame_InsufficientFee() public {
        vm.prank(creator);
        vm.expectRevert("Incorrect creation fee");
        game.createGame{value: 0.001 ether}("Q", "A", "B", 1);
    }

    // ─── 3. commitVote 성공 ──────────────────────────────────

    function test_CommitVote_Success() public {
        uint256 gameId = _createGame();

        _commit(alice, gameId, MinorityGame.Choice.A);

        MinorityGame.Game memory g = game.getGame(gameId);
        assertEq(g.commitCount, 1);
        assertEq(g.totalPool, BET_AMOUNT);
        assertTrue(game.hasCommitted(gameId, alice));
    }

    // ─── 4. 중복 커밋 시 실패 ───────────────────────────────

    function test_RevertWhen_CommitVote_AlreadyCommitted() public {
        uint256 gameId = _createGame();
        _commit(alice, gameId, MinorityGame.Choice.A);

        bytes32 commitment = keccak256(abi.encodePacked(uint256(1)));
        vm.prank(alice);
        vm.expectRevert("Already committed");
        game.commitVote{value: BET_AMOUNT}(gameId, commitment);
    }

    // ─── 5. 만료 후 커밋 시 실패 ────────────────────────────

    function test_RevertWhen_CommitVote_GameExpired() public {
        uint256 gameId = _createGame();
        vm.warp(block.timestamp + GAME_DURATION);

        bytes32 commitment = keccak256(abi.encodePacked(uint256(1)));
        vm.prank(alice);
        vm.expectRevert("Game expired");
        game.commitVote{value: BET_AMOUNT}(gameId, commitment);
    }

    // ─── 6. 만료 전 reveal 시 실패 ──────────────────────────

    function test_RevertWhen_RevealVotes_BeforeExpiry() public {
        uint256 gameId = _createGame();
        _commit(alice, gameId, MinorityGame.Choice.A);

        address[] memory players = new address[](1);
        MinorityGame.Choice[] memory choices = new MinorityGame.Choice[](1);
        players[0] = alice;
        choices[0] = MinorityGame.Choice.A;

        vm.expectRevert("Game not expired yet");
        _revealAll(gameId, players, choices);
    }

    // ─── 7. 일부만 reveal 시 실패 ───────────────────────────

    function test_RevertWhen_RevealVotes_MissingCommits() public {
        uint256 gameId = _createGame();
        _commit(alice, gameId, MinorityGame.Choice.A);
        _commit(bob,   gameId, MinorityGame.Choice.B);

        vm.warp(block.timestamp + GAME_DURATION);

        // alice만 reveal 시도 (bob 누락)
        address[] memory players = new address[](1);
        uint8[]   memory choices = new uint8[](1);
        bytes32[] memory salts   = new bytes32[](1);
        players[0] = alice;
        choices[0] = 1;
        salts[0]   = _salts[alice][gameId];

        vm.prank(resolver);
        vm.expectRevert("Must reveal all commits");
        game.revealVotes(gameId, players, choices, salts);
    }

    // ─── 8. 소수결 승리 처리 ────────────────────────────────

    function test_ResolveGame_MinorityWins() public {
        uint256 gameId = _createGame();

        // A: alice, bob / B: charlie → B가 소수 → B 승리
        _commit(alice,   gameId, MinorityGame.Choice.A);
        _commit(bob,     gameId, MinorityGame.Choice.A);
        _commit(charlie, gameId, MinorityGame.Choice.B);

        vm.warp(block.timestamp + GAME_DURATION);

        address[] memory players = new address[](3);
        MinorityGame.Choice[] memory choices = new MinorityGame.Choice[](3);
        players[0] = alice;   choices[0] = MinorityGame.Choice.A;
        players[1] = bob;     choices[1] = MinorityGame.Choice.A;
        players[2] = charlie; choices[2] = MinorityGame.Choice.B;

        vm.expectEmit(true, false, false, true);
        emit Resolved(gameId, MinorityGame.Choice.B, false);

        _revealAll(gameId, players, choices);

        MinorityGame.Game memory g = game.getGame(gameId);
        assertEq(uint8(g.winningChoice), uint8(MinorityGame.Choice.B));
        assertEq(uint8(g.status), uint8(MinorityGame.GameStatus.Resolved));
        assertFalse(g.isTie);

        // 총 풀: 0.003 ETH / protocol 1% / creator 9% / winner pool = 90%
        // winner pool = 0.003 * 90% = 0.0027 ETH / 승자 1명
        assertEq(g.payoutPerPlayer, 0.0027 ether);
    }

    // ─── 9. 무승부 처리 ─────────────────────────────────────

    function test_ResolveGame_Tie() public {
        uint256 gameId = _createGame();

        _commit(alice, gameId, MinorityGame.Choice.A);
        _commit(bob,   gameId, MinorityGame.Choice.B);

        vm.warp(block.timestamp + GAME_DURATION);

        address[] memory players = new address[](2);
        MinorityGame.Choice[] memory choices = new MinorityGame.Choice[](2);
        players[0] = alice; choices[0] = MinorityGame.Choice.A;
        players[1] = bob;   choices[1] = MinorityGame.Choice.B;

        _revealAll(gameId, players, choices);

        MinorityGame.Game memory g = game.getGame(gameId);
        assertTrue(g.isTie);
        assertEq(uint8(g.winningChoice), uint8(MinorityGame.Choice.None));
    }

    // ─── 10. 정상 클레임 ────────────────────────────────────

    function test_ClaimReward_AfterResolve() public {
        uint256 gameId = _createGame();

        _commit(alice,   gameId, MinorityGame.Choice.A);
        _commit(bob,     gameId, MinorityGame.Choice.A);
        _commit(charlie, gameId, MinorityGame.Choice.B);

        vm.warp(block.timestamp + GAME_DURATION);

        address[] memory players = new address[](3);
        MinorityGame.Choice[] memory choices = new MinorityGame.Choice[](3);
        players[0] = alice;   choices[0] = MinorityGame.Choice.A;
        players[1] = bob;     choices[1] = MinorityGame.Choice.A;
        players[2] = charlie; choices[2] = MinorityGame.Choice.B;

        _revealAll(gameId, players, choices);

        MinorityGame.Game memory g = game.getGame(gameId);
        uint256 expectedPayout = g.payoutPerPlayer;

        uint256 balanceBefore = charlie.balance;
        vm.prank(charlie);
        game.claimReward(gameId);
        assertEq(charlie.balance, balanceBefore + expectedPayout);
        assertTrue(game.hasClaimed(gameId, charlie));

        // 다수파 alice 클레임 불가
        vm.prank(alice);
        vm.expectRevert("Not a winner");
        game.claimReward(gameId);
    }

    // ─── 11. 중복 클레임 시 실패 ────────────────────────────

    function test_RevertWhen_ClaimReward_DuplicateClaim() public {
        uint256 gameId = _createGame();

        _commit(alice,   gameId, MinorityGame.Choice.A);
        _commit(bob,     gameId, MinorityGame.Choice.B);
        _commit(charlie, gameId, MinorityGame.Choice.B);

        vm.warp(block.timestamp + GAME_DURATION);

        address[] memory players = new address[](3);
        MinorityGame.Choice[] memory choices = new MinorityGame.Choice[](3);
        players[0] = alice;   choices[0] = MinorityGame.Choice.A;
        players[1] = bob;     choices[1] = MinorityGame.Choice.B;
        players[2] = charlie; choices[2] = MinorityGame.Choice.B;

        _revealAll(gameId, players, choices);

        vm.prank(alice);
        game.claimReward(gameId);

        vm.prank(alice);
        vm.expectRevert("Already claimed");
        game.claimReward(gameId);
    }

    // ─── 12. 무승부 환불 ────────────────────────────────────

    function test_ClaimReward_TieRefund() public {
        uint256 gameId = _createGame();

        _commit(alice, gameId, MinorityGame.Choice.A);
        _commit(bob,   gameId, MinorityGame.Choice.B);

        vm.warp(block.timestamp + GAME_DURATION);

        address[] memory players = new address[](2);
        MinorityGame.Choice[] memory choices = new MinorityGame.Choice[](2);
        players[0] = alice; choices[0] = MinorityGame.Choice.A;
        players[1] = bob;   choices[1] = MinorityGame.Choice.B;

        _revealAll(gameId, players, choices);

        MinorityGame.Game memory g = game.getGame(gameId);
        assertTrue(g.isTie);

        uint256 balanceBefore = alice.balance;
        vm.prank(alice);
        game.claimReward(gameId);
        assertEq(alice.balance, balanceBefore + g.payoutPerPlayer);
    }

    // ─── 13. emergency refund ────────────────────────────────

    function test_EmergencyRefund() public {
        uint256 gameId = _createGame();
        _commit(alice, gameId, MinorityGame.Choice.A);

        // 게임 만료 + 3일 후
        vm.warp(block.timestamp + GAME_DURATION + 3 days);

        uint256 balanceBefore = alice.balance;
        vm.prank(alice);
        game.emergencyRefund(gameId);
        assertEq(alice.balance, balanceBefore + BET_AMOUNT);
    }
}
