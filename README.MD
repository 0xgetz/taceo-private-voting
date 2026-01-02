TACEO Private Voting dApp
A privacy-preserving voting application built with TACEO's collaborative SNARK tooling, enabling secure multi-party computation (MPC) for zero-knowledge proof generation.
Overview
This project demonstrates how to build a decentralized application (dApp) that leverages TACEO's private computation infrastructure. Voters can cast ballots without revealing their identity or vote choice, while the system maintains verifiability and prevents double voting.
Key Features

* Complete Privacy: Vote choices and voter identities are hidden using ZK-SNARKs
* Collaborative Proof Generation: Uses coCircom for MPC-based proof generation across multiple parties
* Double-Vote Prevention: Nullifier mechanism ensures each eligible voter can only vote once
* On-Chain Verification: Smart contracts verify proofs without learning private information
* Scalable Architecture: Supports TACEO:Proof service for offloaded computation

Architecture
┌─────────────────────────────────────────────────────────────────┐
│                         Client Application                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Voter     │  │   Merkle    │  │    Proof Generation     │  │
│  │ Credentials │  │    Tree     │  │   (via MPC/coCircom)    │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      TACEO MPC Infrastructure                    │
├─────────────┬─────────────┬─────────────┬───────────────────────┤
│   Party 0   │   Party 1   │   Party 2   │    TACEO:Proof        │
│  (Share 1)  │  (Share 2)  │  (Share 3)  │    (Optional)         │
└─────────────┴─────────────┴─────────────┴───────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Blockchain Layer                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐  ┌─────────────────────────────────┐   │
│  │   Groth16 Verifier  │  │      PrivateVoting Contract     │   │
│  └─────────────────────┘  └─────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘

Project Structure
taceo-private-voting-dapp/
├── circuits/
│   ├── vote.circom              # Main voting circuit
│   ├── tally.circom             # Vote tallying circuit
│   └── lib/
│       └── merkle.circom        # Merkle tree verification
├── co-circom/
│   ├── config.toml              # MPC configuration
│   └── input/
│       └── parties/             # Party-specific inputs
├── contracts/
│   ├── PrivateVoting.sol        # Main voting contract
│   └── Verifier.sol             # Auto-generated verifier
├── src/
│   ├── index.ts                 # Application entry point
│   ├── prover.ts                # MPC proof generation
│   ├── verifier.ts              # Proof verification utilities
│   └── utils.ts                 # Helper functions
├── test/
│   └── PrivateVoting.test.ts    # Test suite
├── scripts/
│   └── deploy.ts                # Deployment script
├── package.json
├── hardhat.config.ts
└── README.md

Prerequisites

* Node.js v18 or higher
* Rust (for circom compilation)
* Git
* Access to TACEO MPC infrastructure (for production)
#Instalation 
# Clone the repository
git clone https://github.com/yourusername/taceo-private-voting.git
cd taceo-private-voting

# Install dependencies
npm install

# Install circom (if not already installed)
curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh
git clone https://github.com/iden3/circom.git
cd circom
cargo build --release
cargo install --path circom
cd ..
