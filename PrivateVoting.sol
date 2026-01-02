// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./Verifier.sol";

contract PrivateVoting {
    // Events
    event VoteCast(bytes32 indexed nullifierHash, uint256 timestamp);
    event VotingEnded(uint256[] results);
    event VoterRegistered(bytes32 indexed commitment);
    
    // State variables
    Verifier public immutable verifier;
    bytes32 public merkleRoot;
    mapping(bytes32 => bool) public nullifierUsed;
    mapping(uint256 => uint256) public voteCounts;
    
    uint256 public votingStartTime;
    uint256 public votingEndTime;
    uint256 public immutable candidateCount;
    
    bool public votingEnded;
    address public admin;
    
    // Modifiers
    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }
    
    modifier votingActive() {
        require(block.timestamp >= votingStartTime, "Voting not started");
        require(block.timestamp <= votingEndTime, "Voting ended");
        require(!votingEnded, "Voting finalized");
        _;
    }
    
    constructor(
        address _verifier,
        uint256 _candidateCount,
        uint256 _votingDuration
    ) {
        verifier = Verifier(_verifier);
        candidateCount = _candidateCount;
        admin = msg.sender;
        votingStartTime = block.timestamp;
        votingEndTime = block.timestamp + _votingDuration;
    }
    
    /// @notice Set the Merkle root of eligible voters
    /// @param _root The Merkle root hash
    function setMerkleRoot(bytes32 _root) external onlyAdmin {
        require(merkleRoot == bytes32(0), "Root already set");
        merkleRoot = _root;
    }
    
    /// @notice Cast a private vote with ZK proof
    /// @param _proof The ZK-SNARK proof generated via coCircom MPC
    /// @param _nullifierHash Hash to prevent double voting
    /// @param _voteCommitment Encrypted vote commitment
    function castVote(
        uint256[8] calldata _proof,
        bytes32 _nullifierHash,
        bytes32 _voteCommitment
    ) external votingActive {
        require(!nullifierUsed[_nullifierHash], "Vote already cast");
        
        uint256[2] memory publicInputs;
        publicInputs[0] = uint256(merkleRoot);
        publicInputs[1] = uint256(_nullifierHash);
        
        require(
            verifier.verifyProof(
                [_proof[0], _proof[1]],
                [[_proof[2], _proof[3]], [_proof[4], _proof[5]]],
                [_proof[6], _proof[7]],
                publicInputs
            ),
            "Invalid proof"
        );
        
        nullifierUsed[_nullifierHash] = true;
        
        emit VoteCast(_nullifierHash, block.timestamp);
    }
    
    /// @notice Submit vote tally computed via MPC
    /// @param _results Array of vote counts per candidate
    /// @param _tallyProof Proof of correct tally computation
    function submitTally(
        uint256[] calldata _results,
        uint256[8] calldata _tallyProof
    ) external onlyAdmin {
        require(block.timestamp > votingEndTime, "Voting not ended");
        require(!votingEnded, "Already finalized");
        require(_results.length == candidateCount, "Invalid results length");
        
        for (uint256 i = 0; i < candidateCount; i++) {
            voteCounts[i] = _results[i];
        }
        
        votingEnded = true;
        emit VotingEnded(_results);
    }
    
    /// @notice Get voting results (only available after voting ends)
    /// @return Array of vote counts per candidate
    function getResults() external view returns (uint256[] memory) {
        require(votingEnded, "Voting not finalized");
        
        uint256[] memory results = new uint256[](candidateCount);
        for (uint256 i = 0; i < candidateCount; i++) {
            results[i] = voteCounts[i];
        }
        return results;
    }
}
