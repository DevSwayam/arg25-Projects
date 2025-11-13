import { createWalletClient, createPublicClient, http, parseEther, encodeAbiParameters, encodePacked, keccak256, toHex, Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

/**
 * BondModule Deployment with Viem
 *
 * This script replicates the ethers deployBondModule.ts script using viem.
 * It demonstrates atomic account deployment + fund distribution.
 *
 * Run: PRIVATE_KEY=your_key npx tsx scripts/viem/deployBondModule.ts
 */

// Deployed contract addresses
const DEPLOYED_ADDRESSES = {
  K1Validator: '0xaCEeEa78b9E1ACc06F5B6Cc527a3FE71A722CedB' as const,
  MockRegistry: '0x6feaFAbB6ba2a46A62eBb8A39354C73A6e1c283e' as const,
  NexusBootstrap: '0x7B5DED478B61C7Cb54F980A4FFcbEf4CC03B65Ef' as const,
  NexusImplementation: '0x2BF411df5165A1F41D9a5a78b5Fc1Cf1ce83C2E6' as const,
  NexusAccountFactory: '0x123221fd520687f78e556c0F594aaA7030e09F6C' as const,
  BiconomyMetaFactory: '0x74e32771e3dc456D18797df513A1181e166940C2' as const,
  BondModule: '0x29195B26D9C4253C7e956e8ac4556697F7718C6D' as const,
  MockToken: '0x0B1Cddc846C5b1aC1293F943aFd8F642418D6f48' as const,
  EscrowZyFAI: '0x87aadB3aC964d1E50Be5025f08f4AF876DA81d10' as const,
  EscrowGiza: '0x4ad7da42761456f701d44322D25165629F5d795B' as const,
  EscrowCod3x: '0xA15bD240D25721687A90e70C193a7d42e8C5FF6c' as const,
};

const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11' as const;
const INITIAL_TOKEN_BALANCE = 10_000_000_000n;
const ALLOWANCE_CAP = 10_000_000_000n;

const ALLOCATION_ZYFAI = 3000; // 30%
const ALLOCATION_GIZA = 3000; // 30%
const ALLOCATION_COD3X = 4000; // 40%
const TOTAL_PERCENTAGE = 10000;

// === ABIs ===

const mockTokenAbi = [
  {
    type: 'function',
    name: 'mint',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable'
  }
] as const;

const nexusAccountFactoryAbi = [
  {
    type: 'function',
    name: 'computeAccountAddress',
    inputs: [
      { name: 'initData', type: 'bytes' },
      { name: 'salt', type: 'bytes32' }
    ],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'createAccount',
    inputs: [
      { name: 'initData', type: 'bytes' },
      { name: 'salt', type: 'bytes32' }
    ],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'payable'
  }
] as const;

const nexusBootstrapAbi = [
  {
    type: 'function',
    name: 'initNexusWithDefaultValidatorAndOtherModules',
    inputs: [
      { name: 'defaultValidatorInitData', type: 'bytes' },
      {
        name: 'validators',
        type: 'tuple[]',
        components: [
          { name: 'module', type: 'address' },
          { name: 'data', type: 'bytes' }
        ]
      },
      {
        name: 'executors',
        type: 'tuple[]',
        components: [
          { name: 'module', type: 'address' },
          { name: 'data', type: 'bytes' }
        ]
      },
      {
        name: 'hook',
        type: 'tuple',
        components: [
          { name: 'module', type: 'address' },
          { name: 'data', type: 'bytes' }
        ]
      },
      {
        name: 'fallbacks',
        type: 'tuple[]',
        components: [
          { name: 'module', type: 'address' },
          { name: 'data', type: 'bytes' }
        ]
      },
      {
        name: 'preValidationHooks',
        type: 'tuple[]',
        components: [
          { name: 'hookType', type: 'uint256' },
          { name: 'module', type: 'address' },
          { name: 'data', type: 'bytes' }
        ]
      },
      {
        name: 'registryConfig',
        type: 'tuple',
        components: [
          { name: 'registry', type: 'address' },
          { name: 'attesters', type: 'address[]' },
          { name: 'threshold', type: 'uint8' }
        ]
      }
    ],
    outputs: [],
    stateMutability: 'payable'
  }
] as const;

const biconomyMetaFactoryAbi = [
  {
    type: 'function',
    name: 'deployWithFactory',
    inputs: [
      { name: 'factory', type: 'address' },
      { name: 'factoryData', type: 'bytes' }
    ],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'payable'
  }
] as const;

const bondModuleAbi = [
  {
    type: 'function',
    name: 'executeBatchWithAttestation',
    inputs: [
      { name: 'nexusAccount', type: 'address' },
      { name: 'executionBatch', type: 'bytes' },
      { name: 'token', type: 'address' },
      { name: 'allowedPercentageBps', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'attestationSignature', type: 'bytes' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  }
] as const;

const multicall3Abi = [
  {
    type: 'function',
    name: 'aggregate3',
    inputs: [
      {
        name: 'calls',
        type: 'tuple[]',
        components: [
          { name: 'target', type: 'address' },
          { name: 'allowFailure', type: 'bool' },
          { name: 'callData', type: 'bytes' }
        ]
      }
    ],
    outputs: [
      {
        name: 'returnData',
        type: 'tuple[]',
        components: [
          { name: 'success', type: 'bool' },
          { name: 'returnData', type: 'bytes' }
        ]
      }
    ],
    stateMutability: 'payable'
  }
] as const;

const escrowVaultAbi = [
  {
    type: 'function',
    name: 'deposit',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable'
  }
] as const;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('\n=== BONDMODULE ATOMIC DEPLOYMENT + DISTRIBUTION (VIEM) ===');

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY environment variable not set');
  }

  const account = privateKeyToAccount(privateKey as Hex);
  const owner = account.address;

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http()
  });

  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http()
  });

  console.log('Deployer:', owner);
  console.log('Chain ID:', baseSepolia.id);

  // Step 1: Pre-compute account address
  const { accountAddress, initData, salt } = await preComputeAccountAddress(publicClient, owner);

  // Step 2: Check if account already deployed
  console.log('\n[Step 2] Checking if account already deployed...');
  const existingCode = await publicClient.getCode({ address: accountAddress });
  if (existingCode && existingCode !== '0x') {
    console.log('⚠️  Account already deployed at:', accountAddress);
    console.log('Skipping deployment. Use a different salt for a new account.');
    return;
  }
  console.log('✓ Account not yet deployed, proceeding...');

  // Step 3: Mint tokens
  await mintTokensToAccount(publicClient, walletClient, accountAddress);

  // Step 4: Deploy and execute distribution
  await deployAccountAndExecuteDistribution(publicClient, walletClient, accountAddress, initData, salt, owner);

  console.log('\n=== ATOMIC DEPLOYMENT COMPLETE ===');
}

