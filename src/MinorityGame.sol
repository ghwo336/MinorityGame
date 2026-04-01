// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title MinorityGame - 커밋-리빌 기반 소수결 온체인 베팅 게임
/// @notice 투표 내용은 게임 종료 후 공개 (commit-reveal scheme)
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
        uint256 duration;
        uint256 totalPool;
        uint256 countA;
        uint256 countB;
        uint256 commitCount;
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
    uint256 public constant CREATION_FEE = 0.003 ether;
    uint256 public constant MIN_DURATION = 1 days;
    uint256 public constant MAX_DURATION = 7 days;
    uint256 public constant EMERGENCY_REFUND_DELAY = 3 days;
    uint256 public constant PROTOCOL_FEE_BPS = 100; // 1%
    uint256 public constant CREATOR_FEE_BPS = 900;  // 9%
    uint256 private constant BPS_DENOMINATOR = 10000;

    // ─── State Variables ─────────────────────────────────────
    address public owner;
    address public resolver;
    uint256 public gameCount;
    uint256 public protocolFeeBalance;

    mapping(uint256 => Game) public games;
    mapping(uint256 => mapping(address => bytes32)) public commitments;
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

    modifier onlyAuthorized() {
        require(msg.sender == resolver || msg.sender == owner, "Not authorized");
        _;
    }

    // ─── Events ──────────────────────────────────────────────
    event GameCreated(uint256 indexed gameId, address indexed creator, uint256 startTime, string question, string optionA, string optionB);
    event VoteCommitted(uint256 indexed gameId, address indexed player, bytes32 commitment);
    event Joined(uint256 indexed gameId, address indexed player, Choice choice);
    event Resolved(uint256 indexed gameId, Choice winningChoice, bool isTie);
    event Claimed(uint256 indexed gameId, address indexed player, uint256 amount);
    event FeesWithdrawn(address indexed to, uint256 amount);
    event EmergencyRefund(uint256 indexed gameId, address indexed player, uint256 amount);

    // ─── Constructor ─────────────────────────────────────────
    constructor(address _resolver) {
        owner = msg.sender;
        resolver = _resolver;
    }

    // ─── Admin ───────────────────────────────────────────────

    function setResolver(address _resolver) external {
        require(msg.sender == owner, "Not owner");
        resolver = _resolver;
    }

    // ─── Core Functions ──────────────────────────────────────

    /// @notice 새 게임을 생성한다
    function createGame(
        string calldata question,
        string calldata optionA,
        string calldata optionB,
        uint256 durationSeconds
    ) external payable returns (uint256 gameId) {
        require(msg.value == CREATION_FEE, "Incorrect creation fee");
        require(bytes(question).length > 0, "Question required");
        require(bytes(optionA).length > 0, "Option A required");
        require(bytes(optionB).length > 0, "Option B required");
        require(durationSeconds >= 60 && durationSeconds <= 7 days, "Duration must be 60s-7days");

        gameId = gameCount++;

        Game storage g = games[gameId];
        g.creator = msg.sender;
        g.startTime = block.timestamp;
        g.duration = durationSeconds;
        g.question = question;
        g.optionA = optionA;
        g.optionB = optionB;

        protocolFeeBalance += msg.value;

        emit GameCreated(gameId, msg.sender, block.timestamp, question, optionA, optionB);
    }

    /// @notice 게임에 참여한다 - 선택지는 해시로만 저장 (commit phase)
    /// @param gameId 참여할 게임 ID
    /// @param commitment keccak256(abi.encodePacked(gameId, uint8(choice), salt, msg.sender))
    function commitVote(uint256 gameId, bytes32 commitment) external payable {
        require(msg.value == BET_AMOUNT, "Must bet exactly 0.001 ETH");
        require(commitment != bytes32(0), "Invalid commitment");

        Game storage g = games[gameId];
        require(g.creator != address(0), "Game does not exist");
        require(g.status == GameStatus.Active, "Game not active");
        require(block.timestamp < g.startTime + g.duration, "Game expired");
        require(commitments[gameId][msg.sender] == bytes32(0), "Already committed");

        commitments[gameId][msg.sender] = commitment;
        g.commitCount++;
        g.totalPool += msg.value;

        emit VoteCommitted(gameId, msg.sender, commitment);
    }

    /// @notice 투표 내용을 공개하고 게임을 확정한다 (resolver만 호출 가능)
    /// @dev 모든 커밋을 한번에 reveal해야 함 (일부 누락 불가)
    function revealVotes(
        uint256 gameId,
        address[] calldata players,
        uint8[] calldata choices,
        bytes32[] calldata salts
    ) external onlyAuthorized {
        Game storage g = games[gameId];
        require(g.creator != address(0), "Game does not exist");
        require(g.status == GameStatus.Active, "Game not active");
        require(block.timestamp >= g.startTime + g.duration, "Game not expired yet");
        require(players.length == g.commitCount, "Must reveal all commits");
        require(
            players.length == choices.length && players.length == salts.length,
            "Length mismatch"
        );

        for (uint256 i = 0; i < players.length; i++) {
            address player = players[i];
            uint8 choice = choices[i];
            bytes32 salt = salts[i];

            require(choice == 1 || choice == 2, "Invalid choice");

            bytes32 expected = keccak256(abi.encodePacked(gameId, choice, salt, player));
            require(commitments[gameId][player] == expected, "Invalid commitment");

            Choice c = choice == 1 ? Choice.A : Choice.B;
            playerChoices[gameId][player] = c;

            if (c == Choice.A) g.countA++;
            else g.countB++;

            emit Joined(gameId, player, c);
        }

        _resolveGame(gameId);
    }

    /// @notice resolver가 기한 내 reveal 못 한 경우 개인 환불
    function emergencyRefund(uint256 gameId) external nonReentrant {
        Game storage g = games[gameId];
        require(g.status == GameStatus.Active, "Game not active");
        require(
            block.timestamp >= g.startTime + g.duration + EMERGENCY_REFUND_DELAY,
            "Too early for emergency refund"
        );
        require(commitments[gameId][msg.sender] != bytes32(0), "No commitment found");

        commitments[gameId][msg.sender] = bytes32(0);
        g.commitCount--;
        g.totalPool -= BET_AMOUNT;

        (bool success,) = msg.sender.call{value: BET_AMOUNT}("");
        require(success, "Transfer failed");

        emit EmergencyRefund(gameId, msg.sender, BET_AMOUNT);
    }

    /// @notice 보상을 청구한다
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

        hasClaimed[gameId][msg.sender] = true;

        (bool success,) = msg.sender.call{value: payout}("");
        require(success, "Transfer failed");

        emit Claimed(gameId, msg.sender, payout);
    }

    /// @notice 참여자 없이 만료된 게임을 온체인 종료 (누구나 호출 가능)
    function endEmptyGame(uint256 gameId) external {
        Game storage g = games[gameId];
        require(g.creator != address(0), "Game does not exist");
        require(g.status == GameStatus.Active, "Not active");
        require(block.timestamp >= g.startTime + g.duration, "Not expired");
        require(g.commitCount == 0, "Game has participants");

        g.status = GameStatus.Resolved;
        g.isTie = true;
        emit Resolved(gameId, Choice.None, true);
    }

    /// @notice 게임 생성자 수수료 인출
    function withdrawPendingFees() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "No pending fees");

        pendingWithdrawals[msg.sender] = 0;

        (bool success,) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");

        emit FeesWithdrawn(msg.sender, amount);
    }

    /// @notice 프로토콜 수수료 인출 (owner만)
    function withdrawProtocolFees() external nonReentrant {
        require(msg.sender == owner, "Not owner");
        uint256 amount = protocolFeeBalance;
        require(amount > 0, "No protocol fees");

        protocolFeeBalance = 0;

        (bool success,) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");

        emit FeesWithdrawn(msg.sender, amount);
    }

    // ─── Internal ────────────────────────────────────────────

    function _resolveGame(uint256 gameId) internal {
        Game storage g = games[gameId];
        uint256 totalParticipants = g.countA + g.countB;

        uint256 totalPool = g.totalPool;
        uint256 protocolFee = (totalPool * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
        protocolFeeBalance += protocolFee;

        if (g.countA == 0 || g.countB == 0 || g.countA == g.countB) {
            g.isTie = true;
            g.winningChoice = Choice.None;
            uint256 creatorFee = (totalPool * CREATOR_FEE_BPS) / BPS_DENOMINATOR;
            pendingWithdrawals[g.creator] += creatorFee;
            uint256 refundPool = totalPool - protocolFee - creatorFee;
            g.payoutPerPlayer = refundPool / totalParticipants;
        } else {
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

    // ─── View Functions ──────────────────────────────────────

    function getGame(uint256 gameId) external view returns (Game memory) {
        return games[gameId];
    }

    function getPlayerChoice(uint256 gameId, address player) external view returns (Choice) {
        return playerChoices[gameId][player];
    }

    function getClaimable(uint256 gameId, address player) external view returns (uint256) {
        Game storage g = games[gameId];
        if (g.status != GameStatus.Resolved) return 0;
        if (playerChoices[gameId][player] == Choice.None) return 0;
        if (hasClaimed[gameId][player]) return 0;
        if (!g.isTie && playerChoices[gameId][player] != g.winningChoice) return 0;
        return g.payoutPerPlayer;
    }

    function hasCommitted(uint256 gameId, address player) external view returns (bool) {
        return commitments[gameId][player] != bytes32(0);
    }
}
