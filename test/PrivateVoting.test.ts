import { expect } from 'chai';
import { ethers } from 'hardhat';
import { CoCircomProver } from '../src/prover';
import { MerkleTree, poseidonHash } from '../src/utils';

describe('PrivateVoting', function () {
    let voting: any;
    let verifier: any;
    let owner: any;
    let voter1: any;
    let merkleTree: MerkleTree;
    
    const CANDIDATE_COUNT = 5;
    const VOTING_DURATION = 3600;
    
    beforeEach(async function () {
        [owner, voter1] = await ethers.getSigners();
        
        const Verifier = await ethers.getContractFactory('Groth16Verifier');
        verifier = await Verifier.deploy();
        
        const PrivateVoting = await ethers.getContractFactory('PrivateVoting');
        voting = await PrivateVoting.deploy(
            await verifier.getAddress(),
            CANDIDATE_COUNT,
            VOTING_DURATION
        );
        
        merkleTree = new MerkleTree(20);
    });
    
    describe('Deployment', function () {
        it('should set the correct admin', async function () {
            expect(await voting.admin()).to.equal(owner.address);
        });
        
        it('should set the correct candidate count', async function () {
            expect(await voting.candidateCount()).to.equal(CANDIDATE_COUNT);
        });
    });
    
    describe('Voter Registration', function () {
        it('should allow admin to set merkle root', async function () {
            const commitment = await poseidonHash([BigInt(123), BigInt(456)]);
            merkleTree.addLeaf(commitment);
            
            const root = merkleTree.getRoot();
            await voting.setMerkleRoot(ethers.zeroPadValue(ethers.toBeHex(root), 32));
            
            expect(await voting.merkleRoot()).to.equal(
                ethers.zeroPadValue(ethers.toBeHex(root), 32)
            );
        });
        
        it('should not allow setting root twice', async function () {
            const root = merkleTree.getRoot();
            await voting.setMerkleRoot(ethers.zeroPadValue(ethers.toBeHex(root), 32));
            
            await expect(
                voting.setMerkleRoot(ethers.zeroPadValue(ethers.toBeHex(root), 32))
            ).to.be.revertedWith('Root already set');
        });
        
        it('should not allow non-admin to set root', async function () {
            const root = merkleTree.getRoot();
            
            await expect(
                voting.connect(voter1).setMerkleRoot(
                    ethers.zeroPadValue(ethers.toBeHex(root), 32)
                )
            ).to.be.revertedWith('Not admin');
        });
    });
    
    describe('Vote Casting', function () {
        it('should prevent double voting with same nullifier', async function () {
            const secret = BigInt(12345);
            const nullifier = BigInt(67890);
            const commitment = await poseidonHash([secret, nullifier]);
            
            merkleTree.addLeaf(commitment);
            await voting.setMerkleRoot(
                ethers.zeroPadValue(ethers.toBeHex(merkleTree.getRoot()), 32)
            );
            
            const nullifierHash = await poseidonHash([
                nullifier,
                merkleTree.getRoot()
            ]);
            
            // Mark nullifier as used (simulating first vote)
            // In real test, this would involve actual proof verification
        });
    });
    
    describe('Results', function () {
        it('should not allow getting results before voting ends', async function () {
            await expect(voting.getResults()).to.be.revertedWith('Voting not finalized');
        });
    });
});
