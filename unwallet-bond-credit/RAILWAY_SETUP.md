# Railway Deployment Setup

## Important: Set Root Directory

Since your project is in the `unwallet-bond-credit/` subdirectory, you need to configure Railway:

1. Go to your Railway project dashboard
2. Click on your service
3. Go to **Settings** tab
4. Scroll to **Root Directory** section
5. Set it to: `unwallet-bond-credit`
6. Save and redeploy

## Build & Start Commands

Railway will automatically detect Node.js and use:
- **Build**: `npm run build` (runs `npm install && npm run compile`)
- **Start**: `npm start` (runs `ts-node --require dotenv/config poll-server.ts`)

## Environment Variables

Make sure to set these in Railway:
- `PRIVATE_KEY` - Your private key for signing attestations
- `BASE_SEPOLIA_RPC` (optional) - Custom RPC URL
- `ARBITRUM_SEPOLIA_RPC` (optional) - Custom RPC URL

