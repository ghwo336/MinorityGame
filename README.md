# MAJORITY ARENA - On-Chain Betting Game

## Project Overview

MAJORITY ARENA is an on-chain consensus game where players bet on A or B, and the majority side wins the prize pool. No oracles needed - results are determined purely by on-chain vote counts.

### How It Works

1. Anyone creates a game by paying 0.01 ETH creation fee
2. Players join by choosing A or B and betting 0.001 ETH
3. After 24 hours, anyone can resolve the game
4. The majority side wins: 90% of pool split equally among winners
5. Creator gets 9%, protocol gets 1%
6. On tie: all participants get refunded (minus protocol fee)

## Tech Stack

- **Smart Contract**: Solidity 0.8.26 (Foundry)
- **Frontend**: Next.js 16 + TypeScript + TailwindCSS
- **Wallet**: wagmi + RainbowKit
- **Network**: Sepolia Testnet

## Deployed Contract

- **Sepolia**: `TBD` (deploy pending)

## Project Structure

```
week-06/dev/
├── src/MajorityGame.sol       # Core smart contract
├── test/MajorityGame.t.sol    # Foundry tests (12 tests)
├── script/Deploy.s.sol        # Deployment script
├── frontend/                  # Next.js frontend
│   ├── app/                   # Pages (Home, Create, Detail, My)
│   ├── components/            # UI components
│   ├── config/                # wagmi + contract config
│   └── hooks/                 # Custom contract hooks
└── foundry.toml               # Local Foundry config
```

## Setup & Run

### Smart Contract

```bash
# Run tests (from week-06/dev/)
forge test -vvv

# Deploy to Sepolia
forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast --verify
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Set environment variables
cp .env.local.example .env.local
# Edit .env.local with your WalletConnect project ID and contract address

# Run dev server
npm run dev
```

## Contract Features

- `createGame()` - Create new A vs B game (0.01 ETH fee)
- `joinGame(gameId, choice)` - Join game with 0.001 ETH bet
- `resolveGame(gameId)` - Resolve after 24h, determine majority winner
- `claimReward(gameId)` - Winners claim their share
- `withdrawPendingFees()` - Creators withdraw earned fees

### Security

- Custom ReentrancyGuard
- CEI (Checks-Effects-Interactions) pattern
- Pull-based reward distribution
- ETH transfers via `call`
