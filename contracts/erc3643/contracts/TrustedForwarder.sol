// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/metatx/ERC2771Forwarder.sol";

/**
 * @title TrustedForwarder
 * @dev EIP-2771 元交易转发器（OZ ERC2771Forwarder 的本地包装，
 * 便于 Hardhat 生成 artifact 用于部署与测试）
 * 特性：EIP-712 类型化签名、nonce 防重放、deadline 过期校验、gas 代付
 */
contract TrustedForwarder is ERC2771Forwarder {
    constructor(string memory name) ERC2771Forwarder(name) {}
}
