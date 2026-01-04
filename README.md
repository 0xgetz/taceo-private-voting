# TACEO Private Voting dApp

A privacy-preserving decentralized voting application built with TACEO's collaborative SNARK tooling, enabling secure multi-party computation (MPC) for zero-knowledge proof generation.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Testing](#testing)
- [Deployment](#deployment)
- [TACEO Integration](#taceo-integration)
- [Security Considerations](#security-considerations)
- [API Reference](#api-reference)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)
- [Resources](#resources)

## Overview

This project demonstrates a decentralized application (dApp) that leverages TACEO's private computation infrastructure. Voters can cast ballots without revealing their identity or vote choice, while maintaining full verifiability and preventing double voting.

### Why TACEO?

TACEO provides a unique approach to zero-knowledge proofs by combining:

- **Collaborative SNARKs**: Multiple parties jointly compute proofs without any single party learning the private inputs
- **MPC Infrastructure**: Production-ready multi-party computation services
- **Developer-Friendly Tools**: coCircom and coNoir make it easy to convert existing circuits

## Features

| Feature                     | Description                                                                 |
|-----------------------------|-----------------------------------------------------------------------------|
| 🔒 Complete Privacy          | Vote choices and voter identities are cryptographically hidden             |
| 🤝 Collaborative Proofs     | MPC-based proof generation across multiple parties                         |
| 🚫 Double-Vote Prevention   | Nullifier mechanism ensures one vote per eligible voter                    |
| ✅ On-Chain Verification    | Smart contracts verify proofs without learning private data                |
| 📈 Scalable                  | Supports TACEO:Proof service for offloaded computation                     |
| 🌳 Merkle Tree Eligibility  | Efficient voter eligibility verification                                   |

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Client Application                         │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────────────────────┐   │
│  │ Voter        │ │ Merkle       │ │ Proof Generation           │   │
│  │ Credentials  │ │ Tree         │ │ (via MPC/coCircom)         │   │
│  └──────────────┘ └──────────────┘ └────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    TACEO MPC Infrastructure                         │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌───────────────┐    │
│  │ Party 0    │ │ Party 1    │ │ Party 2    │ │ TACEO:Proof   │    │
│  │ (Share 1)  │ │ (Share 2)  │ │ (Share 3)  │ │ (Optional)    │    │
│  └────────────┘ └────────────┘ └────────────┘ └───────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Blockchain Layer                            │
│  ┌─────────────────────────┐ ┌─────────────────────────────────┐   │
│  │ Groth16 Verifier        │ │ PrivateVoting Contract          │   │
│  │ (Auto-generated)        │ │ (Main Application)              │   │
│  └─────────────────────────┘ └─────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Flow Diagram

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌──────────┐
│ Voter   │───▶│ Secret  │───▶│ MPC     │───▶│ Smart    │
│         │    │ Sharing │    │ Parties │    │ Contract │
└─────────┘    └─────────┘    └─────────┘    └──────────┘
   │                │                │               │
   │ 1. Generate     │                │               │
   │    credentials  │                │               │
   │                │ 2. Create      │               │
   │                │    witness     │               │
   │                └───────────────▶│               │
   │                                 │ 3. MPC Proof  │
   │                                 │  Generation   │
   │                                 └──────────────▶│
   │                                                   │ 4. Verify &
   ▼                                               [Vote Cast]   Record
```

## Project Structure

```
taceo-private-voting-dapp/
├── circuits/
│   ├── vote.circom          # Main voting circuit
│   ├── tally.circom         # Vote tallying circuit
│   └── lib/
│       └── merkle.circom    # Merkle tree verification helpers
├── co-circom/
│   ├── config.toml          # MPC party configuration
│   └── input/
│       └── parties/         # Party-specific input shares
│           ├── party0_input.json
│           ├── party1_input.json
│           └── party2_input.json
├── contracts/
│   ├── PrivateVoting.sol    # Main voting contract
│   └── Verifier.sol         # Auto-generated Groth16 verifier
├── src/
│   ├── index.ts             # Application entry point
│   ├── prover.ts            # MPC proof generation module
│   ├── verifier.ts          # Proof verification utilities
│   └── utils.ts             # Helper functions (Poseidon, Merkle)
├── test/
│   └── PrivateVoting.test.ts # Comprehensive test suite
├── scripts/
│   └── deploy.ts            # Deployment automation
├── keys/                    # Generated proving/verification keys
├── proofs/                  # Generated proofs output
├── package.json
├── hardhat.config.ts
├── tsconfig.json
└── README.md
```

## Prerequisites

| Requirement       | Version      | Purpose                  |
|-------------------|--------------|--------------------------|
| Node.js           | v18+         | JavaScript runtime       |
| npm or yarn       | Latest       | Package management       |
| Rust              | Latest       | Circom compilation       |
| Git               | Latest       | Version control          |
| Circom            | 2.1.6+       | Circuit compilation      |

**Optional (for production)**

- TACEO MPC infrastructure access
- TACEO:Proof API key
- Ethereum wallet with testnet funds

## Installation

1. **Clone the Repository**

```bash
git clone https://github.com/0xgetz/taceo-private-voting.git
cd taceo-private-voting
```

2. **Install Dependencies**

```bash
npm install
```

3. **Install Circom (if not already installed)**

```bash
curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh
source ~/.cargo/env
git clone https://github.com/iden3/circom.git
cd circom
cargo build --release
cargo install --path circom
cd ..
circom --version
```

4. **Download Powers of Tau**

```bash
wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_12.ptau -O pot12_final.ptau
```

5. **Setup Circuit**

```bash
npm run build:circuit      # Compile the circuit
npm run setup              # Generate proving and verification keys
npm run export:vkey        # Export verification key
npm run export:verifier    # Generate Solidity verifier
```

## Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Network Configuration
RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
MAINNET_RPC_URL=https://mainnet.infura.io/v3/YOUR_INFURA_KEY

# Wallet Configuration
PRIVATE_KEY=your_private_key_here

# Contract Addresses (after deployment)
CONTRACT_ADDRESS=0x...
VERIFIER_ADDRESS=0x...

# TACEO Configuration
TACEO_API_KEY=your_taceo_api_key
TACEO_PROOF_ENDPOINT=https://proof.taceo.io

# Etherscan (for contract verification)
ETHERSCAN_API_KEY=your_etherscan_api_key
```

### MPC Configuration (co-circom/config.toml)

```toml
[protocol]
protocol = "rep3"

[parties]
count = 3

[[parties.config]]
id = 0
address = "party0.example.com:50000"
tls_cert = "./certs/party0.crt"

[[parties.config]]
id = 1
address = "party1.example.com:50001"
tls_cert = "./certs/party1.crt"

[[parties.config]]
id = 2
address = "party2.example.com:50002"
tls_cert = "./certs/party2.crt"

[circuit]
r1cs = "./circuits/vote.r1cs"
wasm = "./circuits/vote_js/vote.wasm"
sym = "./circuits/vote.sym"

[proving]
proving_key = "./keys/vote.zkey"
verification_key = "./keys/verification_key.json"

[network]
timeout_ms = 30000
retry_count = 3
buffer_size = 65536

[output]
proof_dir = "./proofs"
public_signals_dir = "./public"
```

## Usage

### Quick Start

```bash
npm run compile               # Compile contracts
npx hardhat node              # Start local Hardhat node (separate terminal)
npm run deploy:local          # Deploy to local network
npm run start                 # Run the application
```

### Programmatic Usage

#### Initialize the Client

```typescript
import { PrivateVotingClient, TACEOConfig } from './src';
import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

const taceoConfig: TACEOConfig = {
  protocol: 'rep3',
  parties: [
    { id: 0, endpoint: 'https://party0.taceo.io:50000' },
    { id: 1, endpoint: 'https://party1.taceo.io:50001' },
    { id: 2, endpoint: 'https://party2.taceo.io:50002' }
  ],
  proofService: 'https://proof.taceo.io' // Optional: use TACEO:Proof
};

const client = new PrivateVotingClient(
  process.env.CONTRACT_ADDRESS!,
  signer,
  taceoConfig
);
```

#### Register a Voter

```typescript
import { randomBytes } from 'crypto';

const voterSecret = BigInt('0x' + randomBytes(31).toString('hex'));
const voterNullifier = BigInt('0x' + randomBytes(31).toString('hex'));

const commitment = await client.registerVoter(voterSecret, voterNullifier);
console.log(`Voter commitment: ${commitment}`);
```

#### Cast a Vote

```typescript
const merkleProof = await client.getMerkleProof(commitment);

const receipt = await client.castVote({
  voterSecret,
  voterNullifier,
  voteChoice: 2,
  merkleProof
});

console.log(`✅ Vote cast successfully!`);
console.log(`Transaction: ${receipt.hash}`);
```

#### Check Voting Status & Results

```typescript
const isActive = await client.isVotingActive();
const results = await client.getResults();
```

## Testing

```bash
npm test                      # Run all tests
npx hardhat test test/PrivateVoting.test.ts  # Specific tests
REPORT_GAS=true npx hardhat test             # With gas reporting
npx hardhat coverage          # Coverage report
```

## Deployment

### Local

```bash
npx hardhat node
npm run deploy:local
```

### Sepolia Testnet

```bash
npm run deploy
npx hardhat verify --network sepolia DEPLOYED_CONTRACT_ADDRESS
```

### Mainnet

```bash
npm run deploy:mainnet
npx hardhat verify --network mainnet DEPLOYED_CONTRACT_ADDRESS
```

## TACEO Integration

Key integration points include secret sharing, share distribution, collaborative proof generation, and optional use of the TACEO:Proof service.

## Security Considerations

- **Cryptographic Security**: Poseidon (128-bit), Groth16 (128-bit), BN254 curve
- **Trust Model**: At least one MPC party must be honest; admin controls eligibility
- **Best Practices**: Secure secret management, TLS for MPC, thorough contract audits

## API Reference

### PrivateVotingClient

```typescript
constructor(contractAddress: string, signer: ethers.Signer, taceoConfig: TACEOConfig)

registerVoter(secret: bigint, nullifier: bigint): Promise<bigint>
castVote(input: VoteInput): Promise<TransactionReceipt>
isVotingActive(): Promise<boolean>
getResults(): Promise<bigint[]>
getMerkleProof(commitment: bigint): Promise<MerkleProof>
```

## Troubleshooting

- **Circuit Compilation Fails**: Ensure `circomlib` is installed
- **Proof Generation Timeout**: Check party endpoints and increase timeout
- **Invalid Proof on Chain**: Verify public inputs and keys match
- **Gas Estimation Failed**: Check Merkle root, nullifier, and voting period

Enable debug: `DEBUG=taceo:* npm run start`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit changes
4. Push and open a Pull Request

## License

MIT License © 2024 eyren 

## Resources

- [TACEO Documentation](https://taceo.io)
- [coCircom Quick Start](https://taceo.io/docs/cocircom)
- [Circom](https://docs.circom.io)
- [Hardhat](https://hardhat.org)
- [Ethers.js](https://docs.ethers.io)
