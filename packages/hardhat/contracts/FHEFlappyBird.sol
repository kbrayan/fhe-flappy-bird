// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title FHEFlappyBird
 * @dev Players submit encrypted Flappy Bird high scores.
 * The contract stores each player's highest score in encrypted form.
 * Only the owner of the score can decrypt it.
 */
contract FHEFlappyBird is SepoliaConfig {
    // Encrypted highest score per user
    mapping(address => euint32) private _bestFlyScore;
    mapping(address => bool) private _hasSubmitted;

    /**
     * @notice Submit a new encrypted score for Flappy Bird.
     * @param encryptedScore The encrypted score value
     * @param proof Zero-knowledge proof for verification
     */
    function submitFlyScore(externalEuint32 encryptedScore, bytes calldata proof) external {
        euint32 currentScore = FHE.fromExternal(encryptedScore, proof);

        // Grant access to the player and this contract
        FHE.allow(currentScore, msg.sender);
        FHE.allowThis(currentScore);

        if (_hasSubmitted[msg.sender]) {
            euint32 previousBest = _bestFlyScore[msg.sender];
            euint32 topScore = FHE.select(FHE.gt(currentScore, previousBest), currentScore, previousBest);

            _bestFlyScore[msg.sender] = topScore;

            FHE.allow(_bestFlyScore[msg.sender], msg.sender);
            FHE.allowThis(_bestFlyScore[msg.sender]);
        } else {
            _bestFlyScore[msg.sender] = currentScore;
            _hasSubmitted[msg.sender] = true;

            FHE.allow(_bestFlyScore[msg.sender], msg.sender);
            FHE.allowThis(_bestFlyScore[msg.sender]);
        }
    }

    /**
     * @notice Retrieve the highest encrypted Flappy Bird score of a player.
     * @param player The player's address
     * @return The encrypted top score
     */
    function getBestScore(address player) external view returns (euint32) {
        require(_hasSubmitted[player], "Player has not submitted any score");
        return _bestFlyScore[player];
    }

    /**
     * @notice Check whether a player has any submitted score.
     * @param player The address to check
     * @return True if the player has a stored score
     */
    function hasSubmittedScore(address player) external view returns (bool) {
        return _hasSubmitted[player];
    }
}
