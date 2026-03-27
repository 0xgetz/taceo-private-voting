# 🗳️ TACEO Private Voting dApp

![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636?style=flat-square&logo=solidity)
![Node.js](https://img.shields.io/badge/Node.js-18+-green?style=flat-square&logo=node.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript)
![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)
![Version](https://img.shields.io/badge/version-2.0.0-purple?style=flat-square)

A **privacy-preserving decentralized voting dApp** built with [TACEO's coCircom](https://taceo.io) — enabling zero-knowledge proofs through **Multi-Party Computation (MPC)**. Voters cast ballots without revealing their identity or vote choice, while the blockchain guarantees full verifiability and prevents double voting.

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔒 **Complete Privacy** | Vote choices and voter identities are cryptographically hidden |
| 🤝 **Collaborative ZK Proofs** | MPC-based proof generation — no single party learns private inputs |
| 🚫 **Double-Vote Prevention** | Nullifier mechanism ensures one vote per eligible voter |
| ✅ **On-Chain Verification** | Groth16 proof verification without revealing private data |
| 🌳 **Merkle Tree Eligibility** | Efficient voter registration via Poseidon Merkle tree (depth 20, ~1M voters) |
| 🛡️ **Security Hardened** | Input validation, admin transfer, proper error messages |

## 🏗 Architecture

```
Voter → Secret Sharing → TACEO MPC Parties → ZK Proof → Smart Contract
```

```
┌─────────────────────────────────────────────────────┐
│                 Client (TypeScript)                 │
│  Voter Credentials │ Merkle Proof │ CoCircomProver  │
└─────────────────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────┐
│             TACEO MPC Infrastructure                │
│  Party 0 (share 1) │ Party 1 (share 2) │ Party 2   │
└─────────────────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────┐
│              Ethereum Smart Contracts               │
│  Groth16Verifier (auto-gen) │ PrivateVoting.sol     │
└─────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| npm | 9+ | Comes with Node.js |

### 1. Clone & Install

```bash
git clone https://github.com/0xgetz/taceo-private-voting.git
cd taceo-private-voting
npm install
```

### 2. Environment Setup

```bash
cp .env.example .env
# Edit .env — add your RPC URL, private key, etc.
```

### 3. Compile Contracts

```bash
npm run compile
```

> A stub `Verifier.sol` is included so the project compiles immediately without ZK setup.

### 4. Run Tests

```bash
npm test
```

### 5. Deploy to Sepolia

```bash
npm run deploy
```

### 6. Start Local Node (for development)

```bash
npm run node            # Terminal 1
npm run deploy:local    # Terminal 2
```

## 🔧 ZK Circuit Setup

> **Optional for basic testing** — skip if you just want to run contract tests.

**Install Circom:**
```bash
curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh
source ~/.cargo/env
git clone https://github.com/iden3/circom.git && cd circom
cargo install --path circom && cd ..
```

**Download Powers of Tau:**
```bash
wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_12.ptau -O pot12_final.ptau
```

**Setup:**
```bash
npm run build:circuit    # Compile vote.circom → .r1cs + .wasm
npm run setup            # Generate proving key (.zkey)
npm run export:vkey      # Export verification key
npm run export:verifier  # Generate real Solidity verifier (replaces stub)
npm run compile          # Recompile with real verifier
```

## 📡 Contract API

### Admin Functions
| Function | Description |
|----------|-------------|
| `setMerkleRoot(bytes32)` | Set voter eligibility root (one-time) |
| `submitTally(uint256[], uint256[8])` | Submit final results after voting ends |
| `transferAdmin(address)` | Transfer admin role |

### Voter Functions
| Function | Description |
|----------|-------------|
| `castVote(uint256[8], bytes32, bytes32)` | Cast a private vote with ZK proof |

### View Functions
| Function | Returns |
|----------|---------|
| `getResults()` | Vote counts per candidate (post-finalization) |
| `isVotingActive()` | `true` if voting is currently open |
| `getMerkleRoot()` | Current Merkle root |
| `timeRemaining()` | Seconds until voting ends |

## 🛠 Scripts

```bash
npm run compile          # Compile Solidity contracts
npm test                 # Run Hardhat tests
npm run test:coverage    # Coverage report
npm run deploy           # Deploy to Sepolia testnet
npm run deploy:local     # Deploy to local Hardhat node
npm run node             # Start local Hardhat node
npm run build            # TypeScript compile
npm run clean            # Clean build artifacts
```

## 🔐 Security Notes

- **Private keys** are never shared — MPC distributes secret shares across parties
- **Nullifiers** cryptographically prevent double voting on-chain
- **Merkle tree** (depth 20) supports up to ~1,048,576 voters
- ⚠️ The stub `Verifier.sol` always returns `true` — **replace with real verifier before mainnet**
- Always audit smart contracts before production deployment

## 📁 Project Structure

```
taceo-private-voting/
├── circuits/
│   └── vote.circom              # Main ZK voting circuit
├── contracts/
│   ├── PrivateVoting.sol        # Main voting contract
│   └── Verifier.sol             # Stub (replace after circuit setup)
├── src/
│   ├── index.ts                 # Client entry point + PrivateVotingClient
│   ├── prover.ts                # TACEO MPC proof generation
│   └── utils.ts                 # Poseidon hash + MerkleTree
├── scripts/
│   └── deploy.ts                # Deployment script
├── test/
│   └── PrivateVoting.test.ts    # Contract tests
├── .env.example                 # Environment template
├── hardhat.config.ts
└── tsconfig.json
```

## 🤝 Contributing

1. Fork the repo
2. Create a branch: `git checkout -b feat/my-feature`
3. Commit: `git commit -m 'feat: add feature'`
4. Push: `git push origin feat/my-feature`
5. Open a Pull Request

## 📄 License

MIT © 2024 [eyren](https://github.com/0xgetz)

## 🔗 Resources

- [TACEO Documentation](https://docs.taceo.io)
- [coCircom Quick Start](https://docs.taceo.io/cocircom)
- [Circom Documentation](https://docs.circom.io)
- [Hardhat Documentation](https://hardhat.org/docs)
- [snarkjs](https://github.com/iden3/snarkjs)
- [Ethers.js v6](https://docs.ethers.org/v6)
