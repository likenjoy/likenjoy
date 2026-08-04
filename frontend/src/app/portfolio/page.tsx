"use client";

import { useEffect, useState } from "react";
import { Card, Table, Statistic, Row, Col, Tag, Space, Typography, Alert, Descriptions, Button } from "antd";
import { WalletOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { api } from "@/lib/api";
import GaslessTransfer from "@/components/GaslessTransfer";

const { Title, Text } = Typography;

interface AssetInfo {
  asset_id: string;
  symbol: string;
  name: string;
  price_per_unit: string;
}

interface Portfolio {
  wallet: string;
  balance: string;
  balance_wei: string;
  assets: AssetInfo[];
  token_symbol: string;
  note?: string;
}

export default function PortfolioPage() {
  const [data, setData] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [transferOpen, setTransferOpen] = useState(false);

  useEffect(() => {
    api.get<Portfolio>("/portfolio")
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const hasWallet = !!data?.wallet;
  const balance = Number(data?.balance || 0);

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Title level={4} style={{ margin: 0 }}>我的持仓</Title>

      <Row gutter={16}>
        <Col span={8}>
          <Card loading={loading}>
            <Statistic
              title="链上代币余额"
              value={balance}
              suffix={data?.token_symbol || "RVGOLD"}
              valueStyle={{ color: "#1677ff" }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card loading={loading}>
            <Statistic title="绑定钱包" value={hasWallet ? data.wallet.slice(0, 12) + "..." : "未绑定"} valueStyle={{ fontSize: 16 }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card loading={loading}>
            <Statistic title="可投资资产数" value={data?.assets?.length || 0} suffix="个" />
          </Card>
        </Col>
      </Row>

      {!hasWallet && (
        <Alert type="warning" showIcon message="尚未绑定钱包"
          description={"请在左侧连接钱包并点击【绑定钱包到账户】，绑定后此处将显示链上真实持仓。"} />
      )}

      <Row gutter={16}>
        <Col xs={24} md={24}>
          {/* 免 gas 绿色 Banner + 转账入口 */}
          <Alert
            type="success"
            showIcon
            message="免 Gas 转账已开通：平台为您代付 Gas（EIP-2771 元交易）"
            description="您无需持有 ETH 即可向其他合规投资者转账，交易按平台费率自动结算。"
            action={
              <Button type="primary" size="small" icon={<ThunderboltOutlined />} onClick={() => setTransferOpen(true)}>
                免 Gas 转账
              </Button>
            }
            style={{ borderRadius: 8, marginBottom: 16 }}
          />
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} md={24}>
          <Card title="链上持仓明细" loading={loading}>
        {hasWallet ? (
          <Descriptions column={2} size="small" style={{ marginBottom: 16 }}>
            <Descriptions.Item label="钱包地址">
              <Text code>{data.wallet}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="余额（wei）">{data.balance_wei}</Descriptions.Item>
          </Descriptions>
        ) : null}
        <Table<AssetInfo> rowKey="asset_id" dataSource={data?.assets || []} size="small" pagination={false}
          columns={[
            { title: "资产", dataIndex: "name" },
            { title: "代码", dataIndex: "symbol", render: (v: string) => <Tag color="gold">{v}</Tag> },
            { title: "单价 (HKD)", dataIndex: "price_per_unit" },
            { title: "状态", render: () => <Tag color="green">live</Tag> },
          ]} />
        {data?.note && <Text type="secondary" style={{ fontSize: 12, display: "block", marginTop: 12 }}>{data.note}</Text>}
        </Card>
        </Col>
      </Row>

      {/* 免 Gas 转账抽屉 */}
      <GaslessTransfer open={transferOpen} onClose={() => setTransferOpen(false)} />
    </Space>
  );
}
