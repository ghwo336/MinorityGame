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

플레이어가 투표할 때 실제 선택지를 숨긴 해시값만 온체인에 저장합니다.

```
commitment = keccak256(gameId + choice + salt + playerAddress)
```

- `choice`: A(1) 또는 B(2)
- `salt`: 클라이언트가 생성한 랜덤 32바이트 값
- 해시만 온체인에 올라가므로 내용 추측 불가

동시에 실제 `choice + salt + 서명`을 백엔드 서버에 전송합니다.

### Phase 2: Reveal (게임 종료 후)

게임 기간이 만료되면 백엔드의 resolver가 자동으로 `revealVotes()`를 호출합니다.

```
revealVotes(gameId, players[], choices[], salts[])
```

컨트랙트가 각 플레이어의 `keccak256(gameId + choice + salt + address)`를 재계산하여 Phase 1의 해시와 일치하면 유효한 투표로 인정합니다. 모든 투표가 검증되면 소수 편을 계산하고 `Resolved` 이벤트를 emit합니다.

---

## Full Game Flow

```
1. Creator      → createGame(question, optionA, optionB, durationSeconds)
                  비용: 0.003 ETH

2. Player       → commitVote(gameId, commitment)  [온체인]
                  비용: 0.001 ETH
                → POST /api/games/:id/commit      [오프체인]
                  { choice, salt, signature }

3. 게임 만료     → Resolver가 자동으로 revealVotes() 호출
                  (백엔드 인덱서가 12초마다 폴링)

4. Resolved     → 소수 편 플레이어들이 claimReward() 호출
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
│   └── src/
│       ├── index.ts              # Express 서버 진입점
│       ├── config.ts             # 환경변수 설정
│       ├── indexer/
│       │   ├── indexer.ts        # 블록 폴링 + Auto-resolver
│       │   └── abi.ts            # 컨트랙트 ABI
│       ├── db/
│       │   └── queries.ts        # Prisma DB 쿼리
│       └── routes/
│           ├── games.ts          # /api/games
│           └── players.ts        # /api/players
│
└── frontend/
    └── app/
        ├── page.tsx              # Markets 목록
        ├── games/[id]/page.tsx   # 게임 상세 + 투표
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
