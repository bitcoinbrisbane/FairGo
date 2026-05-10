// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ICoverageNFT} from "../interfaces/ICoverageNFT.sol";

/// @notice Test stand-in for the real CoverageNFT. Pool gets MINTER_ROLE.
contract MockCoverageNFT is ERC721, AccessControl, ICoverageNFT {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    uint256 private _nextId = 1;
    mapping(uint256 => bytes32) private _vehicle;

    constructor(address admin) ERC721("FairGo Coverage", "FGCOV") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function mint(address to, bytes32 vehicleHash)
        external
        override
        onlyRole(MINTER_ROLE)
        returns (uint256 tokenId)
    {
        tokenId = _nextId++;
        _safeMint(to, tokenId);
        _vehicle[tokenId] = vehicleHash;
    }

    function burn(uint256 tokenId) external override onlyRole(MINTER_ROLE) {
        _burn(tokenId);
        delete _vehicle[tokenId];
    }

    function ownerOf(uint256 tokenId) public view override(ERC721, ICoverageNFT) returns (address) {
        return ERC721.ownerOf(tokenId);
    }

    function vehicleHashOf(uint256 tokenId) external view override returns (bytes32) {
        return _vehicle[tokenId];
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
