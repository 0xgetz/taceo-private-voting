import { buildPoseidon } from 'circomlibjs';

let poseidon: any = null;

export async function initPoseidon(): Promise<void> {
    if (!poseidon) {
        poseidon = await buildPoseidon();
    }
}

export async function poseidonHash(inputs: bigint[]): Promise<bigint> {
    await initPoseidon();
    const hash = poseidon(inputs.map(i => poseidon.F.e(i)));
    return BigInt(poseidon.F.toString(hash));
}

export interface MerkleProof {
    pathElements: bigint[];
    pathIndices: number[];
}

export class MerkleTree {
    private leaves: bigint[];
    private layers: bigint[][];
    private depth: number;
    
    constructor(depth: number, leaves: bigint[] = []) {
        this.depth = depth;
        this.leaves = [...leaves];
        this.layers = [];
        
        const size = 2 ** depth;
        while (this.leaves.length < size) {
            this.leaves.push(BigInt(0));
        }
        
        this.buildTree();
    }
    
    private async buildTree(): Promise<void> {
        await initPoseidon();
        
        this.layers = [this.leaves];
        
        let currentLayer = this.leaves;
        for (let i = 0; i < this.depth; i++) {
            const nextLayer: bigint[] = [];
            
            for (let j = 0; j < currentLayer.length; j += 2) {
                const hash = await poseidonHash([currentLayer[j], currentLayer[j + 1]]);
                nextLayer.push(hash);
            }
            
            this.layers.push(nextLayer);
            currentLayer = nextLayer;
        }
    }
    
    getRoot(): bigint {
        return this.layers[this.layers.length - 1][0];
    }
    
    getProof(leafIndex: number): MerkleProof {
        const pathElements: bigint[] = [];
        const pathIndices: number[] = [];
        
        let index = leafIndex;
        for (let i = 0; i < this.depth; i++) {
            const siblingIndex = index % 2 === 0 ? index + 1 : index - 1;
            pathElements.push(this.layers[i][siblingIndex]);
            pathIndices.push(index % 2);
            index = Math.floor(index / 2);
        }
        
        return { pathElements, pathIndices };
    }
    
    addLeaf(leaf: bigint): number {
        const index = this.leaves.findIndex(l => l === BigInt(0));
        if (index === -1) throw new Error('Tree is full');
        
        this.leaves[index] = leaf;
        this.buildTree();
        
        return index;
    }
}

export async function generateMerkleProof(
    commitment: bigint,
    existingTree?: MerkleTree
): Promise<MerkleProof> {
    const tree = existingTree || new MerkleTree(20);
    const leafIndex = 0;
    return tree.getProof(leafIndex);
}