async function preComputeAccountAddress(publicClient: any, owner: Hex) {
  console.log('\n[Step 1] Pre-computing account address...');

  // Encode BondModule installation data
  const executorInstallData = encodeAbiParameters(
    [{ type: 'address[]' }, { type: 'uint256[]' }],
    [[DEPLOYED_ADDRESSES.MockToken], [ALLOWANCE_CAP]]
  );

  const executors = [
    {
      module: DEPLOYED_ADDRESSES.BondModule,
      data: executorInstallData
    }
  ];

  const registryConfig = {
    registry: DEPLOYED_ADDRESSES.MockRegistry,
    attesters: [owner],
    threshold: 1
  };

  // CRITICAL: Encode the bootstrap initialization call
  const initCall = encodeAbiParameters(
    [
      { type: 'bytes', name: 'defaultValidatorInitData' },
      {
        type: 'tuple[]',
        name: 'validators',
        components: [
          { type: 'address', name: 'module' },
          { type: 'bytes', name: 'data' }
        ]
      },
      {
        type: 'tuple[]',
        name: 'executors',
        components: [
          { type: 'address', name: 'module' },
          { type: 'bytes', name: 'data' }
        ]
      },
      {
        type: 'tuple',
        name: 'hook',
        components: [
          { type: 'address', name: 'module' },
          { type: 'bytes', name: 'data' }
        ]
      },
      {
        type: 'tuple[]',
        name: 'fallbacks',
        components: [
          { type: 'address', name: 'module' },
          { type: 'bytes', name: 'data' }
        ]
      },
      {
        type: 'tuple[]',
        name: 'preValidationHooks',
        components: [
          { type: 'uint256', name: 'hookType' },
          { type: 'address', name: 'module' },
          { type: 'bytes', name: 'data' }
        ]
      },
      {
        type: 'tuple',
        name: 'registryConfig',
        components: [
          { type: 'address', name: 'registry' },
          { type: 'address[]', name: 'attesters' },
          { type: 'uint8', name: 'threshold' }
        ]
      }
    ],
    [
      owner as Hex, // defaultValidatorInitData (owner address as bytes)
      [], // validators
      executors, // executors
      { module: '0x0000000000000000000000000000000000000000' as Hex, data: '0x' as Hex }, // hook
      [], // fallbacks
      [], // preValidationHooks
      registryConfig
    ]
  );

  // Get function selector for initNexusWithDefaultValidatorAndOtherModules
  const functionSelector = keccak256(
    toHex('initNexusWithDefaultValidatorAndOtherModules(bytes,(address,bytes)[],(address,bytes)[],(address,bytes),(address,bytes)[],(uint256,address,bytes)[],(address,address[],uint8))')
  ).slice(0, 10) as Hex;

  const encodedInitCall = (functionSelector + initCall.slice(2)) as Hex;

  // CRITICAL: Encode as (address, bytes) tuple for NexusAccountFactory
  const initData = encodeAbiParameters(
    [{ type: 'address' }, { type: 'bytes' }],
    [DEPLOYED_ADDRESSES.NexusBootstrap, encodedInitCall]
  );

  // Generate unique salt
  const timestamp = Math.floor(Date.now() / 1000);
  const salt = keccak256(toHex(`nexus-bondmodule-viem-${timestamp}`));

  // Compute account address
  const accountAddress = await publicClient.readContract({
    address: DEPLOYED_ADDRESSES.NexusAccountFactory,
    abi: nexusAccountFactoryAbi,
    functionName: 'computeAccountAddress',
    args: [initData, salt]
  }) as Hex;

  console.log('Pre-computed Account Address:', accountAddress);
  console.log('Salt:', salt);

  return { accountAddress, initData, salt };
}

