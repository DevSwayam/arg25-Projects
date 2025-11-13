import { createPublicClient, createWalletClient, http, encodeFunctionData, encodeAbiParameters, keccak256, concat, getAddress, toBytes, toHex, parseAbiParameters, Address, Hex, encodePacked } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * BondModule Deployment Demo Script
 *
 * This script demonstrates BondModule functionality using already deployed contracts.
 * It shows how to:
 * 1. Connect to deployed contracts
 * 2. Pre-compute Nexus account address
 * 3. Execute atomic deployment + distribution via Multicall3
 *
 * Network: Base Sepolia
 * Run: PRIVATE_KEY=your_key ts-node --require dotenv/config index.ts
 */

// Deployed contract addresses from Foundry deployment
const DEPLOYED_ADDRESSES = {
  K1Validator: "0xaCEeEa78b9E1ACc06F5B6Cc527a3FE71A722CedB",
  MockRegistry: "0x6feaFAbB6ba2a46A62eBb8A39354C73A6e1c283e",
  NexusBootstrap: "0x7B5DED478B61C7Cb54F980A4FFcbEf4CC03B65Ef",
  NexusImplementation: "0x2BF411df5165A1F41D9a5a78b5Fc1Cf1ce83C2E6",
  NexusAccountFactory: "0x123221fd520687f78e556c0F594aaA7030e09F6C",
  BiconomyMetaFactory: "0x74e32771e3dc456D18797df513A1181e166940C2",
  BondModule: "0x29195B26D9C4253C7e956e8ac4556697F7718C6D",
  MockToken: "0x0B1Cddc846C5b1aC1293F943aFd8F642418D6f48",
  EscrowZyFAI: "0x87aadB3aC964d1E50Be5025f08f4AF876DA81d10",
  EscrowGiza: "0x4ad7da42761456f701d44322D25165629F5d795B",
  EscrowCod3x: "0xA15bD240D25721687A90e70C193a7d42e8C5FF6c",
} as const;

const BASE_SEPOLIA_ENTRYPOINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11";
const INITIAL_TOKEN_BALANCE = 10_000_000_000n;
const ALLOWANCE_CAP = 10_000_000_000n;

const ALLOCATION_ZYFAI = 3000; // 30%
const ALLOCATION_GIZA = 3000; // 30%
const ALLOCATION_COD3X = 4000; // 40%
const TOTAL_PERCENTAGE = 10000; // 100%

interface DeployedContracts {
  k1Validator: any;
  mockRegistry: any;
  nexusBootstrap: any;
  nexusAccountFactory: any;
  biconomyMetaFactory: any;
  bondModule: any;
  mockToken: any;
}

// Helper to load ABI from artifacts folder
function loadABI(contractName: string): any[] {
  const artifactPaths = [
    `artifacts/contracts/modules/validators/${contractName}.sol/${contractName}.json`,
    `artifacts/contracts/modules/executors/${contractName}.sol/${contractName}.json`,
    `artifacts/contracts/mocks/${contractName}.sol/${contractName}.json`,
    `artifacts/contracts/utils/${contractName}.sol/${contractName}.json`,
    `artifacts/contracts/factory/${contractName}.sol/${contractName}.json`,
    `artifacts/contracts/interfaces.sol/I${contractName}.json`,
  ];

  for (const artifactPath of artifactPaths) {
    const fullPath = path.join(__dirname, artifactPath);
    if (fs.existsSync(fullPath)) {
      const artifact = JSON.parse(fs.readFileSync(fullPath, "utf8"));
      if (artifact.abi && artifact.abi.length > 0) {
        return artifact.abi;
      }
    }
  }

  console.log(`⚠️  Warning: No ABI found for ${contractName}, using empty ABI`);
  return [];
}

