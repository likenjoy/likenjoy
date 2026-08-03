"use client";

import { useEffect, useState } from "react";
import { Button, Card, Form, InputNumber, Modal, Select, Space, Table, Tag, Typography, message } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { api } from "@/lib/api";

const { Title } = Typography;

interface RedeemRequest {
  id: string;
  asset_name: string;
  type: string;
  amount: number;
  estimated_value: number;
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
  approved: "blue",
  completed: "green",
  rejected: "red",
};

const typeLabels: Record<string, string> = {
  cash: "现金赎回",
  physical: "实物赎回",
  maturity: "到期赎回",
};

export default function RedeemPage() {
  const [requests, setRequests] = useState<RedeemRequest[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const fetchRequests = () => {
    setLoading(true);
    // 用当前登录用户的 ID，从 localStorage 取
    const userId = localStorage.getItem("user_id") || "me";
    api.get<RedeemRequest[]>(`/redeems/users/${userId}/requests`)
      .then(setRequests)
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRequests();
    api.get<{ data: Asset[] }>("/assets/live")
      .then((res) => setAssets(res.data || []))
      .catch(() => {});
  }, []);

  const handleCreate = async (values: Record<string, unknown>) => {
    setSubmitting(true);
    try {
      await api.post("/redeems/requests", {
        asset_id: values.asset_id,
        type: values.type,
        amount: Number(values.amount),
        unit: "token",
        price_per_unit: Number(values.price_per_unit),
      });
      message.success("赎回申请已提交");
      setModalOpen(false);
      form.resetFields();
      fetchRequests();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : "提交失败");
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { title: "资产", dataIndex: "asset_name", key: "asset_name" },
    {
      title: "赎回类型",
      dataIndex: "type",
      key: "type",
      render: (t: string) => typeLabels[t] || t,
    },
    { title: "数量", dataIndex: "amount", key: "amount" },
    { title: "预估价值", dataIndex: "estimated_value", key: "estimated_value", render: (v: number) => `$${Number(v).toLocaleString()}` },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      render: (s: string) => <Tag color={statusColors[s] || "default"}>{s}</Tag>,
    },
    { title: "申请时间", dataIndex: "created_at", key: "created_at" },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>实物赎回</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>提交赎回申请</Button>
      </div>
      <Card>
        <Table dataSource={requests} columns={columns} rowKey="id" loading={loading} />
      </Card>
      <Modal title="提交赎回申请" open={modalOpen} onCancel={() => setModalOpen(false)} footer={null} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="asset_id" label="选择资产" rules={[{ required: true }]}>
            <Select options={assets.map((a) => ({ value: a.id, label: `${a.name} ($${a.price_per_unit})` }))} />
          </Form.Item>
          <Form.Item name="type" label="赎回类型" rules={[{ required: true }]}>
            <Select options={[
              { value: "cash", label: "现金赎回" },
              { value: "physical", label: "实物赎回" },
              { value: "maturity", label: "到期赎回" },
            ]} />
          </Form.Item>
          <Form.Item name="amount" label="赎回数量" rules={[{ required: true }]}><InputNumber min={1} style={{ width: "100%" }} /></Form.Item>
          <Form.Item name="price_per_unit" label="赎回单价 (USD)" rules={[{ required: true }]}><InputNumber min={0} step={0.01} style={{ width: "100%" }} /></Form.Item>
          <Form.Item><Button type="primary" htmlType="submit" loading={submitting} block>提交申请</Button></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