async function mintTokensToAccount(publicClient: any, walletClient: any, accountAddress: Hex) {
  console.log('\n[Step 3] Minting tokens to pre-computed address...');
  console.log('Target address:', accountAddress);

  const hash = await walletClient.writeContract({
    address: DEPLOYED_ADDRESSES.MockToken,
    abi: mockTokenAbi,
    functionName: 'mint',
    args: [accountAddress, INITIAL_TOKEN_BALANCE]
  });

  console.log('Mint transaction hash:', hash);
  console.log('Waiting for confirmation...');

  await publicClient.waitForTransactionReceipt({ hash, confirmations: 2 });
  await sleep(3000);

  // Retry balance check
  let balance = 0n;
  for (let i = 0; i < 10; i++) {
    balance = await publicClient.readContract({
      address: DEPLOYED_ADDRESSES.MockToken,
      abi: mockTokenAbi,
      functionName: 'balanceOf',
      args: [accountAddress]
    }) as bigint;

    if (balance > 0n) break;
    console.log(`Balance check ${i + 1}/10: waiting for state propagation...`);
    await sleep(2000);
  }

  console.log('✓ Minted', INITIAL_TOKEN_BALANCE.toString(), 'tokens');
  console.log('Pre-computed address token balance:', balance.toString());

  if (balance === 0n) {
    throw new Error('Balance still 0 after retries - state propagation issue');
  }
}

