## Project Title

**UnWallet – Agent-First Modular Wallet SDK**



## Team

* **Team/Individual Name:** UnWallet / Swayam Karle & MedAmine
* **GitHub Handle:** [@DevSwayam](https://github.com/DevSwayam)
* **Devfolio Handle:** [DevSwayam](https://devfolio.co/@DevSwayam)
* **Collaborator Devfolio Handle:** [MedAmine](https://devfolio.co/@MedAmine)



## Project Description

UnWallet is an **agent-first modular wallet SDK** designed for the emerging agentic ecosystem. It abstracts complex infrastructure related to **blockchain networks, token operations, verifiable AI inference, and the x402 payment standard**, enabling developers to focus purely on building intelligent, autonomous on-chain agents.

The SDK offers:

* **Modular Smart Accounts** built on ERC-4337 and ERC-7579
* **Hosted Cross-Chain Paymaster** for sponsoring agent transactions
* **Opt-in Privacy** using stealth keys for unlinkable coordination and payments
* **Cross-Chain Facilitator** supporting x402, Permit2, and transferWithAuthorization
* **Verifiable AI Inference** powered by EigenAI for transparent and auditable AI responses

UnWallet’s vision is to become the foundational wallet infrastructure layer for agents — allowing builders to integrate secure, verifiable, and composable wallet logic with minimal setup.



## Tech Stack

* Solidity (ERC-4337, ERC-7579 modular smart account infrastructure)
* TypeScript / Node.js SDK
* Ethers.js for blockchain interaction
* EigenLayer’s **EigenAI** for verifiable AI inference
* Trusted Execution Environments (TEE) for stealth key generation
* ENS Subdomain Standard for agent registry and lookup
* x402, EIP-3009, Permit2, and A2P payment protocols
* Deployed on Base, Arbitrum, Polygon, and BNB Chain
* Frontend: Next.js and Tailwind for the landing page and demo interfaces



## Objectives

By the end of ARG25, UnWallet aims to:

1. Release a production-ready SDK for modular agent wallets (ERC-4337 + ERC-7579).
2. Deploy and test the hosted paymaster across major EVM-compatible chains.
3. Integrate a cross-chain facilitator supporting x402 and Permit2 for seamless token movement.
4. Launch a public-facing website and demo showcasing SDK functionality.
5. Collaborate with the **Bond.Credit** team to refine SDK capabilities for verifiable credit and agent interactions.
6. Enable opt-in privacy and verifiable inference using stealth keys and EigenAI.



## Weekly Progress

### Week 1 (ends Oct 31)

**Goals:**

* Finalize UnWallet architecture and core module definitions.
* Implement base ERC-4337 smart account contract.
* Establish ERC-7579 modular extension framework.
* Launch UnWallet website (unwallet.io).

**Progress Summary:**
Completed the ERC-4337 smart account foundation and modular structure for ERC-7579 compatibility. Deployed the **UnWallet landing page at [unwallet.io](https://unwallet.io)** to outline the SDK vision and roadmap. Designed the base module interfaces for paymaster, privacy, and facilitator functionality.



### Week 2 (ends Nov 7)

**Goals:**

* Integrate ERC-7579 modular kit for composable modules (auto-earn, swap, cross-chain).
* Deploy hosted paymaster supporting Base and Arbitrum.
* Implement stealth key privacy mechanism for unlinkable agent transactions.
* Launch UnWallet demo (demo.unwallet.io).
* Begin collaboration with the **Bond.Credit** team to test SDK integrations for agentic credit scoring.

**Progress Summary:**
Integrated ERC-7579 module system with pre-built auto-earn and swap functionality. Deployed hosted paymaster on Base and Arbitrum testnets for sponsored agent transactions. Implemented stealth key generation and privacy module supporting unlinkable agent addresses.
Launched **demo.unwallet.io**, showcasing UnWallet’s core SDK operations and live wallet creation flow.
Initiated technical collaboration with **Bond.Credit** (Discord: `medamineid`) to align SDK primitives with verifiable credit systems for agentic finance.



### Week 3 (ends Nov 14)

**Goals:**

* Integrate x402 facilitator and cross-chain bridging module.
* Connect EigenAI for verifiable inference in agentic workflows.
* Conduct complete SDK testing with Bond.Credit integration scenarios.
* Prepare final documentation and showcase updated demo.

**Progress Summary:**
Integrated x402 facilitator logic for cross-chain operations with x402 and Permit2 support. Added EigenAI inference verification for secure, transparent agent responses. Strengthened SDK integration with Bond.Credit’s verifiable credit layer to test agent trust scoring and yield-based operations. Completed end-to-end SDK testing with privacy mode and hosted paymaster.



## Final Wrap-Up

UnWallet successfully evolved into a robust SDK for agent developers, combining modular smart accounts, hosted gas sponsorship, verifiable inference, and opt-in privacy under one unified API.

* **Main Repository Link:** [https://github.com/DevSwayam/UnWallet](https://github.com/DevSwayam/UnWallet)
* **Website:** [https://unwallet.io](https://unwallet.io)
* **Demo:** [https://demo.unwallet.io](https://demo.unwallet.io)
* **Collaborator:** Bond.Credit (Discord: `medamineid`, Devfolio: [@MedAmine](https://devfolio.co/@MedAmine))
* **Slides / Presentation:** *Available on request*



## Learnings

Through ARG25, the UnWallet team deepened understanding of modular smart accounts, stealth privacy mechanisms, and cross-chain facilitation. Key learnings include the challenges of implementing multi-chain paymaster logic, optimizing stealth address UX for agent workflows, and validating LLM outputs through verifiable compute using EigenAI.
Collaboration with Bond.Credit helped refine SDK design for financial agents that depend on verifiable credit scoring and composable transaction history.



## Next Steps

* Expand SDK documentation, examples, and developer onboarding flow.
* Integrate direct credit and risk models from Bond.Credit into UnWallet modules.
* Extend facilitator coverage to L2s like zkSync and Scroll.
* Launch closed beta for agent developers and early integrators.
* Explore integrating EigenLayer restaking incentives for verifiable compute reliability.



*This template is part of the [ARG25 Projects Repository](https://github.com/invisible-garden/arg25-projects).*
*Update this file weekly by committing and pushing to your fork, then raising a PR at the end of each week.*