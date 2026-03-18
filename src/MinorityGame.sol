// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title MinorityGame - 소수결 기반 온체인 베팅 게임
/// @notice 참여자들이 A/B 중 하나를 선택하고, 소수가 선택한 쪽이 보상을 받는 게임
contract MinorityGame {
    // ─── Enums ───────────────────────────────────────────────
    enum Choice {
        None,
        A,
        B
    }

    enum GameStatus {
        Active,
        Resolved
    }

    // ─── Structs ─────────────────────────────────────────────
    struct Game {
        address creator;
        uint256 startTime;
        uint256 totalPool;
        uint256 countA;
        uint256 countB;
        Choice winningChoice;
        GameStatus status;
        uint256 payoutPerPlayer;
        bool isTie;
        string question;
        string optionA;
        string optionB;
    }

    // ─── Constants ───────────────────────────────────────────
    uint256 public constant BET_AMOUNT = 0.001 ether;
    uint256 public constant CREATION_FEE = 0.005 ether;
    uint256 public constant GAME_DURATION = 24 hours;
    uint256 public constant PROTOCOL_FEE_BPS = 100; // 1%
    uint256 public constant CREATOR_FEE_BPS = 900; // 9%
    uint256 private constant BPS_DENOMINATOR = 10000;

    // ─── State Variables ─────────────────────────────────────
    address public owner;
    uint256 public gameCount;
    uint256 public protocolFeeBalance;

    mapping(uint256 => Game) public games;
    mapping(uint256 => mapping(address => Choice)) public playerChoices;
    mapping(uint256 => mapping(address => bool)) public hasClaimed;
    mapping(address => uint256) public pendingWithdrawals;

    // ─── Reentrancy Guard ────────────────────────────────────
    uint256 private _locked = 1;

    modifier nonReentrant() {
        require(_locked != 2, "ReentrancyGuard: reentrant call");
        _locked = 2;
        _;
        _locked = 1;
    }

    // ─── Events ──────────────────────────────────────────────
    event GameCreated(uint256 indexed gameId, address indexed creator, uint256 startTime, string question, string optionA, string optionB);
    event Joined(uint256 indexed gameId, address indexed player, Choice choice);
    event Resolved(uint256 indexed gameId, Choice winningChoice, bool isTie);
    event Claimed(uint256 indexed gameId, address indexed player, uint256 amount);
    event FeesWithdrawn(address indexed to, uint256 amount);

    // ─── Constructor ─────────────────────────────────────────
    constructor() {
        owner = msg.sender;
    }

    // ─── Core Functions ──────────────────────────────────────

    /// @notice 새 게임을 생성한다 (생성 fee 필요)
    /// @param question 베팅 질문
    /// @param optionA 선택지 A 라벨
    /// @param optionB 선택지 B 라벨
    /// @return gameId 생성된 게임 ID
    function createGame(
        string calldata question,
        string calldata optionA,
        string calldata optionB
    ) external payable returns (uint256 gameId) {
        require(msg.value == CREATION_FEE, "Incorrect creation fee");
        require(bytes(question).length > 0, "Question required");
        require(bytes(optionA).length > 0, "Option A required");
        require(bytes(optionB).length > 0, "Option B required");

        gameId = gameCount++;

        Game storage g = games[gameId];
        g.creator = msg.sender;
        g.startTime = block.timestamp;
        g.question = question;
        g.optionA = optionA;
        g.optionB = optionB;

        // 생성 fee는 프로토콜 수익으로
        protocolFeeBalance += msg.value;

        emit GameCreated(gameId, msg.sender, block.timestamp, question, optionA, optionB);
    }

    /// @notice 게임에 참여한다 (0.001 ETH 베팅, A 또는 B 선택)
    /// @param gameId 참여할 게임 ID
    /// @param choice 선택 (A 또는 B)
    function joinGame(uint256 gameId, Choice choice) external payable {
        require(msg.value == BET_AMOUNT, "Must bet exactly 0.001 ETH");
        require(choice == Choice.A || choice == Choice.B, "Invalid choice");

        Game storage g = games[gameId];
        require(g.creator != address(0), "Game does not exist");
        require(g.status == GameStatus.Active, "Game not active");
        require(block.timestamp < g.startTime + GAME_DURATION, "Game expired");
        require(playerChoices[gameId][msg.sender] == Choice.None, "Already joined");

        playerChoices[gameId][msg.sender] = choice;

        if (choice == Choice.A) {
            g.countA++;
        } else {
            g.countB++;
        }

        g.totalPool += msg.value;

        emit Joined(gameId, msg.sender, choice);
    }

    /// @notice 게임 결과를 확정한다 (24시간 경과 후 누구나 호출 가능)
    /// @param gameId 확정할 게임 ID
    function resolveGame(uint256 gameId) external {
        Game storage g = games[gameId];
        require(g.creator != address(0), "Game does not exist");
        require(g.status == GameStatus.Active, "Game not active");
        require(block.timestamp >= g.startTime + GAME_DURATION, "Game not expired yet");

        uint256 totalParticipants = g.countA + g.countB;
        require(totalParticipants > 0, "No participants");

        uint256 totalPool = g.totalPool;
        uint256 protocolFee = (totalPool * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
        protocolFeeBalance += protocolFee;

        if (g.countA == g.countB) {
            // 무승부: protocol fee만 차감, 나머지 전원 균등 분배
            g.isTie = true;
            g.winningChoice = Choice.None;
            uint256 refundPool = totalPool - protocolFee;
            g.payoutPerPlayer = refundPool / totalParticipants;
        } else {
            // 소수결: 적은 쪽이 승리
            uint256 creatorFee = (totalPool * CREATOR_FEE_BPS) / BPS_DENOMINATOR;
            pendingWithdrawals[g.creator] += creatorFee;

            uint256 winnerPool = totalPool - protocolFee - creatorFee;

            if (g.countA < g.countB) {
                g.winningChoice = Choice.A;
                g.payoutPerPlayer = winnerPool / g.countA;
            } else {
                g.winningChoice = Choice.B;
                g.payoutPerPlayer = winnerPool / g.countB;
            }
        }

        g.status = GameStatus.Resolved;

        emit Resolved(gameId, g.winningChoice, g.isTie);
    }

    /// @notice 보상을 청구한다 (승리자 또는 무승부 시 참여자)
    /// @param gameId 클레임할 게임 ID
    function claimReward(uint256 gameId) external nonReentrant {
        Game storage g = games[gameId];
        require(g.status == GameStatus.Resolved, "Game not resolved");
        require(playerChoices[gameId][msg.sender] != Choice.None, "Not a participant");
        require(!hasClaimed[gameId][msg.sender], "Already claimed");

        if (!g.isTie) {
            require(playerChoices[gameId][msg.sender] == g.winningChoice, "Not a winner");
        }

        uint256 payout = g.payoutPerPlayer;
        require(payout > 0, "Nothing to claim");

        // CEI: Effects before Interactions
        hasClaimed[gameId][msg.sender] = true;

        (bool success,) = msg.sender.call{value: payout}("");
        require(success, "Transfer failed");

        emit Claimed(gameId, msg.sender, payout);
    }

    /// @notice 게임 생성자의 수수료를 인출한다
    function withdrawPendingFees() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "No pending fees");

        pendingWithdrawals[msg.sender] = 0;

        (bool success,) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");

        emit FeesWithdrawn(msg.sender, amount);
    }

    /// @notice 프로토콜 수수료를 인출한다 (owner만)
    function withdrawProtocolFees() external nonReentrant {
        require(msg.sender == owner, "Not owner");
        uint256 amount = protocolFeeBalance;
        require(amount > 0, "No protocol fees");

        protocolFeeBalance = 0;

        (bool success,) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");

        emit FeesWithdrawn(msg.sender, amount);
    }

    // ─── View Functions ──────────────────────────────────────

    /// @notice 게임 정보를 반환한다
    function getGame(uint256 gameId) external view returns (Game memory) {
        return games[gameId];
    }

    /// @notice 특정 플레이어의 선택을 반환한다
    function getPlayerChoice(uint256 gameId, address player) external view returns (Choice) {
        return playerChoices[gameId][player];
    }

    /// @notice 클레임 가능 금액을 반환한다
    function getClaimable(uint256 gameId, address player) external view returns (uint256) {
        Game storage g = games[gameId];

        if (g.status != GameStatus.Resolved) return 0;
        if (playerChoices[gameId][player] == Choice.None) return 0;
        if (hasClaimed[gameId][player]) return 0;

        if (!g.isTie && playerChoices[gameId][player] != g.winningChoice) return 0;

        return g.payoutPerPlayer;
    }

    /// @notice 게임 만료 여부를 반환한다
    function isGameExpired(uint256 gameId) external view returns (bool) {
        Game storage g = games[gameId];
        return block.timestamp >= g.startTime + GAME_DURATION;
    }
}
