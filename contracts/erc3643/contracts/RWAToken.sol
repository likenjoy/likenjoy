// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "./IRWAToken.sol";
import "./IIdentityRegistry.sol";
import "./IComplianceModule.sol";

/**
 * @title RWAToken
 * @dev ERC-3643 RWA代币核心实现
 *
 * 特性：
 * - ERC-20 兼容（transfer/approve/transferFrom）
 * - 每次转账自动过合规检查（白名单+锁定期+持仓上限）
 * - forcedTransfer（法院冻结/风控）
 * - mint/burn（发行/赎回）
 * - 分红批量发放
 * - NAV更新
 * - Agent权限模型
 */
contract RWAToken is IRWAToken, Context {
    // ERC-20 存储
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;
    uint256 private _totalSupply;
    string private _name;
    string private _symbol;
    uint8 private _decimals;

    // ERC-3643 特有
    address public owner;
    mapping(address => bool) private _agents;
    IIdentityRegistry public identityRegistry;
    IComplianceModule public complianceModule;
    bytes32 public assetId;
    uint256 public nav;

    // 紧急熔断（安全事件/合规整改时暂停所有代币操作）
    bool public paused;

    // 分红追踪
    mapping(address => uint256) public lastDividendBlock;

    modifier onlyOwner() {
        require(_msgSender() == owner, "RWAToken: caller is not owner");
        _;
    }

    modifier onlyAgent() {
        require(_agents[_msgSender()] || _msgSender() == owner, "RWAToken: caller is not agent");
        _;
    }

    modifier notPaused() {
        require(!paused, "RWAToken: paused");
        _;
    }

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        bytes32 assetId_,
        address identityRegistry_,
        address complianceModule_
    ) {
        require(bytes(name_).length > 0, "RWAToken: empty name");
        require(bytes(symbol_).length > 0, "RWAToken: empty symbol");
        require(identityRegistry_ != address(0), "RWAToken: zero registry");
        require(complianceModule_ != address(0), "RWAToken: zero compliance");

        _name = name_;
        _symbol = symbol_;
        _decimals = decimals_;
        assetId = assetId_;
        owner = _msgSender();
        _agents[_msgSender()] = true;

        identityRegistry = IIdentityRegistry(identityRegistry_);
        complianceModule = IComplianceModule(complianceModule_);
    }

    // ========== ERC-20 标准 ==========

    function name() external view override returns (string memory) { return _name; }
    function symbol() external view override returns (string memory) { return _symbol; }
    function decimals() external view override returns (uint8) { return _decimals; }
    function totalSupply() external view override returns (uint256) { return _totalSupply; }
    function balanceOf(address account) external view override returns (uint256) { return _balances[account]; }

    function transfer(address to, uint256 amount) external override notPaused returns (bool) {
        _transfer(_msgSender(), to, amount);
        return true;
    }

    function allowance(address owner_, address spender) external view override returns (uint256) {
        return _allowances[owner_][spender];
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        _approve(_msgSender(), spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external override notPaused returns (bool) {
        uint256 currentAllowance = _allowances[from][_msgSender()];
        require(currentAllowance >= amount, "RWAToken: insufficient allowance");
        unchecked {
            _approve(from, _msgSender(), currentAllowance - amount);
        }
        _transfer(from, to, amount);
        return true;
    }

    // ========== ERC-3643 核心 ==========

    /**
     * @dev 发行代币（资产上链）
     * 只有Agent可以调用，接收方必须通过KYC和白名单
     */
    function mint(address to, uint256 amount, bytes32 assetId_) external override onlyAgent notPaused {
        require(to != address(0), "RWAToken: mint to zero");
        require(amount > 0, "RWAToken: zero amount");

        // 合规检查
        (bool allowed, string memory reason) = complianceModule.canTransfer(address(0), to, amount);
        require(allowed, reason);

        // 持仓上限检查
        uint256 maxHold = complianceModule.maxHolding(to);
        if (maxHold > 0) {
            require(_balances[to] + amount <= maxHold, "RWAToken: exceeds max holding");
        }

        _totalSupply += amount;
        unchecked { _balances[to] += amount; }

        emit Transfer(address(0), to, amount);
        emit TokenMinted(to, amount, assetId_);
    }

    /**
     * @dev 销毁代币（赎回）
     */
    function burn(address from, uint256 amount, string calldata reason) external override onlyAgent notPaused {
        require(from != address(0), "RWAToken: burn from zero");
        require(_balances[from] >= amount, "RWAToken: insufficient balance");

        unchecked { _balances[from] -= amount; }
        _totalSupply -= amount;

        emit Transfer(from, address(0), amount);
        emit TokenBurned(from, amount, reason);
    }

    /**
     * @dev 强制转账（法院冻结、风控）
     * 绕过合规检查，仅Agent可调用
     */
    function forcedTransfer(
        address from,
        address to,
        uint256 amount,
        string calldata reason
    ) external override onlyAgent notPaused {
        require(from != address(0), "RWAToken: transfer from zero");
        require(to != address(0), "RWAToken: transfer to zero");
        require(_balances[from] >= amount, "RWAToken: insufficient balance");

        unchecked { _balances[from] -= amount; }
        unchecked { _balances[to] += amount; }

        emit Transfer(from, to, amount);
        emit ForcedTransfer(from, to, amount, reason);
    }

    // ========== 合规设置 ==========

    function setIdentityRegistry(address registry) external override onlyOwner {
        require(registry != address(0), "RWAToken: zero address");
        identityRegistry = IIdentityRegistry(registry);
        emit IdentityRegistrySet(registry);
    }

    function setComplianceModule(address module) external override onlyOwner {
        require(module != address(0), "RWAToken: zero address");
        complianceModule = IComplianceModule(module);
        emit ComplianceModuleSet(module);
    }

    // ========== 资产信息 ==========

    function updateNAV(uint256 newNAV) external override onlyAgent {
        require(newNAV > 0, "RWAToken: NAV must be positive");
        uint256 oldNAV = nav;
        nav = newNAV;
        emit NAVUpdated(oldNAV, newNAV, block.timestamp);
    }

    // ========== 紧急熔断 ==========

    function pause() external override onlyAgent {
        paused = true;
        emit Paused(_msgSender());
    }

    function unpause() external override onlyAgent {
        paused = false;
        emit Unpaused(_msgSender());
    }

    // ========== 分红 ==========

    /**
     * @dev 批量分红发放
     * @param token 分红代币地址（USDC/USDT等）
     * @param totalAmount 分红总额
     *
     * 注意：调用者需先 approve 本合约足够的 token 额度
     */
    function distributeDividends(address token, uint256 totalAmount) external override onlyAgent notPaused {
        require(token != address(0), "RWAToken: zero token");
        require(totalAmount > 0, "RWAToken: zero amount");
        require(_totalSupply > 0, "RWAToken: no supply");

        IERC20 dividendToken = IERC20(token);
        require(
            dividendToken.transferFrom(_msgSender(), address(this), totalAmount),
            "RWAToken: transferFrom failed"
        );

        emit DividendDistributed(totalAmount, block.timestamp);
    }

    // ========== 权限管理 ==========

    function addAgent(address agent) external override onlyOwner {
        require(agent != address(0), "RWAToken: zero address");
        _agents[agent] = true;
    }

    function removeAgent(address agent) external override onlyOwner {
        _agents[agent] = false;
    }

    function isAgent(address account) external view override returns (bool) {
        return _agents[account];
    }

    function transferOwnership(address newOwner) external override onlyOwner {
        require(newOwner != address(0), "RWAToken: zero address");
        owner = newOwner;
    }

    // ========== 内部函数 ==========

    function _transfer(address from, address to, uint256 amount) internal {
        require(from != address(0), "RWAToken: transfer from zero");
        require(to != address(0), "RWAToken: transfer to zero");
        require(_balances[from] >= amount, "RWAToken: insufficient balance");

        // 合规检查
        (bool allowed, string memory reason) = complianceModule.canTransfer(from, to, amount);
        require(allowed, reason);

        // 持仓上限检查
        uint256 maxHold = complianceModule.maxHolding(to);
        if (maxHold > 0) {
            require(_balances[to] + amount <= maxHold, "RWAToken: exceeds max holding");
        }

        unchecked { _balances[from] -= amount; }
        unchecked { _balances[to] += amount; }

        emit Transfer(from, to, amount);
    }

    function _approve(address owner_, address spender, uint256 amount) internal {
        require(owner_ != address(0), "RWAToken: approve from zero");
        require(spender != address(0), "RWAToken: approve to zero");
        _allowances[owner_][spender] = amount;
        emit Approval(owner_, spender, amount);
    }
}
