// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IVerifier
/// @notice Interface for the auto-generated Groth16 verifier
/// @dev Run `npm run export:verifier` to generate the real verifier
interface IVerifier {
    function verifyProof(
        uint256[2] calldata _pA,
        uint256[2][2] calldata _pB,
        uint256[2] calldata _pC,
        uint256[2] calldata _pubSignals
    ) external view returns (bool);
}

/// @title PrivateVoting
/// @author eyren (@0xgetz)
/// @notice Privacy-preserving voting contract using ZK-SNARKs (Groth16) and TACEO MPC
/// @dev Uses Poseidon hash for commitments/nullifiers, Merkle tree for voter eligibility
contract PrivateVoting {
    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    /// @notice Emitted when a vote is successfully cast
    event VoteCast(bytes32 indexed nullifierHash, uint256 timestamp);

    /// @notice Emitted when voting is finalized
    event VotingFinalized(uint256[] results, uint256 timestamp);

    /// @notice Emitted when the Merkle root is set
    event MerkleRootSet(bytes32 indexed root);

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    /// @notice The Groth16 verifier contract
    IVerifier public immutable verifier;

    /// @notice Merkle root of eligible voter commitments
    bytes32 public merkleRoot;

    /// @notice Tracks used nullifiers to prevent double voting
    mapping(bytes32 => bool) public nullifierUsed;

    /// @notice Vote counts per candidate (0-indexed)
    mapping(uint256 => uint256) public voteCounts;

    /// @notice Voting start timestamp (Unix)
    uint256 public immutable votingStartTime;

    /// @notice Voting end timestamp (Unix)
    uint256 public immutable votingEndTime;

    /// @notice Number of candidates
    uint256 public immutable candidateCount;

    /// @notice Whether voting has been finalized
    bool public votingEnded;

    /// @notice Contract administrator
    address public admin;

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------

    modifier onlyAdmin() {
        require(msg.sender == admin, "PrivateVoting: not admin");
        _;
    }

    modifier votingActive() {
        require(block.timestamp >= votingStartTime, "PrivateVoting: voting not started");
        require(block.timestamp <= votingEndTime, "PrivateVoting: voting period ended");
        require(!votingEnded, "PrivateVoting: voting finalized");
        _;
    }

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /// @notice Deploy the PrivateVoting contract
    /// @param _verifier Address of the deployed Groth16 verifier
    /// @param _candidateCount Number of candidates (immutable)
    /// @param _votingDuration Duration of voting period in seconds
    constructor(
        address _verifier,
        uint256 _candidateCount,
        uint256 _votingDuration
    ) {
        require(_verifier != address(0), "PrivateVoting: zero verifier address");
        require(_candidateCount > 0, "PrivateVoting: candidate count must be > 0");
        require(_votingDuration > 0, "PrivateVoting: duration must be > 0");

        verifier = IVerifier(_verifier);
        candidateCount = _candidateCount;
        admin = msg.sender;
        votingStartTime = block.timestamp;
        votingEndTime = block.timestamp + _votingDuration;
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    /// @notice Set the Merkle root of eligible voters (one-time only)
    /// @param _root Poseidon Merkle root
    function setMerkleRoot(bytes32 _root) external onlyAdmin {
        require(merkleRoot == bytes32(0), "PrivateVoting: root already set");
        require(_root != bytes32(0), "PrivateVoting: zero root");
        merkleRoot = _root;
        emit MerkleRootSet(_root);
    }

    /// @notice Transfer admin role to a new address
    /// @param _newAdmin New administrator address
    function transferAdmin(address _newAdmin) external onlyAdmin {
        require(_newAdmin != address(0), "PrivateVoting: zero address");
        admin = _newAdmin;
    }

    // -------------------------------------------------------------------------
    // Voting
    // -------------------------------------------------------------------------

    /// @notice Cast a private vote with a ZK-SNARK proof
    /// @param _proof Groth16 proof array [pA[0], pA[1], pB[0][1], pB[0][0], pB[1][1], pB[1][0], pC[0], pC[1]]
    /// @param _nullifierHash Unique nullifier preventing double voting
    /// @param _voteCommitment Encrypted vote commitment
    function castVote(
        uint256[8] calldata _proof,
        bytes32 _nullifierHash,
        bytes32 _voteCommitment
    ) external votingActive {
        require(merkleRoot != bytes32(0), "PrivateVoting: merkle root not set");
        require(!nullifierUsed[_nullifierHash], "PrivateVoting: already voted");

        uint256[2] memory pubSignals = [
            uint256(merkleRoot),
            uint256(_nullifierHash)
        ];

        require(
            verifier.verifyProof(
                [_proof[0], _proof[1]],
                [[_proof[2], _proof[3]], [_proof[4], _proof[5]]],
                [_proof[6], _proof[7]],
                pubSignals
            ),
            "PrivateVoting: invalid proof"
        );

        nullifierUsed[_nullifierHash] = true;
        emit VoteCast(_nullifierHash, block.timestamp);
    }

    /// @notice Submit final vote tally (admin only, after voting ends)
    /// @param _results Vote counts per candidate
    /// @param _tallyProof Reserved for future ZK tally verification
    function submitTally(
        uint256[] calldata _results,
        uint256[8] calldata _tallyProof
    ) external onlyAdmin {
        require(block.timestamp > votingEndTime, "PrivateVoting: voting not ended");
        require(!votingEnded, "PrivateVoting: already finalized");
        require(_results.length == candidateCount, "PrivateVoting: invalid results length");

        for (uint256 i = 0; i < candidateCount; i++) {
            voteCounts[i] = _results[i];
        }

        votingEnded = true;
        emit VotingFinalized(_results, block.timestamp);
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    /// @notice Get voting results (only after finalization)
    /// @return results Array of vote counts per candidate
    function getResults() external view returns (uint256[] memory results) {
        require(votingEnded, "PrivateVoting: voting not finalized");
        results = new uint256[](candidateCount);
        for (uint256 i = 0; i < candidateCount; i++) {
            results[i] = voteCounts[i];
        }
    }

    /// @notice Check whether voting is currently active
    function isVotingActive() external view returns (bool) {
        return block.timestamp >= votingStartTime
            && block.timestamp <= votingEndTime
            && !votingEnded;
    }

    /// @notice Get current Merkle root
    function getMerkleRoot() external view returns (bytes32) {
        return merkleRoot;
    }

    /// @notice Get remaining voting time in seconds (0 if ended)
    function timeRemaining() external view returns (uint256) {
        if (block.timestamp >= votingEndTime) return 0;
        return votingEndTime - block.timestamp;
    }
}
