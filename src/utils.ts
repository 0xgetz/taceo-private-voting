import { buildPoseidon } from 'circomlibjs';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let poseidonInstance: any = null;

export async function initPoseidon(): Promise<void> {
  if (!poseidonInstance) {
    poseidonInstance = await buildPoseidon();
  }
}

export async function poseidonHash(inputs: bigint[]): Promise<bigint> {
  await initPoseidon();
  const hash = poseidonInstance(inputs.map((i) => poseidonInstance.F.e(i)));
  return BigInt(poseidonInstance.F.toString(hash));
}

export interface MerkleProof {
  pathElements: bigint[];
  pathIndices: number[];
}

/**
 * Sparse Merkle Tree with Poseidon hashing.
 * Use MerkleTree.create() — the constructor is private (async factory pattern).
 */
export class MerkleTree {
  private leaves: bigint[];
  private layers: bigint[][];
  private depth: number;

  private constructor(depth: number, leaves: bigint[]) {
    this.depth = depth;
    this.leaves = leaves;
    this.layers = [];
  }

  /**
   * Create and fully initialize a MerkleTree.
   * @param depth Tree depth (e.g. 20 supports ~1M leaves)
   * @param initialLeaves Optional pre-existing leaves
   */
  static async create(depth: number, initialLeaves: bigint[] = []): Promise<MerkleTree> {
    await initPoseidon();
    const size = 2 ** depth;
    const leaves = [...initialLeaves];
    while (leaves.length < size) {
      leaves.push(BigInt(0));
    }
    const tree = new MerkleTree(depth, leaves);
    await tree.buildTree();
    return tree;
  }

  private async buildTree(): Promise<void> {
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

  async addLeaf(leaf: bigint): Promise<number> {
    const index = this.leaves.findIndex((l) => l === BigInt(0));
    if (index === -1) throw new Error('Merkle tree is full');
    this.leaves[index] = leaf;
    await this.buildTree();
    return index;
  }
}

export async function generateMerkleProof(
  commitment: bigint,
  existingTree?: MerkleTree
): Promise<MerkleProof> {
  const tree = existingTree ?? (await MerkleTree.create(20));
  return tree.getProof(0);
}