async function deployAccountAndExecuteDistribution(
  publicClient: any,
  walletClient: any,
  accountAddress: Hex,
  initData: Hex,
  salt: Hex,
  owner: Hex
) {
  console.log('\n[Step 4] Deploying account and executing distribution in ATOMIC SINGLE TX...');

  // Prepare factory deployment call data
  const factoryData = encodeAbiParameters(
    [{ type: 'bytes' }, { type: 'bytes32' }],
    [initData, salt]
  );

  const createAccountSelector = keccak256(toHex('createAccount(bytes,bytes32)')).slice(0, 10) as Hex;
  const encodedFactoryData = (createAccountSelector + factoryData.slice(2)) as Hex;

  // Get account balance and calculate distribution
  const accountBalance = await publicClient.readContract({
    address: DEPLOYED_ADDRESSES.MockToken,
    abi: mockTokenAbi,
    functionName: 'balanceOf',
    args: [accountAddress]
  }) as bigint;

  const amountZyFAI = (accountBalance * BigInt(ALLOCATION_ZYFAI)) / BigInt(TOTAL_PERCENTAGE);
  const amountGiza = (accountBalance * BigInt(ALLOCATION_GIZA)) / BigInt(TOTAL_PERCENTAGE);
  const amountCod3x = (accountBalance * BigInt(ALLOCATION_COD3X)) / BigInt(TOTAL_PERCENTAGE);

  console.log('Distribution amounts:');
  console.log('- ZyFAI (30%):', amountZyFAI.toString());
  console.log('- Giza (30%):', amountGiza.toString());
  console.log('- Cod3x (40%):', amountCod3x.toString());

  // Prepare batch executions
  const approveSelector = keccak256(toHex('approve(address,uint256)')).slice(0, 10) as Hex;
  const depositSelector = keccak256(toHex('deposit(uint256)')).slice(0, 10) as Hex;

  const executions = [
    {
      target: DEPLOYED_ADDRESSES.MockToken,
      value: 0n,
      callData: (approveSelector + encodeAbiParameters([{ type: 'address' }, { type: 'uint256' }], [DEPLOYED_ADDRESSES.EscrowZyFAI, amountZyFAI]).slice(2)) as Hex
    },
    {
      target: DEPLOYED_ADDRESSES.EscrowZyFAI,
      value: 0n,
      callData: (depositSelector + encodeAbiParameters([{ type: 'uint256' }], [amountZyFAI]).slice(2)) as Hex
    },
    {
      target: DEPLOYED_ADDRESSES.MockToken,
      value: 0n,
      callData: (approveSelector + encodeAbiParameters([{ type: 'address' }, { type: 'uint256' }], [DEPLOYED_ADDRESSES.EscrowGiza, amountGiza]).slice(2)) as Hex
    },
    {
      target: DEPLOYED_ADDRESSES.EscrowGiza,
      value: 0n,
      callData: (depositSelector + encodeAbiParameters([{ type: 'uint256' }], [amountGiza]).slice(2)) as Hex
    },
    {
      target: DEPLOYED_ADDRESSES.MockToken,
      value: 0n,
      callData: (approveSelector + encodeAbiParameters([{ type: 'address' }, { type: 'uint256' }], [DEPLOYED_ADDRESSES.EscrowCod3x, amountCod3x]).slice(2)) as Hex
    },
    {
      target: DEPLOYED_ADDRESSES.EscrowCod3x,
      value: 0n,
      callData: (depositSelector + encodeAbiParameters([{ type: 'uint256' }], [amountCod3x]).slice(2)) as Hex
    }
  ];

  const executionBatch = encodeAbiParameters(
    [
      {
        type: 'tuple[]',
        components: [
          { type: 'address', name: 'target' },
          { type: 'uint256', name: 'value' },
          { type: 'bytes', name: 'callData' }
        ]
      }
    ],
    [executions]
  );

  // Generate TEE attestation signature
  const nonce = BigInt(Math.floor(Date.now() / 1000));
  const allowedPercentageBps = BigInt(TOTAL_PERCENTAGE);
  const chainId = BigInt(baseSepolia.id);

  // CRITICAL FIX: Use encodePacked (not encodeAbiParameters) to match BondModule.sol line 266-268
  const attestationHash = keccak256(
    encodePacked(
      ['uint256', 'address', 'address', 'uint256', 'uint256', 'bytes'],
      [chainId, accountAddress, DEPLOYED_ADDRESSES.MockToken, allowedPercentageBps, nonce, executionBatch]
    )
  );

  // Sign with Ethereum message prefix
  const signature = await walletClient.signMessage({
    message: { raw: attestationHash }
  });

  // Prepare executeBatchWithAttestation call
  const batchExecutionData = encodeAbiParameters(
    [
      { type: 'address', name: 'nexusAccount' },
      { type: 'bytes', name: 'executionBatch' },
      { type: 'address', name: 'token' },
      { type: 'uint256', name: 'allowedPercentageBps' },
      { type: 'uint256', name: 'nonce' },
      { type: 'bytes', name: 'attestationSignature' }
    ],
    [accountAddress, executionBatch, DEPLOYED_ADDRESSES.MockToken, allowedPercentageBps, nonce, signature]
  );

  const executeBatchSelector = keccak256(
    toHex('executeBatchWithAttestation(address,bytes,address,uint256,uint256,bytes)')
  ).slice(0, 10) as Hex;

  const encodedBatchExecution = (executeBatchSelector + batchExecutionData.slice(2)) as Hex;

  // Create Multicall3 calls
  const calls = [
    {
      target: DEPLOYED_ADDRESSES.BiconomyMetaFactory,
      allowFailure: false,
      callData: encodeAbiParameters(
        [{ type: 'address' }, { type: 'bytes' }],
        [DEPLOYED_ADDRESSES.NexusAccountFactory, encodedFactoryData]
      )
    },
    {
      target: DEPLOYED_ADDRESSES.BondModule,
      allowFailure: false,
      callData: encodedBatchExecution
    }
  ];

  // Encode deployWithFactory selector
  const deployWithFactorySelector = keccak256(toHex('deployWithFactory(address,bytes)')).slice(0, 10) as Hex;
  calls[0].callData = (deployWithFactorySelector + calls[0].callData.slice(2)) as Hex;

  console.log('Executing atomic deployment + distribution via Multicall3...');
  console.log('Call 1: Deploy Nexus account');
  console.log('Call 2: Execute 30-30-40 distribution (6 operations)');

  const hash = await walletClient.writeContract({
    address: MULTICALL3,
    abi: multicall3Abi,
    functionName: 'aggregate3',
    args: [calls]
  });

  console.log('Transaction hash:', hash);
  console.log('Waiting for confirmation...');

  const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 2 });

  console.log('✓ Transaction confirmed');
  console.log('✓ Transaction status:', receipt.status);
  console.log('✓ Gas used:', receipt.gasUsed.toString());

  if (receipt.status !== 'success') {
    throw new Error('Transaction failed');
  }

  console.log('✓ Nexus Account deployed at:', accountAddress);
  console.log('✓ Distribution executed successfully');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
