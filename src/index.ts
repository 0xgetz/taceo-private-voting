import { ethers } from 'ethers';
import { CoCircomProver } from './prover';
import { generateMerkleProof, poseidonHash } from './utils';
import { PrivateVoting__factory } from './typechain';

interface VoteInput {
    voterSecret: bigint;
    voterNullifier: bigint;
    voteChoice: number;
    merkleProof: {
        pathElements: bigint[];
        pathIndices: number[];
    };
}

interface TACEOConfig {
    parties: PartyConfig[];
    protocol: 'rep3' | 'shamir';
    proofService?: string;
}

interface PartyConfig {
    id: number;
    endpoint: string;
    tlsCert?: string;
}

class PrivateVotingClient {
    private prover: CoCircomProver;
    private contract: ethers.Contract;
    private signer: ethers.Signer;
    
    constructor(
        contractAddress: string,
        signer: ethers.Signer,
        taceoConfig: TACEOConfig
    ) {
        this.signer = signer;
        this.contract = PrivateVoting__factory.connect(contractAddress, signer);
        this.prover = new CoCircomProver(taceoConfig);
    }
    
    /**
     * Register a voter by computing their commitment
     */
    async registerVoter(secret: bigint, nullifier: bigint): Promise<bigint> {
        const commitment = await poseidonHash([secret, nullifier]);
        console.log(`Voter commitment: ${commitment}`);
        return commitment;
    }
    
    /**
     * Cast a private vote using MPC-based proof generation
     */
    async castVote(input: VoteInput): Promise<ethers.TransactionReceipt> {
        console.log('🗳️  Preparing private vote...');
        
        const merkleRoot = await this.contract.merkleRoot();
        
        const nullifierHash = await poseidonHash([
            input.voterNullifier,
            BigInt(merkleRoot)
        ]);
        
        console.log('🔐 Generating collaborative ZK proof via MPC...');
        
        const witness = {
            voterSecret: input.voterSecret.toString(),
            voterNullifier: input.voterNullifier.toString(),
            voteChoice: input.voteChoice.toString(),
            merklePathElements: input.merkleProof.pathElements.map(e => e.toString()),
            merklePathIndices: input.merkleProof.pathIndices,
            merkleRoot: merkleRoot.toString(),
            nullifierHash: nullifierHash.toString()
        };
        
        const { proof, publicSignals } = await this.prover.generateProof(witness);
        
        console.log('✅ Proof generated successfully');
        console.log('📤 Submitting vote to blockchain...');
        
        const solidityProof = this.formatProofForSolidity(proof);
        
        const voteCommitment = await poseidonHash([
            input.voterSecret,
            BigInt(input.voteChoice)
        ]);
        
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
    
    private formatProofForSolidity(proof: any): bigint[] {
        return [
            BigInt(proof.pi_a[0]),
            BigInt(proof.pi_a[1]),
            BigInt(proof.pi_b[0][1]),
            BigInt(proof.pi_b[0][0]),
            BigInt(proof.pi_b[1][1]),
            BigInt(proof.pi_b[1][0]),
            BigInt(proof.pi_c[0]),
            BigInt(proof.pi_c[1])
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
}

async function main() {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
    
    const taceoConfig: TACEOConfig = {
        protocol: 'rep3',
        parties: [
            { id: 0, endpoint: 'https://party0.taceo.io:50000' },
            { id: 1, endpoint: 'https://party1.taceo.io:50001' },
            { id: 2, endpoint: 'https://party2.taceo.io:50002' }
        ],
        proofService: 'https://proof.taceo.io'
    };
    
    const client = new PrivateVotingClient(
        process.env.CONTRACT_ADDRESS!,
        signer,
        taceoConfig
    );
    
    const voterSecret = BigInt('0x' + crypto.randomBytes(31).toString('hex'));
    const voterNullifier = BigInt('0x' + crypto.randomBytes(31).toString('hex'));
    
    const commitment = await client.registerVoter(voterSecret, voterNullifier);
    console.log(`Registered with commitment: ${commitment}`);
    
    const merkleProof = await generateMerkleProof(commitment);
    
    const receipt = await client.castVote({
        voterSecret,
        voterNullifier,
        voteChoice: 2,
        merkleProof
    });
    
    console.log(`Vote recorded in block ${receipt.blockNumber}`);
}

main().catch(console.error);

export { PrivateVotingClient, TACEOConfig, VoteInput };