async function main() {
  console.log("\n=== BONDMODULE ATOMIC DEPLOYMENT + DISTRIBUTION ===");

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("PRIVATE_KEY environment variable not set");
  }

  // Create viem clients
  const rpcUrl = process.env.RPC_URL || "https://sepolia.base.org";
  const account = privateKeyToAccount(privateKey as Hex);
  
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(rpcUrl),
  });

  const owner = account.address;
  console.log("Deployer:", owner);
  
  const chainId = await publicClient.getChainId();
  console.log("Chain ID:", chainId);

  const contracts = await connectToDeployedContracts(publicClient, walletClient);
  const { accountAddress, initData, salt } = await preComputeAccountAddress(contracts, owner, publicClient);

  console.log("\n[Step 3] Checking if account already deployed...");
  const existingCode = await publicClient.getBytecode({ address: accountAddress });
  if (existingCode && existingCode !== "0x") {
    console.log("⚠️  Account already deployed at:", accountAddress);
    console.log("Skipping deployment. Use a different salt for a new account.");
    await updateDeploymentsJson(accountAddress);
    return;
  }

  console.log("✓ Account not yet deployed, proceeding with atomic deployment...");

  await mintTokensToAccount(contracts.mockToken, accountAddress, walletClient, publicClient);
  await deployAccountAndExecuteDistribution(contracts, accountAddress, initData, salt, owner, walletClient, publicClient);
  await updateDeploymentsJson(accountAddress);

  console.log("\n=== ATOMIC DEPLOYMENT COMPLETE ===");
}

async function connectToDeployedContracts(publicClient: any, walletClient: any): Promise<DeployedContracts> {
  console.log("\n[Step 1] Connecting to deployed contracts...");

  const k1Validator = { address: DEPLOYED_ADDRESSES.K1Validator as Address, abi: loadABI("K1Validator") };
  console.log("✓ K1Validator:", k1Validator.address);

  const mockRegistry = { address: DEPLOYED_ADDRESSES.MockRegistry as Address, abi: loadABI("MockRegistry") };
  console.log("✓ MockRegistry:", mockRegistry.address);

  const nexusBootstrap = { address: DEPLOYED_ADDRESSES.NexusBootstrap as Address, abi: loadABI("NexusBootstrap") };
  console.log("✓ NexusBootstrap:", nexusBootstrap.address);

  const nexusAccountFactory = { address: DEPLOYED_ADDRESSES.NexusAccountFactory as Address, abi: loadABI("NexusAccountFactory") };
  console.log("✓ NexusAccountFactory:", nexusAccountFactory.address);

  const biconomyMetaFactory = { address: DEPLOYED_ADDRESSES.BiconomyMetaFactory as Address, abi: loadABI("BiconomyMetaFactory") };
  console.log("✓ BiconomyMetaFactory:", biconomyMetaFactory.address);

  const bondModule = { address: DEPLOYED_ADDRESSES.BondModule as Address, abi: loadABI("BondModule") };
  console.log("✓ BondModule:", bondModule.address);

  const mockToken = { address: DEPLOYED_ADDRESSES.MockToken as Address, abi: loadABI("MockToken") };
  console.log("✓ Mock Token:", mockToken.address);

  console.log("✓ ZyFAI Vault:", DEPLOYED_ADDRESSES.EscrowZyFAI);
  console.log("✓ Giza Vault:", DEPLOYED_ADDRESSES.EscrowGiza);
  console.log("✓ Cod3x Vault:", DEPLOYED_ADDRESSES.EscrowCod3x);

  return {
    k1Validator,
    mockRegistry,
    nexusBootstrap,
    nexusAccountFactory,
    biconomyMetaFactory,
    bondModule,
    mockToken,
  };
}

async function preComputeAccountAddress(contracts: DeployedContracts, owner: Address, publicClient: any) {
  console.log("\n[Step 2] Pre-computing account address...");

  const tokenAddresses = [contracts.mockToken.address];
  const totalAmounts = [ALLOWANCE_CAP];
  
  const executorInstallData = encodeAbiParameters(
    parseAbiParameters("address[], uint256[]"),
    [tokenAddresses, totalAmounts]
  );

  const executors = [{ module: contracts.bondModule.address, data: executorInstallData as Hex }];
  const registryConfig = { registry: contracts.mockRegistry.address, attesters: [owner], threshold: 1 };

  const initCall = encodeFunctionData({
    abi: contracts.nexusBootstrap.abi,
    functionName: "initNexusWithDefaultValidatorAndOtherModules",
    args: [
      owner,
      [],
      executors,
      { module: "0x0000000000000000000000000000000000000000" as Address, data: "0x" as Hex },
      [],
      [],
      registryConfig,
    ],
  });

  const initData = encodeAbiParameters(
    parseAbiParameters("address, bytes"),
    [contracts.nexusBootstrap.address, initCall]
  );

  // Use a timestamp-based salt for unique deployment each time
  const timestamp = Math.floor(Date.now() / 1000);
  const saltInput = `nexus-bondmodule-hardhat-${timestamp}`;
  const salt = keccak256(toBytes(saltInput));

  const accountAddress = await publicClient.readContract({
    address: contracts.nexusAccountFactory.address,
    abi: contracts.nexusAccountFactory.abi,
    functionName: "computeAccountAddress",
    args: [initData as Hex, salt],
  });

  console.log("Pre-computed Account Address:", accountAddress);

  return { accountAddress, initData, salt };
}

