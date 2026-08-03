// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IIdentityRegistry.sol";

/**
 * @title IdentityRegistry
 * @dev ERC-3643 身份注册表实现
 * 链上只存 keccak256(userId + KYC状态 + 随机盐)，不存明文KYC数据
 */
contract IdentityRegistry is IIdentityRegistry {
    address public owner;
    mapping(address => bool) private _agents;
    mapping(address => bool) private _verified;
    mapping(address => bytes32) private _identityHashes;
    mapping(address => uint16) private _countries;

    modifier onlyOwner() {
        require(msg.sender == owner, "IdentityRegistry: caller is not owner");
        _;
    }

    modifier onlyAgent() {
        require(_agents[msg.sender] || msg.sender == owner, "IdentityRegistry: caller is not agent");
        _;
    }

    constructor() {
        owner = msg.sender;
        _agents[msg.sender] = true;
    }

    function isVerified(address investor) external view override returns (bool) {
        return _verified[investor];
    }

    function investorCountry(address investor) external view override returns (uint16) {
        return _countries[investor];
    }

    function identityHash(address investor) external view override returns (bytes32) {
        return _identityHashes[investor];
    }

    function registerIdentity(
        address investor,
        bytes32 identityHash_,
        uint16 countryCode
    ) external override onlyAgent {
        require(investor != address(0), "IdentityRegistry: zero address");
        require(identityHash_ != bytes32(0), "IdentityRegistry: empty hash");
        require(!_verified[investor], "IdentityRegistry: already registered");

        _verified[investor] = true;
        _identityHashes[investor] = identityHash_;
        _countries[investor] = countryCode;

        emit IdentityRegistered(investor, identityHash_, countryCode);
    }

    function updateIdentity(
        address investor,
        bytes32 identityHash_,
        uint16 countryCode
    ) external override onlyAgent {
        require(_verified[investor], "IdentityRegistry: not registered");

        _identityHashes[investor] = identityHash_;
        _countries[investor] = countryCode;

        emit IdentityUpdated(investor, identityHash_, countryCode);
    }

    function removeIdentity(address investor) external override onlyAgent {
        require(_verified[investor], "IdentityRegistry: not registered");

        _verified[investor] = false;
        delete _identityHashes[investor];
        delete _countries[investor];

        emit IdentityRemoved(investor);
    }

    function addAgent(address agent) external override onlyOwner {
        require(agent != address(0), "IdentityRegistry: zero address");
        _agents[agent] = true;
        emit AgentAdded(agent);
    }

    function removeAgent(address agent) external override onlyOwner {
        _agents[agent] = false;
        emit AgentRemoved(agent);
    }

    function isAgent(address account) external view override returns (bool) {
        return _agents[account];
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "IdentityRegistry: zero address");
        owner = newOwner;
    }
}
