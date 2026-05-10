// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ICoverageNFT {
    function mint(address to, bytes32 vehicleHash) external returns (uint256 tokenId);

    function burn(uint256 tokenId) external;

    function ownerOf(uint256 tokenId) external view returns (address);

    function vehicleHashOf(uint256 tokenId) external view returns (bytes32);
}
