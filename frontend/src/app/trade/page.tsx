"use client";

import { useEffect, useState } from "react";
import { Button, Card, Form, InputNumber, Select, Space, Table, Tag, Typography, message, Segmented, Alert } from "antd";
import { SwapOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { api } from "@/lib/api";

const { Title, Text } = Typography;

interface Trade {
  id: string;
  asset_name: string;
  side: string;
  quantity: number;
  price: number;
  total_value: number;
  status: string;
  created_at: string;
}

interface Asset {
  id: string;
  name: string;
  price_per_unit: number;
}

const statusColors: Record<string, string> = {
  pending: "processing", matched: "blue", settled: "success", cancelled: "default",
};
const statusLabels: Record<string, string> = {
  pending: "待成交", matched: "已匹配", settled: "已结算", cancelled: "已取消",
};

export default function TradePage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [side, setSide] = useState("buy");
  const [assetId, setAssetId] = useState<string>();
  const [quantity, setQuantity] = useState<number>(0);
  const [price, setPrice] = useState<number>(0);

  const fetchTrades = () => {
    setLoading(true);
    api.get<{ data: Trade[] }>("/trades/orders")
      .then((res) => setTrades(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTrades();
    api.get<{ items: Asset[] }>("/assets/live")
      .then((res) => setAssets(res.items || []))
      .catch(() => {});
  }, []);

  const total = (Number(quantity) || 0) * (Number(price) || 0);

  const handleSubmit = async () => {
    if (!assetId || quantity <= 0 || price <= 0) {
      message.warning("请选择资产并填写数量和单价");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/trades/orders", {
        asset_id: assetId,
        side,
        order_type: "limit",
        price: String(price),
        quantity: String(quantity),
      });
      message.success("订单已提交");
      setQuantity(0);
      setPrice(0);
      fetchTrades();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : "提交失败");
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { title: "资产", dataIndex: "asset_name", key: "asset_name", render: (v: string) => <Text strong>{v}</Text> },
    {
      title: "方向", dataIndex: "side", key: "side",
      render: (t: string) => <Tag color={t === "buy" ? "success" : "error"}>{t === "buy" ? "买入" : "卖出"}</Tag>,
    },
    { title: "数量", dataIndex: "quantity", key: "quantity", render: (v: number) => Number(v).toLocaleString() },
    { title: "单价", dataIndex: "price", key: "price", render: (v: number) => `$${Number(v).toLocaleString()}` },
    { title: "总价", dataIndex: "total_value", key: "total_value", render: (v: number) => `$${Number(v).toLocaleString()}` },
    {
      title: "状态", dataIndex: "status", key: "status",
      render: (s: string) => <Tag color={statusColors[s] || "default"}>{statusLabels[s] || s}</Tag>,
    },
    { title: "时间", dataIndex: "created_at", key: "created_at", render: (v: string) => <Text type="secondary">{v}</Text> },
  ];

  return (
    <div>
      <Title level={4} style={{ margin: "0 0 16px" }}>私募交易</Title>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(340px, 420px) 1fr", gap: 16, alignItems: "start" }}>
        {/* 左侧：下单大卡片（Uniswap 式排版） */}
        <Card style={{ borderRadius: 12 }} styles={{ body: { padding: 24 } }}>
          <Segmented
            block
            value={side}
            onChange={(v) => setSide(v as string)}
            options={[
              { label: "买入", value: "buy" },
              { label: "卖出", value: "sell" },
            ]}
          />
          <Alert
            type={side === "buy" ? "info" : "warning"}
            showIcon
            message={side === "buy" ? "买入需资金充足" : "卖出需持有对应资产"}
            style={{ borderRadius: 8, margin: "16px 0" }}
          />
          <Space direction="vertical" size={14} style={{ width: "100%" }}>
            <Select
              placeholder="选择资产"
              value={assetId}
              onChange={setAssetId}
              options={assets.map((a) => ({ value: a.id, label: `${a.name} ($${a.price_per_unit})` }))}
              style={{ width: "100%" }}
            />
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>数量</Text>
              <InputNumber
                value={quantity}
                min={0}
                onChange={(v) => setQuantity(v ?? 0)}
                style={{ width: "100%", height: 44 }}
                addonAfter="份"
              />
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>单价 (USD)</Text>
              <InputNumber
                value={price}
                min={0}
                step={0.01}
                onChange={(v) => setPrice(v ?? 0)}
                style={{ width: "100%", height: 44 }}
                prefix="$"
              />
            </div>
            <div style={{
              background: "rgba(26,171,155,.06)", borderRadius: 8, padding: "12px 16px",
              display: "flex", justifyContent: "space-between",
            }}>
              <Text type="secondary">预计总价</Text>
              <Text strong style={{ fontSize: 18, color: "#1AAB9B" }}>
                ${total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </Text>
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              交易手续费按平台费率收取；Gas 由平台代付（EIP-2771 元交易）。
            </Text>
            <Button
              type="primary"
              size="large"
              block
              loading={submitting}
              onClick={handleSubmit}
              icon={<SwapOutlined />}
              style={{ height: 48, borderRadius: 8 }}
            >
              {side === "buy" ? "确认买入" : "确认卖出"}
            </Button>
          </Space>
        </Card>

        {/* 右侧：订单列表 */}
        <Card
          title={<Space><ThunderboltOutlined style={{ color: "#1AAB9B" }} />我的订单</Space>}
          style={{ borderRadius: 12 }}
        >
          <Table dataSource={trades} columns={columns} rowKey="id" loading={loading} pagination={{ pageSize: 8 }} size="middle" />
        </Card>
      </div>
    </div>
  );
}