import { groth16 } from 'snarkjs';
import * as fs from 'fs';
import * as path from 'path';

interface TACEOConfig {
    parties: Array<{
        id: number;
        endpoint: string;
        tlsCert?: string;
    }>;
    protocol: 'rep3' | 'shamir';
    proofService?: string;
}

interface ProofResult {
    proof: {
        pi_a: string[];
        pi_b: string[][];
        pi_c: string[];
        protocol: string;
    };
    publicSignals: string[];
}

interface SecretShare {
    partyId: number;
    share: bigint;
}

export class CoCircomProver {
    private config: TACEOConfig;
    private wasmPath: string;
    private zkeyPath: string;
    
    constructor(config: TACEOConfig) {
        this.config = config;
        this.wasmPath = path.join(__dirname, '../circuits/vote_js/vote.wasm');
        this.zkeyPath = path.join(__dirname, '../keys/vote.zkey');
    }
    
    /**
     * Generate proof using collaborative SNARK via MPC
     */
    async generateProof(witness: Record<string, any>): Promise<ProofResult> {
        console.log('🔄 Initiating MPC proof generation...');
        
        const privateInputs = this.extractPrivateInputs(witness);
        const shares = await this.secretShare(privateInputs);
        
        await this.distributeShares(shares);
        
        if (this.config.proofService) {
            return await this.generateViaProofService(witness);
        } else {
            return await this.generateViaMPC(witness);
        }
    }
    
    private extractPrivateInputs(witness: Record<string, any>): Record<string, bigint> {
        return {
            voterSecret: BigInt(witness.voterSecret),
            voterNullifier: BigInt(witness.voterNullifier),
            voteChoice: BigInt(witness.voteChoice)
        };
    }
    
    private async secretShare(
        inputs: Record<string, bigint>
    ): Promise<Map<string, SecretShare[]>> {
        const shares = new Map<string, SecretShare[]>();
        const prime = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
        
        for (const [key, value] of Object.entries(inputs)) {
            const inputShares: SecretShare[] = [];
            
            if (this.config.protocol === 'rep3') {
                const r1 = this.randomFieldElement(prime);
                const r2 = this.randomFieldElement(prime);
                const r3 = ((value - r1 - r2) % prime + prime) % prime;
                
                inputShares.push(
                    { partyId: 0, share: r1 },
                    { partyId: 1, share: r2 },
                    { partyId: 2, share: r3 }
                );
            } else {
                const threshold = Math.ceil(this.config.parties.length / 2);
                const polynomial = this.generatePolynomial(value, threshold - 1, prime);
                
                for (const party of this.config.parties) {
                    const x = BigInt(party.id + 1);
                    const share = this.evaluatePolynomial(polynomial, x, prime);
                    inputShares.push({ partyId: party.id, share });
                }
            }
            
            shares.set(key, inputShares);
        }
        
        return shares;
    }
    
    private async distributeShares(
        shares: Map<string, SecretShare[]>
    ): Promise<void> {
        const partyPayloads = new Map<number, Record<string, string>>();
        
        for (const [inputName, inputShares] of shares) {
            for (const share of inputShares) {
                if (!partyPayloads.has(share.partyId)) {
                    partyPayloads.set(share.partyId, {});
                }
                partyPayloads.get(share.partyId)![inputName] = share.share.toString();
            }
        }
        
        const sendPromises = this.config.parties.map(async (party) => {
            const payload = partyPayloads.get(party.id);
            if (!payload) return;
            
            const response = await fetch(`${party.endpoint}/api/v1/shares`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-ID': this.generateSessionId()
                },
                body: JSON.stringify({
                    sessionId: this.generateSessionId(),
                    shares: payload
                })
            });
            
            if (!response.ok) {
                throw new Error(`Failed to send shares to party ${party.id}`);
            }
        });
        
        await Promise.all(sendPromises);
        console.log('✅ Shares distributed to all parties');
    }
    
    private async generateViaProofService(
        witness: Record<string, any>
    ): Promise<ProofResult> {
        console.log('📡 Using TACEO:Proof service...');
        
        const response = await fetch(`${this.config.proofService}/api/v1/prove`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.TACEO_API_KEY}`
            },
            body: JSON.stringify({
                circuit: 'vote',
                publicInputs: {
                    merkleRoot: witness.merkleRoot,
                    nullifierHash: witness.nullifierHash
                },
                sessionId: this.generateSessionId(),
                parties: this.config.parties.map(p => p.id)
            })
        });
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Proof service error: ${error}`);
        }
        
        return await response.json();
    }
    
    private async generateViaMPC(
        witness: Record<string, any>
    ): Promise<ProofResult> {
        console.log('🔗 Coordinating MPC proof generation...');
        
        const sessionId = this.generateSessionId();
        
        const initPromises = this.config.parties.map(async (party) => {
            const response = await fetch(`${party.endpoint}/api/v1/mpc/init`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId,
                    protocol: this.config.protocol,
                    circuit: 'vote',
                    publicInputs: {
                        merkleRoot: witness.merkleRoot,
                        nullifierHash: witness.nullifierHash
                    }
                })
            });
            
            return response.json();
        });
        
        await Promise.all(initPromises);
        
        let proof: ProofResult | null = null;
        let attempts = 0;
        const maxAttempts = 60;
        
        while (!proof && attempts < maxAttempts) {
            const statusResponse = await fetch(
                `${this.config.parties[0].endpoint}/api/v1/mpc/status/${sessionId}`
            );
            const status = await statusResponse.json();
            
            if (status.state === 'completed') {
                proof = status.result;
            } else if (status.state === 'failed') {
                throw new Error(`MPC failed: ${status.error}`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
        }
        
        if (!proof) {
            throw new Error('MPC proof generation timed out');
        }
        
        return proof;
    }
    
    /**
     * Generate proof locally (for testing only)
     */
    async generateLocalProof(witness: Record<string, any>): Promise<ProofResult> {
        console.log('⚠️  Generating local proof (testing only)...');
        
        const { proof, publicSignals } = await groth16.fullProve(
            witness,
            this.wasmPath,
            this.zkeyPath
        );
        
        return { proof, publicSignals };
    }
    
    private randomFieldElement(prime: bigint): bigint {
        const bytes = new Uint8Array(32);
        crypto.getRandomValues(bytes);
        let value = BigInt(0);
        for (const byte of bytes) {
            value = (value << BigInt(8)) + BigInt(byte);
        }
        return value % prime;
    }
    
    private generatePolynomial(
        secret: bigint,
        degree: number,
        prime: bigint
    ): bigint[] {
        const coefficients = [secret];
        for (let i = 0; i < degree; i++) {
            coefficients.push(this.randomFieldElement(prime));
        }
        return coefficients;
    }
    
    private evaluatePolynomial(
        coefficients: bigint[],
        x: bigint,
        prime: bigint
    ): bigint {
        let result = BigInt(0);
        let xPower = BigInt(1);
        
        for (const coef of coefficients) {
            result = (result + coef * xPower) % prime;
            xPower = (xPower * x) % prime;
        }
        
        return result;
    }
    
    private generateSessionId(): string {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
