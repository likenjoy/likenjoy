"use client";

import { useEffect, useState } from "react";
import { Button, Card, Form, InputNumber, Modal, Select, Space, Table, Tag, Typography, message } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { api } from "@/lib/api";

const { Title } = Typography;

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
  pending: "processing",
  matched: "blue",
  settled: "green",
  cancelled: "default",
};

export default function TradePage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

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

  const handleCreate = async (values: Record<string, unknown>) => {
    setSubmitting(true);
    try {
      await api.post("/trades/orders", {
        asset_id: values.asset_id,
        side: values.side,
        order_type: "limit",
        price: String(values.price),
        quantity: String(values.quantity),
      });
      message.success("订单已提交");
      setModalOpen(false);
      form.resetFields();
      fetchTrades();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : "提交失败");
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { title: "资产", dataIndex: "asset_name", key: "asset_name" },
    {
      title: "方向",
      dataIndex: "side",
      key: "side",
      render: (t: string) => <Tag color={t === "buy" ? "green" : "red"}>{t === "buy" ? "买入" : "卖出"}</Tag>,
    },
    { title: "数量", dataIndex: "quantity", key: "quantity" },
    { title: "单价", dataIndex: "price", key: "price", render: (v: number) => `$${Number(v).toLocaleString()}` },
    { title: "总价", dataIndex: "total_value", key: "total_value", render: (v: number) => `$${Number(v).toLocaleString()}` },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      render: (s: string) => <Tag color={statusColors[s] || "default"}>{s}</Tag>,
    },
    { title: "时间", dataIndex: "created_at", key: "created_at" },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>私募交易</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>新建订单</Button>
      </div>
      <Card>
        <Table dataSource={trades} columns={columns} rowKey="id" loading={loading} />
      </Card>
      <Modal title="新建交易订单" open={modalOpen} onCancel={() => setModalOpen(false)} footer={null} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="asset_id" label="选择资产" rules={[{ required: true }]}>
            <Select options={assets.map((a) => ({ value: a.id, label: `${a.name} ($${a.price_per_unit})` }))} />
          </Form.Item>
          <Form.Item name="side" label="交易方向" rules={[{ required: true }]}>
            <Select options={[{ value: "buy", label: "买入" }, { value: "sell", label: "卖出" }]} />
          </Form.Item>
          <Form.Item name="quantity" label="数量" rules={[{ required: true }]}><InputNumber min={1} style={{ width: "100%" }} /></Form.Item>
          <Form.Item name="price" label="单价 (USD)" rules={[{ required: true }]}><InputNumber min={0} step={0.01} style={{ width: "100%" }} /></Form.Item>
          <Form.Item><Button type="primary" htmlType="submit" loading={submitting} block>提交订单</Button></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
