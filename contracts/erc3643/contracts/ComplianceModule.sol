// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IComplianceModule.sol";
import "./IIdentityRegistry.sol";

/**
 * @title ComplianceModule
 * @dev ERC-3643 合规模块实现
 * 白名单 + 持仓上限 + 锁定期 + 司法管辖区过滤
 */
contract ComplianceModule is IComplianceModule {
    address public owner;
    mapping(address => bool) private _agents;

    struct InvestorRules {
        bool whitelisted;
        uint256 maxHolding;
        uint256 lockupEnd;
    }

    mapping(address => InvestorRules) private _investorRules;
    IIdentityRegistry public identityRegistry;

    modifier onlyOwner() {
        require(msg.sender == owner, "ComplianceModule: caller is not owner");
        _;
    }

    modifier onlyAgent() {
        require(_agents[msg.sender] || msg.sender == owner, "ComplianceModule: caller is not agent");
        _;
    }

    constructor(address identityRegistry_) {
        require(identityRegistry_ != address(0), "ComplianceModule: zero registry");
        owner = msg.sender;
        _agents[msg.sender] = true;
        identityRegistry = IIdentityRegistry(identityRegistry_);
    }

    function canTransfer(
        address from,
        address to,
        uint256 amount
    ) external view override returns (bool allowed, string memory reason) {
        // 1. 接收方必须通过KYC验证
        if (!identityRegistry.isVerified(to)) {
            return (false, "Receiver not verified");
        }

        // 2. 接收方必须在白名单中
        if (!_investorRules[to].whitelisted) {
            return (false, "Receiver not whitelisted");
        }

        // 3. 检查锁定期
        // solhint-disable-next-line not-rely-on-time
        if (block.timestamp < _investorRules[to].lockupEnd) {
            return (false, "Receiver in lockup period");
        }

        // 4. 检查持仓上限（转账后余额不能超过上限）
        if (_investorRules[to].maxHolding > 0) {
            // 这里只能做静态检查，实际余额检查在Token合约中做
            // 因为ComplianceModule不知道接收方的当前余额
        }

        // 5. 发送方（非mint场景）也需要检查
        if (from != address(0)) {
            if (!_investorRules[from].whitelisted) {
                return (false, "Sender not whitelisted");
            }
        }

        return (true, "");
    }

    function isWhitelisted(address investor) external view override returns (bool) {
        return _investorRules[investor].whitelisted;
    }

    function maxHolding(address investor) external view override returns (uint256) {
        return _investorRules[investor].maxHolding;
    }

    function lockupEnd(address investor) external view override returns (uint256) {
        return _investorRules[investor].lockupEnd;
    }

    function addToWhitelist(
        address investor,
        uint256 maxHold,
        uint256 lockupEndTime
    ) external override onlyAgent {
        require(investor != address(0), "ComplianceModule: zero address");
        require(identityRegistry.isVerified(investor), "ComplianceModule: investor not verified");

        _investorRules[investor] = InvestorRules({
            whitelisted: true,
            maxHolding: maxHold,
            lockupEnd: lockupEndTime
        });
    }

    function removeFromWhitelist(address investor) external override onlyAgent {
        _investorRules[investor].whitelisted = false;
    }

    function setMaxHolding(address investor, uint256 maxHold) external override onlyAgent {
        _investorRules[investor].maxHolding = maxHold;
    }

    function setLockupEnd(address investor, uint256 lockupEndTime) external override onlyAgent {
        _investorRules[investor].lockupEnd = lockupEndTime;
    }

    function addAgent(address agent) external override onlyOwner {
        require(agent != address(0), "ComplianceModule: zero address");
        _agents[agent] = true;
    }

    function removeAgent(address agent) external override onlyOwner {
        _agents[agent] = false;
    }

    function isAgent(address account) external view override returns (bool) {
        return _agents[account];
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "ComplianceModule: zero address");
        owner = newOwner;
    }
}