async function mintTokensToAccount(mockToken: any, accountAddress: Address, walletClient: any, publicClient: any) {
  console.log("\n[Step 4] Minting tokens to pre-computed address...");
  console.log("Target address:", accountAddress);
  
  const code = await publicClient.getBytecode({ address: accountAddress });
  console.log("Address has code?", code && code !== "0x");

  const hash = await walletClient.writeContract({
    address: mockToken.address,
    abi: mockToken.abi,
    functionName: "mint",
    args: [accountAddress, INITIAL_TOKEN_BALANCE],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log("✓ Mint transaction confirmed:", receipt.transactionHash);

  // Wait a bit for state to update
  await new Promise(resolve => setTimeout(resolve, 1000));

  const balance = await publicClient.readContract({
    address: mockToken.address,
    abi: mockToken.abi,
    functionName: "balanceOf",
    args: [accountAddress],
  }) as bigint;

  console.log("✓ Minted", INITIAL_TOKEN_BALANCE.toString(), "tokens");
  console.log("Pre-computed address token balance:", balance.toString());
}

async function deployAccountAndExecuteDistribution(
  contracts: DeployedContracts,
  accountAddress: Address,
  initData: Hex,
  salt: Hex,
  owner: Address,
  walletClient: any,
  publicClient: any
) {
  console.log("\n[Step 5] Deploying account and executing distribution in ATOMIC SINGLE TX...");

  // Prepare factory deployment call data
  const factoryData = encodeFunctionData({
    abi: contracts.nexusAccountFactory.abi,
    functionName: "createAccount",
    args: [initData, salt],
  });

  // Get account balance and calculate distribution amounts
  const accountBalance = await publicClient.readContract({
    address: contracts.mockToken.address,
    abi: contracts.mockToken.abi,
    functionName: "balanceOf",
    args: [accountAddress],
  }) as bigint;

  const amountZyFAI = (accountBalance * BigInt(ALLOCATION_ZYFAI)) / BigInt(TOTAL_PERCENTAGE);
  const amountGiza = (accountBalance * BigInt(ALLOCATION_GIZA)) / BigInt(TOTAL_PERCENTAGE);
  const amountCod3x = (accountBalance * BigInt(ALLOCATION_COD3X)) / BigInt(TOTAL_PERCENTAGE);

  console.log("Distribution amounts:");
  console.log("- ZyFAI (30%):", amountZyFAI.toString());
  console.log("- Giza (30%):", amountGiza.toString());
  console.log("- Cod3x (40%):", amountCod3x.toString());

  // Prepare batch executions (3 approvals + 3 deposits)
  const executions = [
    {
      target: contracts.mockToken.address,
      value: 0n,
      callData: encodeFunctionData({
        abi: contracts.mockToken.abi,
        functionName: "approve",
        args: [DEPLOYED_ADDRESSES.EscrowZyFAI as Address, amountZyFAI],
      }),
    },
    {
      target: DEPLOYED_ADDRESSES.EscrowZyFAI as Address,
      value: 0n,
      callData: encodeFunctionData({
        abi: [{ type: "function", name: "deposit", inputs: [{ name: "amount", type: "uint256" }], outputs: [], stateMutability: "nonpayable" }],
        functionName: "deposit",
        args: [amountZyFAI],
      }),
    },
    {
      target: contracts.mockToken.address,
      value: 0n,
      callData: encodeFunctionData({
        abi: contracts.mockToken.abi,
        functionName: "approve",
        args: [DEPLOYED_ADDRESSES.EscrowGiza as Address, amountGiza],
      }),
    },
    {
      target: DEPLOYED_ADDRESSES.EscrowGiza as Address,
      value: 0n,
      callData: encodeFunctionData({
        abi: [{ type: "function", name: "deposit", inputs: [{ name: "amount", type: "uint256" }], outputs: [], stateMutability: "nonpayable" }],
        functionName: "deposit",
        args: [amountGiza],
      }),
    },
    {
      target: contracts.mockToken.address,
      value: 0n,
      callData: encodeFunctionData({
        abi: contracts.mockToken.abi,
        functionName: "approve",
        args: [DEPLOYED_ADDRESSES.EscrowCod3x as Address, amountCod3x],
      }),
    },
    {
      target: DEPLOYED_ADDRESSES.EscrowCod3x as Address,
      value: 0n,
      callData: encodeFunctionData({
        abi: [{ type: "function", name: "deposit", inputs: [{ name: "amount", type: "uint256" }], outputs: [], stateMutability: "nonpayable" }],
        functionName: "deposit",
        args: [amountCod3x],
      }),
    },
  ];

  const executionBatch = encodeAbiParameters(
    parseAbiParameters("(address target, uint256 value, bytes callData)[]"),
    [executions]
  );

  // Generate TEE attestation signature
  const nonce = BigInt(Math.floor(Date.now() / 1000));
  const allowedPercentageBps = BigInt(TOTAL_PERCENTAGE);
  const chainId = await publicClient.getChainId();

  // Create packed hash using solidityPackedKeccak256 equivalent
  // keccak256(abi.encodePacked(chainId, accountAddress, tokenAddress, allowedPercentageBps, nonce, executionBatch))
  const packedData = encodePacked(
    ["uint256", "address", "address", "uint256", "uint256", "bytes"],
    [chainId, accountAddress, contracts.mockToken.address, allowedPercentageBps, nonce, executionBatch]
  );
  
  const attestationHash = keccak256(toBytes(packedData));

  // Ethereum signed message hash: keccak256("\x19Ethereum Signed Message:\n32" || hash)
  const messagePrefix = toBytes("\x19Ethereum Signed Message:\n32");
  const ethSignedHash = keccak256(concat([messagePrefix, toBytes(attestationHash)]));

  // Sign with wallet
  const signature = await walletClient.signMessage({
    message: { raw: ethSignedHash },
  });

  // Prepare executeBatchWithAttestation call data
  const batchExecutionData = encodeFunctionData({
    abi: contracts.bondModule.abi,
    functionName: "executeBatchWithAttestation",
    args: [
      accountAddress,
      executionBatch,
      contracts.mockToken.address,
      allowedPercentageBps,
      nonce,
      signature,
    ],
  });

  // Create Multicall3 calls array
  const multicall3ABI = loadABI("IMulticall3");
  if (multicall3ABI.length === 0) {
    // Fallback ABI for aggregate3
    multicall3ABI.push({
      type: "function",
      name: "aggregate3",
      inputs: [
        {
          name: "calls",
          type: "tuple[]",
          components: [
            { name: "target", type: "address" },
            { name: "allowFailure", type: "bool" },
            { name: "callData", type: "bytes" },
          ],
        },
      ],
      outputs: [
        {
          name: "returnData",
          type: "tuple[]",
          components: [
            { name: "success", type: "bool" },
            { name: "returnData", type: "bytes" },
          ],
        },
      ],
      stateMutability: "payable",
    });
  }

  const calls = [
    {
      target: DEPLOYED_ADDRESSES.BiconomyMetaFactory as Address,
      allowFailure: false,
      callData: encodeFunctionData({
        abi: contracts.biconomyMetaFactory.abi,
        functionName: "deployWithFactory",
        args: [DEPLOYED_ADDRESSES.NexusAccountFactory as Address, factoryData],
      }),
    },
    {
      target: DEPLOYED_ADDRESSES.BondModule as Address,
      allowFailure: false,
      callData: batchExecutionData,
    },
  ];

  console.log("Executing atomic deployment + distribution via Multicall3...");
  console.log("Call 1: Deploy Nexus account");
  console.log("Call 2: Execute 30-30-40 distribution (6 operations)");

  // Execute both calls atomically in single transaction
  const hash = await walletClient.writeContract({
    address: MULTICALL3 as Address,
    abi: multicall3ABI,
    functionName: "aggregate3",
    args: [calls],
    gas: 5000000n,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  console.log("✓ Transaction hash:", receipt.transactionHash);
  console.log("✓ Gas used:", receipt.gasUsed.toString());

  // Verify account deployment
  const deployedCode = await publicClient.getBytecode({ address: accountAddress });
  if (!deployedCode || deployedCode === "0x") {
    throw new Error("Account deployment failed - no code at address");
  }
  console.log("✓ Nexus Account deployed at:", accountAddress);

  // Verify BondModule initialization
  const isInitialized = await publicClient.readContract({
    address: contracts.bondModule.address,
    abi: contracts.bondModule.abi,
    functionName: "isInitialized",
    args: [accountAddress],
  });
  console.log("✓ BondModule initialized:", isInitialized);

  const isAgentMode = await publicClient.readContract({
    address: contracts.bondModule.address,
    abi: contracts.bondModule.abi,
    functionName: "isAgentModeActivated",
    args: [accountAddress],
  });
  console.log("✓ Agent mode activated:", isAgentMode);

  console.log("[SUCCESS] Atomic deployment + distribution completed in 1 tx!");
}

async function updateDeploymentsJson(nexusAccountAddress: Address) {
  console.log("\n[Step 6] Updating deployments.json...");

  const deploymentsPath = path.join(__dirname, "deployments.json");
  
  // Create deployments.json if it doesn't exist
  let deployments: any = {};
  if (fs.existsSync(deploymentsPath)) {
    deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
  }

  // Update bondModule deployment info
  if (!deployments.networks) {
    deployments.networks = {};
  }
  if (!deployments.networks.baseSepolia) {
    deployments.networks.baseSepolia = {};
  }
  if (!deployments.networks.baseSepolia.modules) {
    deployments.networks.baseSepolia.modules = {};
  }

  deployments.networks.baseSepolia.modules.bondModule = {
    address: DEPLOYED_ADDRESSES.BondModule,
    transactionHash: "Latest deployment via Foundry",
    blockNumber: "Latest",
    verified: false,
    basescanLink: `https://sepolia.basescan.org/address/${DEPLOYED_ADDRESSES.BondModule}`,
    deploymentDate: new Date().toISOString().split("T")[0],
    features: {
      agentMode: true,
      percentageBasedLimits: true,
      teeAttestation: true,
      replayProtection: true,
      yieldProtocolIntegration: true,
      atomicMulticall3Deployment: true,
    },
    demoAccount: {
      preComputedAddress: nexusAccountAddress,
      basescanLink: `https://sepolia.basescan.org/address/${nexusAccountAddress}`,
    },
    escrowVaults: {
      zyfai: {
        address: DEPLOYED_ADDRESSES.EscrowZyFAI,
        allocation: "30%",
        basescanLink: `https://sepolia.basescan.org/address/${DEPLOYED_ADDRESSES.EscrowZyFAI}`,
      },
      giza: {
        address: DEPLOYED_ADDRESSES.EscrowGiza,
        allocation: "30%",
        basescanLink: `https://sepolia.basescan.org/address/${DEPLOYED_ADDRESSES.EscrowGiza}`,
      },
      cod3x: {
        address: DEPLOYED_ADDRESSES.EscrowCod3x,
        allocation: "40%",
        basescanLink: `https://sepolia.basescan.org/address/${DEPLOYED_ADDRESSES.EscrowCod3x}`,
      },
    },
    mockToken: {
      address: DEPLOYED_ADDRESSES.MockToken,
      name: "Test USDC",
      symbol: "USDC",
      decimals: 6,
      basescanLink: `https://sepolia.basescan.org/address/${DEPLOYED_ADDRESSES.MockToken}`,
    },
    coreContracts: {
      k1Validator: DEPLOYED_ADDRESSES.K1Validator,
      mockRegistry: DEPLOYED_ADDRESSES.MockRegistry,
      nexusBootstrap: DEPLOYED_ADDRESSES.NexusBootstrap,
      nexusImplementation: DEPLOYED_ADDRESSES.NexusImplementation,
      nexusAccountFactory: DEPLOYED_ADDRESSES.NexusAccountFactory,
      biconomyMetaFactory: DEPLOYED_ADDRESSES.BiconomyMetaFactory,
    },
  };

  fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
  console.log("✓ Updated deployments.json with BondModule info");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
