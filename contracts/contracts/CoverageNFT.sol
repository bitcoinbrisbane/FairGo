// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

import {ICoverageNFT} from "./interfaces/ICoverageNFT.sol";

/// @title CoverageNFT
/// @notice Soulbound ERC-721 representing a member's FairGo coverage position.
///         One token per deposit, minted and burned by the pool, never
///         transferable between wallets. Implements EIP-5192 so wallets and
///         marketplaces can detect the lock.
contract CoverageNFT is ERC721, AccessControl, ICoverageNFT {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /// @dev EIP-5192. Emitted once per token at mint; never an Unlocked.
    event Locked(uint256 tokenId);

    error Soulbound();
    error ApprovalsDisabled();
    error ZeroAddress();

    uint256 private _nextId = 1;
    mapping(uint256 => bytes32) private _vehicle;

    constructor(address admin) ERC721("FairGo Coverage", "FGCOV") {
        if (admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // ---------------------------------------------------------------------
    // Mint / burn — pool only
    // ---------------------------------------------------------------------

    function mint(address to, bytes32 vehicleHash)
        external
        override
        onlyRole(MINTER_ROLE)
        returns (uint256 tokenId)
    {
        tokenId = _nextId++;
        _vehicle[tokenId] = vehicleHash;
        _safeMint(to, tokenId);
        emit Locked(tokenId);
    }

    function burn(uint256 tokenId) external override onlyRole(MINTER_ROLE) {
        delete _vehicle[tokenId];
        _burn(tokenId);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function ownerOf(uint256 tokenId) public view override(ERC721, ICoverageNFT) returns (address) {
        return ERC721.ownerOf(tokenId);
    }

    function vehicleHashOf(uint256 tokenId) external view override returns (bytes32) {
        return _vehicle[tokenId];
    }

    /// @notice EIP-5192. Every minted token is permanently locked.
    function locked(uint256 tokenId) external view returns (bool) {
        _requireOwned(tokenId);
        return true;
    }

    // ---------------------------------------------------------------------
    // Soulbound enforcement
    // ---------------------------------------------------------------------

    /// @dev Block every transfer; allow only mint (from == 0) and burn (to == 0).
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert Soulbound();
        return super._update(to, tokenId, auth);
    }

    function approve(address, uint256) public pure override {
        revert ApprovalsDisabled();
    }

    function setApprovalForAll(address, bool) public pure override {
        revert ApprovalsDisabled();
    }

    // ---------------------------------------------------------------------
    // ERC-165
    // ---------------------------------------------------------------------

    /// @dev EIP-5192 interface id is 0xb45a3c0e.
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC721, AccessControl)
        returns (bool)
    {
        return interfaceId == 0xb45a3c0e || super.supportsInterface(interfaceId);
    }
}
