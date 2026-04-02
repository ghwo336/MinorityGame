# Minority Market

On-chain prediction market where the **minority wins**. Pick the side fewer people choose — pure on-chain consensus, no oracles needed.

---

## Game Logic

### Core Concept

The **minority side wins**. If more people pick A, then B wins. If it's a tie, everyone gets refunded.

### Fee Structure

| Fee | Amount |
|-----|--------|
| Game creation | 0.003 ETH |
| Entry per player | 0.001 ETH |
| Winner share | 90% of pool |
| Creator reward | 9% of pool |
| Protocol fee | 1% of pool |

---

## Commit-Reveal Scheme

투표 내용을 게임 종료 전까지 숨기기 위해 2단계 방식을 사용합니다.

### Why?

투표가 실시간으로 보이면 마지막 투표자가 현황을 보고 전략적으로 소수 편을 고를 수 있습니다. 이를 방지하기 위해 투표 결과는 게임 종료 후에만 공개됩니다.

### Phase 1: Commit (게임 진행 중)

플레이어가 투표할 때:

1. `choice + salt + 서명`을 **백엔드에 먼저 저장** (`confirmedOnChain = false`)
2. 온체인에 commitment 해시만 제출

```
commitment = keccak256(gameId + choice + salt + playerAddress)
```

- `choice`: A(1) 또는 B(2)
- `salt`: 클라이언트가 생성한 랜덤 32바이트 값
- 해시만 온체인에 올라가므로 내용 추측 불가

백엔드를 먼저 저장하는 이유: 온체인 tx 확정 후 백엔드 저장에 실패하면 게임이 영구적으로 stuck 상태가 됩니다. 순서를 뒤집어 이를 방지합니다.

### Pending 투표 정리

백엔드 인덱서가 `VoteCommitted` 이벤트를 감지하면 해당 레코드를 `confirmedOnChain = true`로 변경하고 `commitCount`를 증가시킵니다.

온체인 트랜잭션 없이 **1분이 지난** 미확인 레코드는 자동으로 삭제됩니다. 이를 통해 서명만 하고 tx를 의도적으로 보내지 않는 griefing 공격을 방지합니다.

### Phase 2: Reveal (게임 종료 후)

게임 만료 후 **1분 grace period**가 지나면 백엔드 resolver가 자동으로 `revealVotes()`를 호출합니다. Grace period는 mempool에 대기 중인 트랜잭션이 인덱싱될 시간을 보장합니다.

```
revealVotes(gameId, players[], choices[], salts[])
```

`confirmedOnChain = true`인 커밋만 reveal 대상에 포함됩니다. 컨트랙트가 각 플레이어의 commitment를 검증하고, 소수 편을 계산하여 `Resolved` 이벤트를 emit합니다.

---

## Full Game Flow

```
1. Creator      → createGame(question, optionA, optionB, durationSeconds)
                  비용: 0.003 ETH

2. Player       → POST /api/games/:id/commit      [백엔드 먼저]
                  { choice, salt, signature }
                → commitVote(gameId, commitment)  [온체인]
                  비용: 0.001 ETH

3. 인덱서       → VoteCommitted 이벤트 감지 → confirmedOnChain = true
                  (미확인 레코드는 1분 후 자동 삭제)

4. 게임 만료    → 만료 + 1분 후 Resolver가 자동으로 revealVotes() 호출
                  또는 게임 상세 페이지에서 "Resolve Game" 버튼으로 수동 트리거

5. Resolved     → 소수 편 플레이어들이 claimReward() 호출
                  동점 시 전원 환불 가능
```

---

## Emergency Refund

게임이 만료되고 **3일이 지나도** resolver가 `revealVotes()`를 호출하지 않은 경우, 플레이어가 직접 `emergencyRefund()`를 호출하여 0.001 ETH를 돌려받을 수 있습니다.

```
emergencyRefund 가능 시점 = startTime + duration + 3 days
```

Portfolio 페이지에서 조건이 충족되면 **Emergency Refund** 버튼이 표시됩니다.

---

## Architecture

