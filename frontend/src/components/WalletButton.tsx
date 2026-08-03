"use client";

import { useState } from "react";
import { Button, Space, Tag, message, Tooltip } from "antd";
import { WalletOutlined, LinkOutlined } from "@ant-design/icons";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useSignMessage } from "wagmi";
import { buildBindMessage } from "@/lib/web3";
import { api } from "@/lib/api";

export default function WalletButton() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [binding, setBinding] = useState(false);

  // 当前登录用户已绑定的钱包（从 localStorage 读取，登录时写入）
  const boundAddress = typeof window !== "undefined" ? localStorage.getItem("wallet_address") || "" : "";
  const isBound = !!boundAddress && address?.toLowerCase() === boundAddress.toLowerCase();

  const handleBind = async () => {
    if (!address) return;
    setBinding(true);
    try {
      const bindMsg = buildBindMessage(address);
      const signature = await signMessageAsync({ message: bindMsg });
      const res = await api.post<{ wallet_address: string }>("/auth/bind-wallet", {
        wallet_address: address,
        signature,
        message: bindMsg,
      });
      localStorage.setItem("wallet_address", res.wallet_address);
      message.success("钱包绑定成功");
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : "绑定失败");
    } finally {
      setBinding(false);
    }
  };

  return (
    <Space direction="vertical" style={{ width: "100%" }} size={8}>
      <ConnectButton.Custom>
        {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
          const ready = mounted;
          const connected = ready && account && chain;
          return (
            <div
              {...(!ready && { "aria-hidden": true, style: { opacity: 0, pointerEvents: "none" } })}
            >
              {(() => {
                if (!connected) {
                  return (
                    <Button block icon={<WalletOutlined />} onClick={openConnectModal} type="primary">
                      连接钱包
                    </Button>
                  );
                }
                if (chain.unsupported) {
                  return (
                    <Button block danger onClick={openChainModal}>
                      错误网络
                    </Button>
                  );
                }
                return (
                  <Space direction="vertical" style={{ width: "100%" }}>
                    <Button block onClick={openAccountModal} icon={<WalletOutlined />}>
                      {account.displayName}
                    </Button>
                    {!isBound && (
                      <Button block loading={binding} onClick={handleBind} icon={<LinkOutlined />}>
                        绑定钱包到账户
                      </Button>
                    )}
                  </Space>
                );
              })()}
            </div>
          );
        }}
      </ConnectButton.Custom>
      {isBound && (
        <Tooltip title="该钱包地址已绑定到你的账户，可用于链上铸造与交易签名">
          <Tag color="green" style={{ width: "100%", textAlign: "center" }}>
            <LinkOutlined /> 已绑定
          </Tag>
        </Tooltip>
      )}
    </Space>
  );
}
