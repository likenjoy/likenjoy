// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title RevenueDistributionToken（RDT）
 * @dev 收益累积代币：资产分红自动化核心（参考 Maple revenue-distribution-token 架构，仅借鉴设计不搬代码）
 *
 * 机制：
 *  - 资产方（agent）调用 depositYield() 存入收益代币（如 HKD 稳定币），进入收益池
 *  - 收益按秒线性释放：自首笔收益存入起 vestingDuration 内释放完毕（多笔 deposit 共享时间线）
 *  - RWA 证券代币持有者按其持有份额，随时 claim 已释放收益
 *  - 份额按实时 RWA 供应计算（MVP；新持有人分享未释放收益，二期升级快照制）
 */
contract RevenueDistributionToken {
    address public immutable rwaToken;    // RWA 证券代币（仅计算份额）
    address public immutable yieldToken;  // 收益代币（如 HKD 稳定币）
    address public immutable agent;       // 资产运营方

    uint256 public vestingDuration;       // 释放时长（秒）
    uint256 public totalYield;            // 累计存入收益
    uint256 public totalClaimed;          // 累计已领取
    uint256 public firstDepositTime;      // 首笔收益存入时间（释放时间线起点）

    mapping(address => uint256) public claimed; // 用户累计应得

    event YieldDeposited(address indexed by, uint256 amount);
    event YieldClaimed(address indexed by, uint256 amount);
    event VestingSet(uint256 duration);

    constructor(address _rwaToken, address _yieldToken, address _agent, uint256 _vestingDuration) {
        require(_rwaToken != address(0) && _yieldToken != address(0) && _agent != address(0), "RDT: zero address");
        rwaToken = _rwaToken;
        yieldToken = _yieldToken;
        agent = _agent;
        vestingDuration = _vestingDuration > 0 ? _vestingDuration : 7 days;
    }

    modifier onlyAgent() {
        require(msg.sender == agent, "RDT: not agent");
        _;
    }

    // ========== 收益存入 ==========

    /// @dev 资产方存入收益代币（须先 approve）；自首笔起 vestingDuration 内线性释放完毕
    function depositYield(uint256 amount) external onlyAgent {
        require(amount > 0, "RDT: zero amount");
        if (firstDepositTime == 0) {
            firstDepositTime = block.timestamp;
        }
        IERC20(yieldToken).transferFrom(msg.sender, address(this), amount);
        totalYield += amount;
        emit YieldDeposited(msg.sender, amount);
    }

    // ========== 领取收益 ==========

    /// @dev RWA 持有者按份额领取已释放收益；份额 = 用户 RWA 余额 / RWA 总供应
    function claim() external returns (uint256) {
        uint256 rwaBalance = IERC20(rwaToken).balanceOf(msg.sender);
        uint256 supply = IERC20(rwaToken).totalSupply();
        require(supply > 0 && rwaBalance > 0, "RDT: no holdings");

        uint256 entitled = (releasedAmount() * rwaBalance) / supply;
        uint256 pending = entitled > claimed[msg.sender] ? entitled - claimed[msg.sender] : 0;
        if (pending > 0) {
            claimed[msg.sender] = entitled;
            totalClaimed += pending;
            IERC20(yieldToken).transfer(msg.sender, pending);
            emit YieldClaimed(msg.sender, pending);
        }
        return pending;
    }

    // ========== 查询 ==========

    /// @dev 当前已释放收益（线性：总量 × 已过时间 / vestingDuration，封顶总量）
    function releasedAmount() public view returns (uint256) {
        if (totalYield == 0 || firstDepositTime == 0) return 0;
        uint256 elapsed = block.timestamp > firstDepositTime ? block.timestamp - firstDepositTime : 0;
        uint256 released = (totalYield * elapsed) / vestingDuration;
        return released > totalYield ? totalYield : released;
    }

    /// @dev 用户待领取收益
    function pendingReward(address user) external view returns (uint256) {
        uint256 rwaBalance = IERC20(rwaToken).balanceOf(user);
        uint256 supply = IERC20(rwaToken).totalSupply();
        if (supply == 0 || rwaBalance == 0) return 0;
        uint256 entitled = (releasedAmount() * rwaBalance) / supply;
        return entitled > claimed[user] ? entitled - claimed[user] : 0;
    }

    /// @dev 设置释放时长（仅 agent；不影响已存入收益的既有时间线）
    function setVestingDuration(uint256 duration) external onlyAgent {
        vestingDuration = duration > 0 ? duration : 7 days;
        emit VestingSet(vestingDuration);
    }
}

interface IERC20 {
    function balanceOf(address) external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function transfer(address, uint256) external returns (bool);
    function transferFrom(address, address, uint256) external returns (bool);
}