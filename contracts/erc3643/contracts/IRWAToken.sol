// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IRWAToken
 * @dev ERC-3643 RWA代币接口
 * 继承ERC-20基础功能，增加合规检查、强制转账、分红、资产信息
 */
interface IRWAToken {
    // ERC-20 标准事件
    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);

    // ERC-3643 特有事件
    event TokenMinted(address indexed to, uint256 amount, bytes32 indexed assetId);
    event TokenBurned(address indexed from, uint256 amount, string reason);
    event ForcedTransfer(address indexed from, address indexed to, uint256 amount, string reason);
    event IdentityRegistrySet(address indexed registry);
    event ComplianceModuleSet(address indexed module);
    event DividendDistributed(uint256 totalAmount, uint256 timestamp);
    event NAVUpdated(uint256 oldNAV, uint256 newNAV, uint256 timestamp);
    event Paused(address indexed by);
    event Unpaused(address indexed by);

    // ERC-20 标准
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);

    // ERC-3643 核心
    function mint(address to, uint256 amount, bytes32 assetId) external;
    function burn(address from, uint256 amount, string calldata reason) external;
    function forcedTransfer(address from, address to, uint256 amount, string calldata reason) external;

    // 合规
    function setIdentityRegistry(address registry) external;
    function setComplianceModule(address module) external;

    // 资产信息
    function updateNAV(uint256 newNAV) external;

    // 紧急熔断
    function pause() external;
    function unpause() external;

    // 分红
    function distributeDividends(address token, uint256 totalAmount) external;

    // 权限
    function addAgent(address agent) external;
    function removeAgent(address agent) external;
    function isAgent(address account) external view returns (bool);
    function transferOwnership(address newOwner) external;
}
