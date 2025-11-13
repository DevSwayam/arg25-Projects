// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Minimal interfaces for contract interactions
// These are placeholder interfaces - replace with actual ABIs if available

interface IK1Validator {
    // Add function signatures as needed
}

interface IMockRegistry {
    // Add function signatures as needed
}

interface INexusBootstrap {
    function initNexusWithDefaultValidatorAndOtherModules(
        address owner,
        address[] memory validators,
        ExecutorConfig[] memory executors,
        FallbackConfig memory fallbackConfig,
        HookConfig[] memory hooks,
        ValidationConfig[] memory validationConfigs,
        RegistryConfig memory registryConfig
    ) external;
}

interface INexusAccountFactory {
    function createAccount(bytes memory initData, bytes32 salt) external returns (address);
    function computeAccountAddress(bytes memory initData, bytes32 salt) external view returns (address);
}

interface IBiconomyMetaFactory {
    function deployWithFactory(address factory, bytes memory factoryData) external returns (address);
}

interface IBondModule {
    function executeBatchWithAttestation(
        address account,
        bytes memory executionBatch,
        address token,
        uint256 allowedPercentageBps,
        uint256 nonce,
        bytes memory signature
    ) external;
    
    function isInitialized(address account) external view returns (bool);
    function isAgentModeActivated(address account) external view returns (bool);
}

interface IMockToken {
    function mint(address to, uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IMulticall3 {
    function aggregate3(
        Call3[] memory calls
    ) external payable returns (Result[] memory returnData);
}

// Struct definitions
struct ExecutorConfig {
    address module;
    bytes data;
}

struct FallbackConfig {
    address module;
    bytes data;
}

struct HookConfig {
    address module;
    bytes data;
}

struct ValidationConfig {
    address module;
    bytes data;
}

struct RegistryConfig {
    address registry;
    address[] attesters;
    uint256 threshold;
}

struct Call3 {
    address target;
    bool allowFailure;
    bytes callData;
}

struct Result {
    bool success;
    bytes returnData;
}

