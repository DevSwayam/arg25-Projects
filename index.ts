import 'dotenv/config';
import { createWalletClient, createPublicClient, http, encodeAbiParameters, encodePacked, keccak256, toHex, Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia, arbitrumSepolia } from 'viem/chains';

// Network configurations
const BONDMODULE_ADDRESSES = {
  [baseSepolia.id]: '0xD68229d1E47Ad39156766D71cDe1787B64905Dc5' as const,
  [arbitrumSepolia.id]: '0x2E56ca0a3212e1Ebef0D7E33d7c33Be55b50259D' as const, // Arbitrum Sepolia BondModule address
} as const;

const RPC_URLS = {
  [baseSepolia.id]: process.env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org',
  [arbitrumSepolia.id]: process.env.ARBITRUM_SEPOLIA_RPC || 'https://sepolia-rollup.arbitrum.io/rpc',
} as const;

// Escrow vault addresses (30-30-40 distribution)
const ESCROW_VAULTS = {
  [baseSepolia.id]: {
    ZyFAI: '0xF5ba82b7BcA78F448ce503f435b5b03E7C441bD4' as const,
    Giza: '0x4b95b230A306164ab48Ae049bed1E55CF8Ad1E51' as const,
    Cod3x: '0x490e29991dE706d3FF9EE72029973BDB389f18C4' as const,
  },
  [arbitrumSepolia.id]: {
    ZyFAI: '0x1E5cDef4091Ff7f8c6ea6D394dA48bb3a0BeAA60' as const,
    Giza: '0x9B68Fb33Fbb714BF2853D170003328fD3454eEc1' as const,
    Cod3x: '0x218975b5557b903C6960E4298073B0472Fd24b5D' as const,
  },
} as const;

const ALLOCATION_ZYFAI = 3000; // 30%
const ALLOCATION_GIZA = 3000; // 30%
const ALLOCATION_COD3X = 4000; // 40%
const TOTAL_PERCENTAGE = 10000;

// Polling interval in milliseconds
const POLL_INTERVAL = 400; // 5 seconds

// Number of blocks to look back when starting (to catch recent events)
const LOOKBACK_BLOCKS = 1000; // Look back 1000 blocks on startup (increased to catch missed events)

