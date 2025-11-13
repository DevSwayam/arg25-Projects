# Setup Instructions

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn

## Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
   - Copy `.env.example` to `.env` (if it exists) or create a `.env` file
   - Add your private key:
   ```
   PRIVATE_KEY=your_private_key_here
   ```

## Running the Script

Deploy the BondModule and execute distribution:
```bash
npm run deploy
```

Or directly with Hardhat:
```bash
npx hardhat run index.ts --network baseSepolia
```

## Configuration

The script uses pre-deployed contracts on Base Sepolia testnet. All contract addresses are defined in `index.ts` under `DEPLOYED_ADDRESSES`.

## Output

The script will:
1. Connect to deployed contracts
2. Pre-compute the Nexus account address
3. Mint tokens to the pre-computed address
4. Deploy the account and execute token distribution atomically via Multicall3
5. Update `deployments.json` with the deployment information

## Network

- Network: Base Sepolia (Chain ID: 84532)
- RPC: https://sepolia.base.org (or set custom RPC_URL in .env)

