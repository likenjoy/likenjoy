"use client";

import { useEffect, useState } from "react";
import { Button, Card, DatePicker, Form, InputNumber, Modal, Select, Space, Table, Tag, Typography, message } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { api } from "@/lib/api";
import dayjs from "dayjs";

const { Title } = Typography;

interface DividendPlan {
  id: string;
  name: string;
  type: string;
  rate: number;
  frequency: string;
  status: string;
  start_date: string;
  total_periods: number;
  created_at: string;
}

interface Asset {
  id: string;
  name: string;
}

const statusColors: Record<string, string> = {
  active: "green",
  paused: "orange",
  completed: "blue",
  cancelled: "default",
};

const typeLabels: Record<string, string> = {
  dividend: "分红",
  interest: "计息",
};

export default function DividendPage() {
  const [plans, setPlans] = useState<DividendPlan[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    api.get<{ data: Asset[] }>("/assets/live")
      .then((res) => {
        setAssets(res.data || []);
        if (res.data?.length > 0) {
          setSelectedAssetId(res.data[0].id);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedAssetId) return;
    setLoading(true);
    api.get<DividendPlan[]>(`/assets/${selectedAssetId}/dividends/plans`)
      .then(setPlans)
      .catch(() => setPlans([]))
      .finally(() => setLoading(false));
  }, [selectedAssetId]);

  const handleCreate = async (values: Record<string, unknown>) => {
    if (!selectedAssetId) return;
    setSubmitting(true);
    try {
      await api.post(`/assets/${selectedAssetId}/dividends/plans`, {
        name: values.name,
        type: values.type,
        rate: Number(values.rate),
        frequency: values.frequency,
        start_date: values.start_date ? dayjs(values.start_date as string).format("YYYY-MM-DD") : "",
        total_periods: Number(values.total_periods),
      });
      message.success("分红计划创建成功");
      setModalOpen(false);
      form.resetFields();
      // 刷新列表
      api.get<DividendPlan[]>(`/assets/${selectedAssetId}/dividends/plans`)
        .then(setPlans)
        .catch(() => {});
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : "创建失败");
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { title: "计划名称", dataIndex: "name", key: "name" },
    { title: "类型", dataIndex: "type", key: "type", render: (t: string) => typeLabels[t] || t },
    { title: "年化利率", dataIndex: "rate", key: "rate", render: (v: number) => `${(v * 100).toFixed(2)}%` },
    { title: "发放频率", dataIndex: "frequency", key: "frequency" },
    { title: "总期数", dataIndex: "total_periods", key: "total_periods" },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      render: (s: string) => <Tag color={statusColors[s] || "default"}>{s}</Tag>,
    },
    { title: "开始日期", dataIndex: "start_date", key: "start_date" },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <Space>
          <Title level={4} style={{ margin: 0 }}>分红计息</Title>
          <Select
            value={selectedAssetId}
            onChange={setSelectedAssetId}
            options={assets.map((a) => ({ value: a.id, label: a.name }))}
            style={{ width: 200 }}
            placeholder="选择资产"
          />
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)} disabled={!selectedAssetId}>
          创建分红计划
        </Button>
      </div>
      <Card>
        <Table dataSource={plans} columns={columns} rowKey="id" loading={loading} />
      </Card>
      <Modal title="创建分红计划" open={modalOpen} onCancel={() => setModalOpen(false)} footer={null} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="计划名称" rules={[{ required: true }]}><Select options={[
            { value: "月度分红", label: "月度分红" },
            { value: "季度分红", label: "季度分红" },
            { value: "年度分红", label: "年度分红" },
            { value: "按日计息", label: "按日计息" },
          ]} /></Form.Item>
          <Form.Item name="type" label="计划类型" rules={[{ required: true }]}>
            <Select options={[
              { value: "dividend", label: "分红" },
              { value: "interest", label: "计息" },
            ]} />
          </Form.Item>
          <Form.Item name="rate" label="年化利率" rules={[{ required: true }]}><InputNumber min={0} max={1} step={0.001} style={{ width: "100%" }} /></Form.Item>
          <Form.Item name="frequency" label="发放频率" rules={[{ required: true }]}>
            <Select options={[
              { value: "daily", label: "每日" },
              { value: "monthly", label: "每月" },
              { value: "quarterly", label: "每季" },
              { value: "annually", label: "每年" },
            ]} />
          </Form.Item>
          <Form.Item name="start_date" label="开始日期" rules={[{ required: true }]}><DatePicker style={{ width: "100%" }} /></Form.Item>
          <Form.Item name="total_periods" label="总期数" rules={[{ required: true }]}><InputNumber min={1} style={{ width: "100%" }} /></Form.Item>
          <Form.Item><Button type="primary" htmlType="submit" loading={submitting} block>确认创建</Button></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