// Full BondModule ABI
const BONDMODULE_ABI = [
  {
    inputs: [
      { internalType: 'address', name: '_bondModuleTeeServer', type: 'address' },
      { internalType: 'address', name: '_owner', type: 'address' },
    ],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    inputs: [],
    name: 'AgentModeNotActivated',
    type: 'error',
  },
  {
    inputs: [],
    name: 'ArrayLengthMismatch',
    type: 'error',
  },
  {
    inputs: [],
    name: 'AttestationAlreadyUsed',
    type: 'error',
  },
  {
    inputs: [],
    name: 'ECDSAInvalidSignature',
    type: 'error',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'length', type: 'uint256' }],
    name: 'ECDSAInvalidSignatureLength',
    type: 'error',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 's', type: 'bytes32' }],
    name: 'ECDSAInvalidSignatureS',
    type: 'error',
  },
  {
    inputs: [],
    name: 'ExceededAllowedPercentage',
    type: 'error',
  },
  {
    inputs: [],
    name: 'ExecutionFailed',
    type: 'error',
  },
  {
    inputs: [],
    name: 'InsufficientAllowance',
    type: 'error',
  },
  {
    inputs: [],
    name: 'InvalidAmount',
    type: 'error',
  },
  {
    inputs: [],
    name: 'InvalidAttestation',
    type: 'error',
  },
  {
    inputs: [],
    name: 'InvalidPercentage',
    type: 'error',
  },
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'ModuleAlreadyInitialized',
    type: 'error',
  },
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'ModuleNotInitialized',
    type: 'error',
  },
  {
    inputs: [{ internalType: 'address', name: 'tee', type: 'address' }],
    name: 'NotAuthorized',
    type: 'error',
  },
  {
    inputs: [{ internalType: 'address', name: 'owner', type: 'address' }],
    name: 'OwnableInvalidOwner',
    type: 'error',
  },
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'OwnableUnauthorizedAccount',
    type: 'error',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'account', type: 'address' },
      { indexed: false, internalType: 'address[]', name: 'tokenAddresses', type: 'address[]' },
      { indexed: false, internalType: 'uint256[]', name: 'totalAmounts', type: 'uint256[]' },
      { indexed: false, internalType: 'uint256', name: 'nonce', type: 'uint256' },
      { indexed: false, internalType: 'address', name: 'activatedBy', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'timestamp', type: 'uint256' },
    ],
    name: 'AgentModeActivated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'account', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'timestamp', type: 'uint256' },
    ],
    name: 'AgentModeDisabled',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'account', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'timestamp', type: 'uint256' },
    ],
    name: 'AgentModeEnabled',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'account', type: 'address' },
      { indexed: true, internalType: 'address', name: 'token', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'amount', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'percentageBps', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'balanceBefore', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'balanceAfter', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'nonce', type: 'uint256' },
      { indexed: false, internalType: 'bytes32', name: 'attestationHash', type: 'bytes32' },
      { indexed: false, internalType: 'uint256', name: 'timestamp', type: 'uint256' },
    ],
    name: 'FundsExecuted',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'account', type: 'address' },
      { indexed: false, internalType: 'address[]', name: 'tokenAddresses', type: 'address[]' },
      { indexed: false, internalType: 'uint256[]', name: 'allowances', type: 'uint256[]' },
      { indexed: false, internalType: 'uint256', name: 'timestamp', type: 'uint256' },
    ],
    name: 'ModuleInitialized',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'account', type: 'address' },
      { indexed: false, internalType: 'address[]', name: 'tokenAddresses', type: 'address[]' },
      { indexed: false, internalType: 'uint256', name: 'timestamp', type: 'uint256' },
    ],
    name: 'ModuleUninitialized',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'previousOwner', type: 'address' },
      { indexed: true, internalType: 'address', name: 'newOwner', type: 'address' },
    ],
    name: 'OwnershipTransferred',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'account', type: 'address' },
      { indexed: false, internalType: 'address[]', name: 'tokenAddresses', type: 'address[]' },
      { indexed: false, internalType: 'uint256[]', name: 'previousAllowances', type: 'uint256[]' },
      { indexed: false, internalType: 'uint256', name: 'timestamp', type: 'uint256' },
    ],
    name: 'TokenAllowancesCleared',
    type: 'event',
  },
  {
    inputs: [],
    name: 'MODULE_TYPE_EXECUTOR',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'nexusAccount', type: 'address' },
      { internalType: 'address[]', name: 'tokenAddresses', type: 'address[]' },
      { internalType: 'uint256[]', name: 'totalAmounts', type: 'uint256[]' },
      { internalType: 'uint256', name: 'nonce', type: 'uint256' },
      { internalType: 'bytes', name: 'bondModuleTeeSignature', type: 'bytes' },
    ],
    name: 'activateAgentMode',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: '', type: 'address' }],
    name: 'agentModeActivated',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'bondModuleTeeServer',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address[]', name: 'tokenAddresses', type: 'address[]' }],
    name: 'clearTokenAllowances',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'disableAgentMode',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'enableAgentMode',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'nexusAccount', type: 'address' },
      { internalType: 'bytes', name: 'executionBatch', type: 'bytes' },
      { internalType: 'address', name: 'token', type: 'address' },
      { internalType: 'uint256', name: 'allowedPercentageBps', type: 'uint256' },
      { internalType: 'uint256', name: 'nonce', type: 'uint256' },
      { internalType: 'bytes', name: 'bondModuleTeeSignature', type: 'bytes' },
    ],
    name: 'executeBatchWithAttestation',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getConfigInputTypeData',
    outputs: [{ internalType: 'string', name: 'configInputTypeData', type: 'string' }],
    stateMutability: 'pure',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'account', type: 'address' },
      { internalType: 'address', name: 'token', type: 'address' },
    ],
    name: 'getTokenAllowance',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: '', type: 'address' }],
    name: 'initializedAccounts',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'isAgentModeActivated',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'attestationHash', type: 'bytes32' }],
    name: 'isAttestationUsed',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'smartAccount', type: 'address' }],
    name: 'isInitialized',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'moduleTypeId', type: 'uint256' }],
    name: 'isModuleType',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'pure',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes', name: 'data', type: 'bytes' }],
    name: 'onInstall',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes', name: 'data', type: 'bytes' }],
    name: 'onUninstall',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'owner',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'renounceOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: '', type: 'address' },
      { internalType: 'address', name: '', type: 'address' },
    ],
    name: 'tokenAllowances',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'newOwner', type: 'address' }],
    name: 'transferOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
    name: 'usedAttestations',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// ERC20 ABI for approve (from index.ts)
