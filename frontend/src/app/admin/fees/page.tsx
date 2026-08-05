"use client";

import { useEffect, useState } from "react";
import { Card, Form, InputNumber, Input, Button, Table, Tabs, Tag, message, Typography, Alert, Space, Statistic, Row, Col } from "antd";
import { api } from "@/lib/api";

const { Title, Text } = Typography;

interface FeeConfig {
  id: string;
  mint_fee_rate: number;
  transfer_fee_rate: number;
  gas_markup_rate: number;
  treasury_address: string;
  updated_by: string;
  updated_at: string;
}

interface RevenueRecord {
  id: string;
  category: string;
  asset_id: string;
  user_id: string;
  amount: string;
  currency: string;
  tx_hash: string;
  gas_used_wei: string;
  detail: string;
  created_at: string;
}

interface GasRecord {
  id: string;
  tx_hash: string;
  chain_id: number;
  action: string;
  asset_id: string;
  gas_used_wei: string;
  cost_wei: string;
  created_at: string;
}

interface AuditLog {
  id: string;
  admin_id: string;
  action: string;
  target: string;
  detail: string;
  created_at: string;
}

const categoryLabels: Record<string, string> = {
  mint_fee: "铸造费",
  redeem_fee: "赎回费",
  transfer_fee: "转账费",
  gas_markup: "Gas 差价",
};

export default function AdminFeesPage() {
  const [fee, setFee] = useState<FeeConfig | null>(null);
  const [revenue, setRevenue] = useState<RevenueRecord[]>([]);
  const [gas, setGas] = useState<GasRecord[]>([]);
  const [audit, setAudit] = useState<AuditLog[]>([]);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const isAdmin = typeof window !== "undefined" && localStorage.getItem("user_role") === "admin";

  const load = () => {
    api.get<FeeConfig>("/admin/fees").then(setFee).catch(() => {});
    api.get<{ data: RevenueRecord[] }>("/admin/revenue?page=1&size=20").then((r) => setRevenue(r.data || [])).catch(() => {});
    api.get<{ data: GasRecord[] }>("/admin/gas?page=1&size=20").then((r) => setGas(r.data || [])).catch(() => {});
    api.get<{ data: AuditLog[] }>("/admin/audit?page=1&size=20").then((r) => setAudit(r.data || [])).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (fee) form.setFieldsValue(fee);
  }, [fee, form]);

  const handleSave = async (values: FeeConfig) => {
    setSaving(true);
    try {
      await api.put("/admin/fees", values);
      message.success("费率配置已保存（已记录审计）");
      load();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <Card>
        <Alert type="warning" showIcon message="需要管理员权限" description="请使用 admin 角色账号登录后访问收入管理。" />
      </Card>
    );
  }

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Title level={4} style={{ margin: 0 }}>收入管理（平台运营）</Title>
      <Alert type="info" showIcon message="合规说明"
        description="费率变更会记录审计日志（谁、何时、改了什么）。所有费率以万分数配置（100 = 1%）。收入进独立金库地址，可对账。" />

      <Card title="费率配置">
        <Form form={form} layout="vertical" style={{ maxWidth: 520 }} onFinish={handleSave} initialValues={{ mint_fee_rate: 100, transfer_fee_rate: 0, gas_markup_rate: 0 }}>
          <Form.Item name="mint_fee_rate" label="铸造费（发行总额的万分比，100 = 1%）" rules={[{ required: true }]}>
            <InputNumber min={0} max={10000} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="transfer_fee_rate" label="转账费（万分比，预留）" rules={[{ required: true }]}>
            <InputNumber min={0} max={10000} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="gas_markup_rate" label="Gas 加价（万分比，0 = 不加价）" rules={[{ required: true }]}>
            <InputNumber min={0} max={10000} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="treasury_address" label="平台金库地址（收入收款地址）">
            <Input placeholder="0x..." />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={saving}>保存费率</Button>
          {fee && <Text type="secondary" style={{ marginLeft: 12 }}>上次更新：{fee.updated_at}  by {fee.updated_by || "(系统)"}</Text>}
        </Form>
      </Card>

      <Tabs items={[
        {
          key: "revenue",
          label: `收入流水 (${revenue.length})`,
          children: (
            <Table<RevenueRecord> rowKey="id" dataSource={revenue} size="small" pagination={{ pageSize: 10 }}
              columns={[
                { title: "类型", dataIndex: "category", render: (v: string) => <Tag color="blue">{categoryLabels[v] || v}</Tag> },
                { title: "金额", dataIndex: "amount", render: (v: string) => <b>{v}</b> },
                { title: "币种", dataIndex: "currency" },
                { title: "资产", dataIndex: "asset_id", render: (v: string) => v ? v.slice(0, 8) + "..." : "-" },
                { title: "TxHash", dataIndex: "tx_hash", render: (v: string) => v ? <Text code>{v.slice(0, 18)}...</Text> : "-" },
                { title: "Gas", dataIndex: "gas_used_wei" },
                { title: "明细", dataIndex: "detail", ellipsis: true },
                { title: "时间", dataIndex: "created_at", render: (v: string) => new Date(v).toLocaleString() },
              ]} />
          ),
        },
        {
          key: "gas",
          label: `Gas 账本 (${gas.length})`,
          children: (
            <Table<GasRecord> rowKey="id" dataSource={gas} size="small" pagination={{ pageSize: 10 }}
              columns={[
                { title: "操作", dataIndex: "action", render: (v: string) => <Tag>{v}</Tag> },
                { title: "TxHash", dataIndex: "tx_hash", render: (v: string) => <Text code>{v.slice(0, 18)}...</Text> },
                { title: "Gas Used", dataIndex: "gas_used_wei" },
                { title: "Cost (wei)", dataIndex: "cost_wei" },
                { title: "资产", dataIndex: "asset_id", render: (v: string) => v ? v.slice(0, 8) + "..." : "-" },
                { title: "时间", dataIndex: "created_at", render: (v: string) => new Date(v).toLocaleString() },
              ]} />
          ),
        },
        {
          key: "audit",
          label: `审计日志 (${audit.length})`,
          children: (
            <Table<AuditLog> rowKey="id" dataSource={audit} size="small" pagination={{ pageSize: 10 }}
              columns={[
                { title: "操作", dataIndex: "action", render: (v: string) => <Tag color="orange">{v}</Tag> },
                { title: "操作人", dataIndex: "admin_id", render: (v: string) => v ? v.slice(0, 8) + "..." : "(系统)" },
                { title: "明细", dataIndex: "detail" },
                { title: "时间", dataIndex: "created_at", render: (v: string) => new Date(v).toLocaleString() },
              ]} />
          ),
        },
      ]} />
    </Space>
  );
}
