import { ethers } from 'ethers';
import { randomBytes } from 'crypto';
import { CoCircomProver } from './prover';
import { generateMerkleProof, poseidonHash, MerkleTree } from './utils';

// NOTE: PrivateVoting__factory is generated after running `npm run compile`
// import { PrivateVoting__factory } from '../typechain-types';

export interface VoteInput {
  voterSecret: bigint;
  voterNullifier: bigint;
  voteChoice: number;
  merkleProof: {
    pathElements: bigint[];
    pathIndices: number[];
  };
}

export interface TACEOConfig {
  parties: PartyConfig[];
  protocol: 'rep3' | 'shamir';
  proofService?: string;
}

export interface PartyConfig {
  id: number;
  endpoint: string;
  tlsCert?: string;
}

/**
 * Client for interacting with the PrivateVoting smart contract.
 * Handles proof generation via TACEO MPC and on-chain vote submission.
 */
export class PrivateVotingClient {
  private prover: CoCircomProver;
  private contract: ethers.Contract;
  private signer: ethers.Signer;

  constructor(
    contractAddress: string,
    contractAbi: ethers.InterfaceAbi,
    signer: ethers.Signer,
    taceoConfig: TACEOConfig
  ) {
    this.signer = signer;
    this.contract = new ethers.Contract(contractAddress, contractAbi, signer);
    this.prover = new CoCircomProver(taceoConfig);
  }

  /**
   * Register a voter by computing their Poseidon commitment.
   * The commitment should be added to the Merkle tree by the admin.
   */
  async registerVoter(secret: bigint, nullifier: bigint): Promise<bigint> {
    const commitment = await poseidonHash([secret, nullifier]);
    console.log(`✅ Voter commitment: ${commitment}`);
    return commitment;
  }

  /**
   * Cast a private vote using MPC-based ZK proof generation.
   */
  async castVote(input: VoteInput): Promise<ethers.TransactionReceipt | null> {
    console.log('🗳️  Preparing private vote...');
    const merkleRoot = await this.contract.merkleRoot();
    const nullifierHash = await poseidonHash([input.voterNullifier, BigInt(merkleRoot)]);

    console.log('🔐 Generating collaborative ZK proof via MPC...');
    const witness = {
      voterSecret: input.voterSecret.toString(),
      voterNullifier: input.voterNullifier.toString(),
      voteChoice: input.voteChoice.toString(),
      merklePathElements: input.merkleProof.pathElements.map((e) => e.toString()),
      merklePathIndices: input.merkleProof.pathIndices,
      merkleRoot: merkleRoot.toString(),
      nullifierHash: nullifierHash.toString(),
    };

    const { proof } = await this.prover.generateProof(witness);
    console.log('✅ Proof generated successfully');
    console.log('📤 Submitting vote to blockchain...');

    const solidityProof = this.formatProofForSolidity(proof);
    const voteCommitment = await poseidonHash([input.voterSecret, BigInt(input.voteChoice)]);

    const tx = await this.contract.castVote(
      solidityProof,
      ethers.zeroPadValue(ethers.toBeHex(nullifierHash), 32),
      ethers.zeroPadValue(ethers.toBeHex(voteCommitment), 32)
    );

    console.log(`📝 Transaction submitted: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log('✅ Vote cast successfully!');
    return receipt;
  }

  private formatProofForSolidity(proof: {
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
  }): bigint[] {
    return [
      BigInt(proof.pi_a[0]), BigInt(proof.pi_a[1]),
      BigInt(proof.pi_b[0][1]), BigInt(proof.pi_b[0][0]),
      BigInt(proof.pi_b[1][1]), BigInt(proof.pi_b[1][0]),
      BigInt(proof.pi_c[0]), BigInt(proof.pi_c[1]),
    ];
  }

  async isVotingActive(): Promise<boolean> {
    const startTime = await this.contract.votingStartTime();
    const endTime = await this.contract.votingEndTime();
    const ended = await this.contract.votingEnded();
    const now = BigInt(Math.floor(Date.now() / 1000));
    return now >= startTime && now <= endTime && !ended;
  }

  async getResults(): Promise<bigint[]> {
    return await this.contract.getResults();
  }

  async getMerkleProof(commitment: bigint, tree?: MerkleTree) {
    return generateMerkleProof(commitment, tree);
  }
}

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

  const taceoConfig: TACEOConfig = {
    protocol: 'rep3',
    parties: [
      { id: 0, endpoint: process.env.PARTY0_ENDPOINT || 'https://party0.taceo.io:50000' },
      { id: 1, endpoint: process.env.PARTY1_ENDPOINT || 'https://party1.taceo.io:50001' },
      { id: 2, endpoint: process.env.PARTY2_ENDPOINT || 'https://party2.taceo.io:50002' },
    ],
    proofService: process.env.TACEO_PROOF_ENDPOINT,
  };

  console.log('🤖 TACEO Private Voting Client v2.0.0');
  console.log('📡 Connected to:', process.env.RPC_URL);
  console.log('🔐 Protocol:', taceoConfig.protocol);

  const voterSecret = BigInt('0x' + randomBytes(31).toString('hex'));
  const voterNullifier = BigInt('0x' + randomBytes(31).toString('hex'));

  console.log('\n📋 Generating voter commitment...');
  const commitment = await poseidonHash([voterSecret, voterNullifier]);
  console.log(`   Commitment: ${commitment}`);
  console.log('\n✅ Ready! Configure CONTRACT_ADDRESS and ABI to cast votes.');
}

main().catch(console.error);
