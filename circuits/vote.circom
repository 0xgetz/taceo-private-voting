pragma circom 2.1.6;

include "node_modules/circomlib/circuits/comparators.circom";
include "node_modules/circomlib/circuits/poseidon.circom";

template PrivateVote(nCandidates, merkleDepth) {
    // Private inputs (secret-shared via MPC)
    signal input voterSecret;
    signal input voterNullifier;
    signal input voteChoice;
    signal input merklePathElements[merkleDepth];
    signal input merklePathIndices[merkleDepth];
    
    // Public inputs
    signal input merkleRoot;
    signal input nullifierHash;
    
    // Outputs
    signal output validVote;
    signal output commitmentOut;
    
    // 1. Compute voter commitment = Poseidon(secret, nullifier)
    component commitmentHasher = Poseidon(2);
    commitmentHasher.inputs[0] <== voterSecret;
    commitmentHasher.inputs[1] <== voterNullifier;
    
    signal voterCommitment;
    voterCommitment <== commitmentHasher.out;
    commitmentOut <== voterCommitment;
    
    // 2. Verify Merkle proof (voter is in eligible set)
    component merkleVerifier = MerkleTreeVerifier(merkleDepth);
    merkleVerifier.leaf <== voterCommitment;
    merkleVerifier.root <== merkleRoot;
    for (var i = 0; i < merkleDepth; i++) {
        merkleVerifier.pathElements[i] <== merklePathElements[i];
        merkleVerifier.pathIndices[i] <== merklePathIndices[i];
    }
    
    // 3. Verify nullifier hash for double-vote prevention
    component nullifierHasher = Poseidon(2);
    nullifierHasher.inputs[0] <== voterNullifier;
    nullifierHasher.inputs[1] <== merkleRoot;
    nullifierHasher.out === nullifierHash;
    
    // 4. Validate vote choice is within range
    component validChoice = LessThan(8);
    validChoice.in[0] <== voteChoice;
    validChoice.in[1] <== nCandidates;
    validChoice.out === 1;
    
    // 5. Output validity flag
    validVote <== merkleVerifier.valid;
}

template MerkleTreeVerifier(depth) {
    signal input leaf;
    signal input root;
    signal input pathElements[depth];
    signal input pathIndices[depth];
    signal output valid;
    
    component hashers[depth];
    signal levelHashes[depth + 1];
    levelHashes[0] <== leaf;
    
    for (var i = 0; i < depth; i++) {
        hashers[i] = Poseidon(2);
        
        signal left, right;
        left <== levelHashes[i] + pathIndices[i] * (pathElements[i] - levelHashes[i]);
        right <== pathElements[i] + pathIndices[i] * (levelHashes[i] - pathElements[i]);
        
        hashers[i].inputs[0] <== left;
        hashers[i].inputs[1] <== right;
        levelHashes[i + 1] <== hashers[i].out;
    }
    
    component isEqual = IsEqual();
    isEqual.in[0] <== levelHashes[depth];
    isEqual.in[1] <== root;
    valid <== isEqual.out;
}

component main {public [merkleRoot, nullifierHash]} = PrivateVote(5, 20);
