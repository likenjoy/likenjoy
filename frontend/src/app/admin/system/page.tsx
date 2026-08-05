"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, Form, Input, Button, Space, Typography, Tag, Alert, message, Descriptions, Popconfirm } from "antd";
import { SaveOutlined, SafetyCertificateOutlined, KeyOutlined, GlobalOutlined, ApiOutlined } from "@ant-design/icons";
import { api } from "@/lib/api";

const { Title, Text } = Typography;

interface SystemConfig {
  rpc_url: string;
  chain_id: string;
  jwt_secret_masked: string;
  jwt_secret_set: boolean;
  private_key_set: boolean;
  platform_address: string;
}

export default function AdminSystemPage() {
  const [cfg, setCfg] = useState<SystemConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(() => {
    setLoading(true);
    api.get<SystemConfig>("/admin/system")
      .then((d) => { setCfg(d); form.setFieldsValue({ rpc_url: d.rpc_url, chain_id: d.chain_id }); })
      .catch(() => message.error("加载系统配置失败"))
      .finally(() => setLoading(false));
  }, [form]);

  useEffect(load, [load]);

  const handleSave = async () => {
    const values = await form.validateFields();
    if (values.jwt_secret || values.private_key) {
      const ok = window.confirm("⚠️ 修改密钥会立即使现有登录会话/待处理交易失效，且需重启后端生效。确认继续？");
      if (!ok) return;
    }
    setSaving(true);
    try {
      const payload: Record<string, string> = {};
      if (values.rpc_url) payload.rpc_url = values.rpc_url;
      if (values.chain_id) payload.chain_id = values.chain_id;
      if (values.jwt_secret) payload.jwt_secret = values.jwt_secret;
      if (values.private_key) payload.private_key = values.private_key;
      const r = await api.put<{ note: string }>("/admin/system", payload);
      message.success(r.note || "配置已保存，重启后端后生效");
      form.resetFields(["jwt_secret", "private_key"]);
      load();
    } catch (e: any) {
      message.error(e?.message || "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Title level={4} style={{ margin: 0 }}>系统设置</Title>
      </div>

      <Alert
        type="info"
        showIcon
        message="安全设计说明"
        description="私钥永不回显明文（仅展示平台地址指纹），只支持「更换」不支持「查看」。所有配置写入服务器 .env 文件，重启后端后生效。"
        style={{ borderRadius: 8 }}
      />

      <Card title={<Space><GlobalOutlined style={{ color: "#1AAB9B" }} />链上配置</Space>} loading={loading}>
        <Form form={form} layout="vertical" style={{ maxWidth: 560 }}>
          <Form.Item label="RPC 节点地址" name="rpc_url" extra="生产建议使用 Infura/Alchemy 或自建节点">
            <Input prefix={<ApiOutlined />} placeholder="https://sepolia-rollup.arbitrum.io/rpc" />
          </Form.Item>
          <Form.Item label="链 ID (ChainID)" name="chain_id" extra="Arbitrum Sepolia=421614 / Arbitrum One=42161 / Hardhat=31337">
            <Input prefix={<ApiOutlined />} placeholder="421614" />
          </Form.Item>
        </Form>
      </Card>

      <Card title={<Space><SafetyCertificateOutlined style={{ color: "#1AAB9B" }} />平台账户</Space>} loading={loading}>
        <Descriptions column={1} size="small" style={{ marginBottom: 16 }}>
          <Descriptions.Item label="平台签名地址（公钥指纹）">
            {cfg?.platform_address ? (
              <Text code style={{ fontSize: 12 }}>{cfg.platform_address}</Text>
            ) : <Text type="secondary">未连接链</Text>}
          </Descriptions.Item>
          <Descriptions.Item label="私钥状态">
            <Tag color={cfg?.private_key_set ? "green" : "red"}>{cfg?.private_key_set ? "已配置" : "未配置"}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="JWT 密钥">
            <Space>
              <Tag color={cfg?.jwt_secret_set ? "green" : "red"}>{cfg?.jwt_secret_set ? "已配置" : "使用默认值（危险）"}</Tag>
              {cfg?.jwt_secret_masked && <Text type="secondary" style={{ fontSize: 12 }}>{cfg.jwt_secret_masked}</Text>}
            </Space>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title={<Space><KeyOutlined style={{ color: "#FFC012" }} />密钥维护（高危操作）</Space>}>
        <Form form={form} layout="vertical" style={{ maxWidth: 560 }}>
          <Form.Item label="更换平台私钥" name="private_key" extra="⚠️ 更换后所有待处理交易失效；仅写入 .env，永不回显。留空表示不修改。">
            <Input.Password placeholder="0x + 64 位 hex（生产环境建议冷存储备份）" />
          </Form.Item>
          <Form.Item label="更换 JWT 密钥" name="jwt_secret" extra="⚠️ 更换后所有已登录用户将掉线。留空表示不修改。">
            <Input.Password placeholder="强随机字符串（≥32 字符）" />
          </Form.Item>
          <Popconfirm title="确认保存以上配置？" onConfirm={handleSave} okText="确认保存" cancelText="再想想">
            <Button type="primary" icon={<SaveOutlined />} loading={saving}>保存配置</Button>
          </Popconfirm>
        </Form>
      </Card>
    </Space>
  );
}