```
MinorityGame/
├── src/MinorityGame.sol          # Solidity 스마트 컨트랙트
├── script/Deploy.s.sol           # Foundry 배포 스크립트
├── test/MinorityGame.t.sol       # Foundry 테스트
│
├── backend/
│   ├── prisma/schema.prisma      # DB 스키마 (VoteCommit: confirmedOnChain, createdAt)
│   └── src/
│       ├── index.ts              # Express 서버 진입점
│       ├── config.ts             # 환경변수 설정
│       ├── indexer/
│       │   ├── indexer.ts        # 블록 폴링 + Auto-resolver (grace period 포함)
│       │   └── abi.ts            # 컨트랙트 ABI
│       ├── db/
│       │   └── queries.ts        # Prisma DB 쿼리 (cleanupPendingVotes 포함)
│       └── routes/
│           ├── games.ts          # /api/games (POST /:id/resolve 포함)
│           └── players.ts        # /api/players
│
└── frontend/
    ├── components/
    │   ├── VoteUI.tsx            # 투표 UI (백엔드 먼저 저장)
    │   ├── ClaimButton.tsx       # 보상 청구 버튼 (compact 모드 지원)
    │   └── ResolveButton.tsx     # 수동 resolve 버튼
    └── app/
        ├── page.tsx              # Markets 목록
        ├── games/[id]/page.tsx   # 게임 상세 + 투표 + Resolve 버튼
        ├── games/create/page.tsx # 게임 생성
        └── my/page.tsx           # Portfolio
```

---

## Contract Functions

| Function | 설명 | 권한 |
|----------|------|------|
| `createGame(question, optionA, optionB, durationSeconds)` | 게임 생성 (0.003 ETH) | Anyone |
| `commitVote(gameId, commitment)` | 투표 커밋 (0.001 ETH) | Anyone |
| `revealVotes(gameId, players, choices, salts)` | 투표 공개 및 결과 확정 | Resolver / Owner |
| `claimReward(gameId)` | 보상 청구 | Winner |
| `endEmptyGame(gameId)` | 참여자 없는 만료 게임 종료 | Anyone |
| `emergencyRefund(gameId)` | 비상 환불 (만료 +3일 후) | 투표한 플레이어 |
| `withdrawPendingFees()` | 게임 창작자 수수료 인출 | Creator |

---

## API Endpoints

| Method | Endpoint | 설명 |
|--------|----------|------|
| `GET` | `/api/games` | 게임 목록 (`?status=0\|1`, `?limit`, `?offset`) |
| `GET` | `/api/games/:id` | 게임 상세 |
| `POST` | `/api/games/:id/commit` | 투표 데이터 저장 (`{ player, choice, salt, signature }`) |
| `POST` | `/api/games/:id/resolve` | 게임 수동 resolve 트리거 |
| `GET` | `/api/games/:id/players/:address` | 플레이어 상태 조회 |
| `GET` | `/api/players/:address/games` | 플레이어 참여 게임 목록 |

---

## Tech Stack

| Layer | Stack |
|-------|-------|
| Smart Contract | Solidity 0.8.26, Foundry |
| Backend | Node.js, Express, Prisma, viem |
| Frontend | Next.js 16, TypeScript, TailwindCSS, wagmi |
| Database | PostgreSQL |
| Infra | Docker Compose, Nginx |
| Network | Ethereum Sepolia Testnet |

---

## Environment Variables

### backend/.env

```env
DATABASE_URL=postgres://...
RPC_URL=https://...
CONTRACT_ADDRESS=0x...
DEPLOY_BLOCK=...
RESOLVER_PRIVATE_KEY=0x...
PORT=8090
```

### docker-compose.yml build args (frontend)

```
NEXT_PUBLIC_API_URL=https://.../api
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...
```

---

## Local Dev

```bash
# 전체 실행
docker compose up -d

# 재빌드 후 실행
docker compose build --no-cache && docker compose up -d

# 컨트랙트 배포
source .env
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast

# 테스트
forge test -vvv
```

---

## Deployed Contract

- **Network**: Ethereum Sepolia
- **Address**: `0xcc85532687565f7bd7b33bc500eea2efa0d21bcf`
