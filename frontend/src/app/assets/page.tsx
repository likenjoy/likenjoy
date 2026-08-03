"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Alert, Card, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, Typography, message } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { api } from "@/lib/api";

const { Title } = Typography;

interface Asset {
  id: string;
  name: string;
  symbol: string;
  asset_type: string;
  total_supply: number;
  price_per_unit: number;
  min_investment: number;
  status: string;
  contract_address: string;
  created_at: string;
}

const statusColors: Record<string, string> = {
  draft: "default",
  pending: "processing",
  active: "green",
  suspended: "orange",
  closed: "red",
};

export default function AssetsPage() {
  const router = useRouter();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mintFeeRate, setMintFeeRate] = useState(0);
  const [form] = Form.useForm();

  // 费率披露：获取铸造费率（万分数）
  useEffect(() => {
    api.get<{ mint_fee_rate: number }>("/fees")
      .then((f) => setMintFeeRate(f.mint_fee_rate || 0))
      .catch(() => {});
  }, []);

  // 铸造费实时预览
  const supply = Form.useWatch("total_supply", form);
  const price = Form.useWatch("price_per_unit", form);
  const issuance = (Number(supply) || 0) * (Number(price) || 0);
  const mintFeePreview = mintFeeRate > 0 ? (issuance * mintFeeRate) / 10000 : 0;

  const fetchAssets = () => {
    setLoading(true);
    api.get<{ data?: Asset[]; items?: Asset[] }>("/assets/live")
      .then((res) => setAssets(res.data || res.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAssets(); }, []);

  const handleCreate = async (values: Record<string, unknown>) => {
    setSubmitting(true);
    try {
      await api.post("/assets", {
        ...values,
        total_supply: String(values.total_supply),
        price_per_unit: String(values.price_per_unit),
        min_investment: String(values.min_investment),
      });
      message.success("资产创建成功");
      setModalOpen(false);
      form.resetFields();
      fetchAssets();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : "创建失败");
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { title: "名称", dataIndex: "name", key: "name" },
    { title: "代码", dataIndex: "symbol", key: "symbol" },
    { title: "类型", dataIndex: "asset_type", key: "asset_type" },
    { title: "总供应量", dataIndex: "total_supply", key: "total_supply", render: (v: number) => v?.toLocaleString() },
    { title: "单价", dataIndex: "price_per_unit", key: "price_per_unit", render: (v: number) => `$${Number(v).toLocaleString()}` },
    { title: "最小认购", dataIndex: "min_investment", key: "min_investment", render: (v: number) => `$${Number(v).toLocaleString()}` },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      render: (s: string) => <Tag color={statusColors[s] || "default"}>{s}</Tag>,
    },
    { title: "合约地址", dataIndex: "contract_address", key: "contract_address", ellipsis: true },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>资产发行</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>发行新资产</Button>
      </div>
      <Card>
        <Table dataSource={assets} columns={columns} rowKey="id" loading={loading} />
      </Card>
      <Modal title="发行新资产" open={modalOpen} onCancel={() => setModalOpen(false)} footer={null} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="资产名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="symbol" label="资产代码" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="asset_type" label="资产类型" rules={[{ required: true }]}>
            <Select options={[
              { value: "gold", label: "黄金" },
              { value: "carbon_credit", label: "碳汇" },
              { value: "real_estate", label: "地产收益权" },
              { value: "private_debt", label: "私募债" },
              { value: "other", label: "其他" },
            ]} />
          </Form.Item>
          <Form.Item name="total_supply" label="总供应量" rules={[{ required: true }]}><InputNumber min={1} style={{ width: "100%" }} /></Form.Item>
          <Form.Item name="price_per_unit" label="单价 (USD)" rules={[{ required: true }]}><InputNumber min={0} step={0.01} style={{ width: "100%" }} /></Form.Item>
          <Form.Item name="min_investment" label="最小认购额 (USD)" rules={[{ required: true }]}><InputNumber min={0} step={0.01} style={{ width: "100%" }} /></Form.Item>
                    <Alert
            type="info"
            showIcon
            message="费用预览（透明披露）"
            description={
              <div>
                <div>发行总额：<b>{issuance.toLocaleString(undefined, { maximumFractionDigits: 2 })} HKD</b></div>
                <div>铸造费（{mintFeeRate / 100}%）：<b>{mintFeeRate > 0 ? mintFeePreview.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "0"} HKD</b>，收至平台金库</div>
                <div>Gas：平台代付，按实际成本记账</div>
              </div>
            }
            style={{ marginBottom: 16 }}
          />
<Form.Item><Button type="primary" htmlType="submit" loading={submitting} block>确认发行</Button></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
