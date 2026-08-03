// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IComplianceModule
 * @dev ERC-3643 合规模块接口
 * 每次转账前检查：白名单、持仓上限、锁定期、司法管辖区
 */
interface IComplianceModule {
    event ComplianceCheckFailed(address indexed from, address indexed to, uint256 value, string reason);
    event ComplianceRuleAdded(bytes32 indexed ruleId, string description);
    event ComplianceRuleRemoved(bytes32 indexed ruleId);

    /**
     * @dev 转账前合规检查
     * @return allowed 是否允许转账
     * @return reason 拒绝原因（allowed=false时）
     */
    function canTransfer(
        address from,
        address to,
        uint256 amount
    ) external view returns (bool allowed, string memory reason);

    /**
     * @dev 检查地址是否在白名单中
     */
    function isWhitelisted(address investor) external view returns (bool);

    /**
     * @dev 获取地址的持仓上限
     */
    function maxHolding(address investor) external view returns (uint256);

    /**
     * @dev 获取地址的锁定期截止时间
     */
    function lockupEnd(address investor) external view returns (uint256);

    // 管理函数
    function addToWhitelist(address investor, uint256 maxHold, uint256 lockupEndTime) external;
    function removeFromWhitelist(address investor) external;
    function setMaxHolding(address investor, uint256 maxHold) external;
    function setLockupEnd(address investor, uint256 lockupEndTime) external;
    function addAgent(address agent) external;
    function removeAgent(address agent) external;
    function isAgent(address account) external view returns (bool);
}