const ERC20_ABI = [
  {
    type: 'function',
    name: 'mint',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
] as const;

interface ProcessedEvent {
  chainId: number;
  blockNumber: bigint;
  transactionHash: Hex;
  account: Hex;
  tokenAddresses: Hex[];
  totalAmounts: bigint[];
  nonce: bigint;
  activatedBy: Hex;
  timestamp: bigint;
}

// Track processed events to avoid duplicates
const processedEvents = new Set<string>();

function getEventKey(event: ProcessedEvent): string {
  return `${event.chainId}-${event.transactionHash}-${event.account}-${event.nonce}`;
}

async function createExecutionBatch(
  tokenAddress: Hex,
  amount: bigint,
  chainId: number,
  recipientAddress?: Hex
): Promise<Hex> {
  // Create execution batch with 3 approve operations (30-30-40 distribution to vaults)
  const approveSelector = keccak256(toHex('approve(address,uint256)')).slice(0, 10) as Hex;
  
  const vaults = ESCROW_VAULTS[chainId as keyof typeof ESCROW_VAULTS];
  
  // Calculate distribution amounts (30-30-40)
  const amountZyFAI = (amount * BigInt(ALLOCATION_ZYFAI)) / BigInt(TOTAL_PERCENTAGE);
  const amountGiza = (amount * BigInt(ALLOCATION_GIZA)) / BigInt(TOTAL_PERCENTAGE);
  const amountCod3x = (amount * BigInt(ALLOCATION_COD3X)) / BigInt(TOTAL_PERCENTAGE);
  
  console.log(`  Distribution: ZyFAI=${amountZyFAI.toString()}, Giza=${amountGiza.toString()}, Cod3x=${amountCod3x.toString()}`);
  
  // Create 3 approve operations
  const executions = [
    {
      target: tokenAddress,
      value: 0n,
      callData: (approveSelector + 
        encodeAbiParameters(
          [{ type: 'address' }, { type: 'uint256' }],
          [vaults.ZyFAI, amountZyFAI]
        ).slice(2)
      ) as Hex,
    },
    {
      target: tokenAddress,
      value: 0n,
      callData: (approveSelector + 
        encodeAbiParameters(
          [{ type: 'address' }, { type: 'uint256' }],
          [vaults.Giza, amountGiza]
        ).slice(2)
      ) as Hex,
    },
    {
      target: tokenAddress,
      value: 0n,
      callData: (approveSelector + 
        encodeAbiParameters(
          [{ type: 'address' }, { type: 'uint256' }],
          [vaults.Cod3x, amountCod3x]
        ).slice(2)
      ) as Hex,
    },
  ];

  return encodeAbiParameters(
    [
      {
        type: 'tuple[]',
        components: [
          { type: 'address', name: 'target' },
          { type: 'uint256', name: 'value' },
          { type: 'bytes', name: 'callData' },
        ],
      },
    ],
    [executions]
  );
}

async function executeBatchWithAttestation(
  publicClient: any,
  walletClient: any,
  chainId: number,
  event: ProcessedEvent,
  tokenIndex: number
) {
  try {
    const accountAddress = event.account;
    const tokenAddress = event.tokenAddresses[tokenIndex];
    const totalAmount = event.totalAmounts[tokenIndex];
    const nonce = event.nonce;

    console.log(`\n[${chainId}] Processing execution for:`);
    console.log(`  Account: ${accountAddress}`);
    console.log(`  Token: ${tokenAddress}`);
    console.log(`  Amount: ${totalAmount.toString()}`);
    console.log(`  Nonce: ${nonce.toString()}`);

    // Create execution batch
    // Note: You may want to customize this based on your requirements
    // For now, creating a simple approve operation
    // You can modify createExecutionBatch function to include more operations like transfers, deposits, etc.
    const executionBatch = await createExecutionBatch(tokenAddress, totalAmount, chainId);

    // Calculate allowed percentage (100% = 10000 bps)
    const allowedPercentageBps = 10000n;

    // Create attestation hash
    const attestationHash = keccak256(
      encodePacked(
        ['uint256', 'address', 'address', 'uint256', 'uint256', 'bytes'],
        [
          BigInt(chainId),
          accountAddress,
          tokenAddress,
          allowedPercentageBps,
          nonce,
          executionBatch,
        ]
      )
    );

    // Sign attestation with private key
    const signature = await walletClient.signMessage({
      message: { raw: attestationHash },
    });

    console.log(`  Attestation hash: ${attestationHash}`);
    console.log(`  Signature: ${signature}`);

    // Execute batch with attestation
    const bondModuleAddress = BONDMODULE_ADDRESSES[chainId as keyof typeof BONDMODULE_ADDRESSES];
    
    console.log(`  Calling executeBatchWithAttestation on ${bondModuleAddress}...`);

    const hash = await walletClient.writeContract({
      address: bondModuleAddress,
      abi: BONDMODULE_ABI,
      functionName: 'executeBatchWithAttestation',
      args: [
        accountAddress,
        executionBatch,
        tokenAddress,
        allowedPercentageBps,
        nonce,
        signature,
      ],
    });

    console.log(`  Transaction hash: ${hash}`);
    console.log(`  Waiting for confirmation...`);

    const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 2 });

    if (receipt.status === 'success') {
      console.log(`  ✓ Execution successful!`);
      console.log(`  Gas used: ${receipt.gasUsed.toString()}`);
    } else {
      console.error(`  ✗ Execution failed!`);
    }

    return receipt;
  } catch (error: any) {
    console.error(`  ✗ Error executing batch:`, error.message);
    throw error;
  }
}

