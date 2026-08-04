"use client";

import { useEffect, useState } from "react";
import { Card, Input, InputNumber, Button, Space, Typography, Alert, message } from "antd";
import { ThunderboltOutlined, SwapOutlined } from "@ant-design/icons";
import { useAccount, useChainId, useSignTypedData } from "wagmi";
import { encodeFunctionData } from "viem";
import { api } from "@/lib/api";

const { Title, Text, Paragraph } = Typography;

interface ContractsConfig {
  forwarder: string;
  rwa_token: string;
  identity_registry: string;
  compliance_module: string;
  chain_id: string;
}

// EIP-2771 Forwarder 域名（与后端 relayer / 链上合约一致）
const FORWARDER_NAME = "RWAExchangeForwarder";

const transferAbi = [
  {
    name: "transfer",
    type: "function" as const,
    stateMutability: "nonpayable" as const,
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
];

const forwarderAbi = [
  {
    name: "nonces",
    type: "function" as const,
    stateMutability: "view" as const,
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
];

/**
 * 免 gas 转账（EIP-2771 元交易）
 * 流程：输入接收地址+金额 → 钱包 EIP-712 签名 → 平台 relayer 代付 gas 上链
 * 前置条件：已连接钱包 + 钱包已绑定到账户（未绑定会被后端拒绝）
 */
export default function GaslessTransfer() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { signTypedDataAsync } = useSignTypedData();

  const [cfg, setCfg] = useState<ContractsConfig | null>(null);
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [sending, setSending] = useState(false);
  const [txHash, setTxHash] = useState("");

  useEffect(() => {
    api.get<ContractsConfig>("/config/contracts").then(setCfg).catch(() => {});
  }, []);

  const handleTransfer = async () => {
    if (!cfg || !address || !to) return;
    if (!/^0x[a-fA-F0-9]{40}$/.test(to)) {
      message.error("接收地址格式不正确");
      return;
    }
    if (amount <= 0) {
      message.error("请输入转账数量");
      return;
    }

    setSending(true);
    setTxHash("");
    try {
      // 1. 构造 transfer calldata
      const calldata = encodeFunctionData({
        abi: transferAbi,
        functionName: "transfer",
        args: [to as `0x${string}`, BigInt(Math.round(amount * 1e18))],
      });

      // 2. 读取链上 nonce（防重放）
      const nonce = await publicClientReadNonce(cfg, address);

      // 3. 构造 EIP-712 类型化数据并签名
      const deadline = Math.floor(Date.now() / 1000) + 600; // 10 分钟有效
      const forwardRequest = {
        from: address,
        to: cfg.rwa_token,
        value: "0",
        gas: 300000,
        nonce: Number(nonce),
        deadline,
        data: calldata,
      };
      const signature = await signTypedDataAsync({
        domain: {
          name: FORWARDER_NAME,
          version: "1",
          chainId,
          verifyingContract: cfg.forwarder as `0x${string}`,
        },
        types: {
          ForwardRequest: [
            { name: "from", type: "address" },
            { name: "to", type: "address" },
            { name: "value", type: "uint256" },
            { name: "gas", type: "uint256" },
            { name: "nonce", type: "uint256" },
            { name: "deadline", type: "uint48" },
            { name: "data", type: "bytes" },
          ],
        },
        primaryType: "ForwardRequest",
        message: forwardRequest,
      });

      // 4. 提交给平台 relayer（平台代付 gas）
      const res = await api.post<{ tx_hash: string }>("/relay/execute", {
        ...forwardRequest,
        signature,
      });
      setTxHash(res.tx_hash);
      message.success("🎉 免 gas 转账已上链！");
    } catch (e: any) {
      message.error(e?.message || "转账失败，请确认接收方已完成 KYC 且钱包已绑定");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card
      title={
        <Space>
          <ThunderboltOutlined style={{ color: "#faad14" }} />
          <span>免 Gas 转账（平台代付）</span>
        </Space>
      }
      extra={<Text type="secondary" style={{ fontSize: 12 }}>EIP-2771 元交易</Text>}
    >
      {!isConnected ? (
        <Alert type="info" showIcon message="请先连接钱包" description="连接钱包并绑定到账户后，即可体验免 gas 转账。" />
      ) : (
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 0 }}>
            由平台中继器代付 Gas，您的钱包无需持有 ETH。接收方必须已完成 KYC 认证并加入白名单。
          </Paragraph>
          <Input
            placeholder="接收方钱包地址 (0x...)"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            allowClear
            prefix={<SwapOutlined />}
          />
          <InputNumber
            placeholder="转账数量"
            value={amount}
            min={0}
            step={1}
            onChange={(v) => setAmount(v ?? 0)}
            style={{ width: "100%" }}
            addonAfter="RVGOLD"
          />
          <Button type="primary" block loading={sending} onClick={handleTransfer} disabled={!cfg}>
            {sending ? "签名并上链中..." : "免 Gas 转账"}
          </Button>
          {txHash && (
            <Alert
              type="success"
              showIcon
              message="转账成功"
              description={
                <Text code style={{ fontSize: 12, wordBreak: "break-all" }}>{txHash}</Text>
              }
            />
          )}
          <Text type="secondary" style={{ fontSize: 12, display: "block" }}>
            签名仅授权本次转账，不会授权任何资金转移权限。交易记录计入平台 Gas 账本（可审计）。
          </Text>
        </Space>
      )}
    </Card>
  );
}

// 读取 forwarder 上该地址的当前 nonce（独立函数避免 hook 条件调用）
async function publicClientReadNonce(cfg: ContractsConfig, address: string) {
  const { getPublicClient } = await import("@wagmi/core");
  const { wagmiConfig } = await import("@/lib/web3");
  const client = getPublicClient(wagmiConfig, { chainId: Number(cfg.chain_id) });
  return client.readContract({
    address: cfg.forwarder as `0x${string}`,
    abi: forwarderAbi,
    functionName: "nonces",
    args: [address as `0x${string}`],
  });
}
