// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IIdentityRegistry
 * @dev ERC-3643 身份注册表接口
 * 存储链上身份哈希，不存明文KYC数据
 */
interface IIdentityRegistry {
    event IdentityRegistered(address indexed investor, bytes32 identityHash, uint16 countryCode);
    event IdentityUpdated(address indexed investor, bytes32 newIdentityHash, uint16 newCountryCode);
    event IdentityRemoved(address indexed investor);
    event AgentAdded(address indexed agent);
    event AgentRemoved(address indexed agent);

    function isVerified(address investor) external view returns (bool);
    function investorCountry(address investor) external view returns (uint16);
    function identityHash(address investor) external view returns (bytes32);
    function registerIdentity(address investor, bytes32 identityHash, uint16 countryCode) external;
    function updateIdentity(address investor, bytes32 identityHash, uint16 countryCode) external;
    function removeIdentity(address investor) external;
    function addAgent(address agent) external;
    function removeAgent(address agent) external;
    function isAgent(address account) external view returns (bool);
}