async function pollEvents(chainId: number) {
  const chain = chainId === baseSepolia.id ? baseSepolia : arbitrumSepolia;
  const rpcUrl = RPC_URLS[chainId as keyof typeof RPC_URLS];
  const bondModuleAddress = BONDMODULE_ADDRESSES[chainId as keyof typeof BONDMODULE_ADDRESSES];

  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY environment variable not set');
  }

  const account = privateKeyToAccount(privateKey as Hex);
  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(rpcUrl),
  });

  console.log(`\n[${chainId}] Starting to poll for AgentModeActivated events...`);
  console.log(`  Network: ${chain.name}`);
  console.log(`  BondModule: ${bondModuleAddress}`);
  console.log(`  RPC: ${rpcUrl}`);
  console.log(`  Signer: ${account.address}`);

  // Get current block and look back on startup
  const currentBlock = await publicClient.getBlockNumber();
  let fromBlock = currentBlock - BigInt(LOOKBACK_BLOCKS);
  if (fromBlock < 0n) fromBlock = 0n;
  
  console.log(`  Starting from block: ${fromBlock} (looking back ${LOOKBACK_BLOCKS} blocks)`);
  console.log(`  Current block: ${currentBlock}`);

  while (true) {
    try {
      // Get current block number
      const currentBlock = await publicClient.getBlockNumber();
      
      // Only query if there are new blocks
      if (fromBlock <= currentBlock) {
        console.log(`[${chainId}] Polling blocks ${fromBlock} to ${currentBlock}...`);

        // Poll for events using the full ABI - find AgentModeActivated event
        const agentModeActivatedEvent = BONDMODULE_ABI.find(
          (item: any) => item.type === 'event' && item.name === 'AgentModeActivated'
        ) as any;
        
        if (!agentModeActivatedEvent) {
          throw new Error('AgentModeActivated event not found in ABI');
        }

        const events = await publicClient.getLogs({
          address: bondModuleAddress,
          event: agentModeActivatedEvent,
          fromBlock: fromBlock,
          toBlock: currentBlock,
        });

        console.log(`[${chainId}] Query returned ${events.length} event(s)`);

        if (events.length > 0) {
          console.log(`\n[${chainId}] Found ${events.length} new event(s)`);

          for (const eventLog of events) {
            // Type assertion for event args
            const eventArgs = (eventLog as any).args;
            
            if (!eventArgs) {
              console.error(`[${chainId}] Event log missing args:`, eventLog);
              continue;
            }

            console.log(`[${chainId}] Processing event log:`, {
              blockNumber: eventLog.blockNumber,
              transactionHash: eventLog.transactionHash,
              args: eventArgs,
            });

            const event: ProcessedEvent = {
              chainId,
              blockNumber: eventLog.blockNumber,
              transactionHash: eventLog.transactionHash,
              account: eventArgs.account as Hex,
              tokenAddresses: (eventArgs.tokenAddresses || []) as Hex[],
              totalAmounts: (eventArgs.totalAmounts || []).map((a: any) => BigInt(a.toString())),
              nonce: BigInt(eventArgs.nonce?.toString() || '0'),
              activatedBy: eventArgs.activatedBy as Hex,
              timestamp: BigInt(eventArgs.timestamp?.toString() || '0'),
            };

            const eventKey = getEventKey(event);
            
            if (processedEvents.has(eventKey)) {
              console.log(`  Skipping already processed event: ${eventKey}`);
              continue;
            }

            processedEvents.add(eventKey);

            console.log(`\n[${chainId}] New AgentModeActivated event detected:`);
            console.log(`  Block: ${event.blockNumber}`);
            console.log(`  TX: ${event.transactionHash}`);
            console.log(`  Account: ${event.account}`);
            console.log(`  Activated by: ${event.activatedBy}`);
            console.log(`  Timestamp: ${event.timestamp}`);
            console.log(`  Tokens: ${event.tokenAddresses.length}`);

            // Process each token in the event
            for (let i = 0; i < event.tokenAddresses.length; i++) {
              try {
                await executeBatchWithAttestation(
                  publicClient,
                  walletClient,
                  chainId,
                  event,
                  i
                );
                // Add delay between executions
                await new Promise(resolve => setTimeout(resolve, 2000));
              } catch (error: any) {
                console.error(`  Failed to execute batch for token ${i}:`, error.message);
                // Continue with next token even if one fails
              }
            }
          }
        } else {
          console.log(`[${chainId}] No new events in blocks ${fromBlock} to ${currentBlock}`);
        }

        // Update fromBlock for next iteration
        fromBlock = currentBlock + 1n;
      } else {
        // No new blocks yet
        console.log(`[${chainId}] No new blocks yet (current: ${currentBlock}, from: ${fromBlock})`);
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    } catch (error: any) {
      console.error(`[${chainId}] Error polling events:`, error);
      console.error(`[${chainId}] Error details:`, {
        message: error.message,
        stack: error.stack,
        cause: error.cause,
      });
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    }
  }
}

async function main() {
  console.log('=== BondModule Event Polling Server ===\n');
  console.log('Starting polling servers for:');
  console.log(`  - Base Sepolia (Chain ID: ${baseSepolia.id})`);
  console.log(`  - Arbitrum Sepolia (Chain ID: ${arbitrumSepolia.id})`);
  console.log(`\nPolling interval: ${POLL_INTERVAL}ms\n`);

  // Start polling for both networks in parallel
  const promises = [
    pollEvents(baseSepolia.id).catch(err => {
      console.error(`[${baseSepolia.id}] Fatal error:`, err);
    }),
    pollEvents(arbitrumSepolia.id).catch(err => {
      console.error(`[${arbitrumSepolia.id}] Fatal error:`, err);
    }),
  ];

  // Wait for both (they run indefinitely)
  await Promise.all(promises);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nShutting down polling server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\nShutting down polling server...');
  process.exit(0);
});

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

