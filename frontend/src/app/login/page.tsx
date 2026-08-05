"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Form, Input, Button, Card, message, Typography, Select, Tabs } from "antd";
import { UserOutlined, LockOutlined, IdcardOutlined, FundOutlined, SafetyCertificateOutlined, ThunderboltOutlined, EyeOutlined } from "@ant-design/icons";
import { api } from "@/lib/api";

const { Title, Text } = Typography;

const brandPoints = [
  { icon: <SafetyCertificateOutlined />, text: "ERC-3643 合规代币化，KYC 链上白名单" },
  { icon: <ThunderboltOutlined />, text: "免 Gas 体验，平台代付（EIP-2771）" },
  { icon: <EyeOutlined />, text: "资产净值、分红全程链上透明可审计" },
];

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"login" | "register">("login");
  const router = useRouter();

  const onLogin = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      const res = await api.post<{ token: string; user: { id: string; email: string; role: string; wallet_address?: string } }>("/auth/login", values);
      localStorage.setItem("token", res.token);
      localStorage.setItem("user_id", res.user.id);
      localStorage.setItem("user_email", res.user.email);
      localStorage.setItem("user_role", res.user.role);
      localStorage.setItem("wallet_address", res.user.wallet_address || "");
      message.success("登录成功");
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "登录失败";
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const onRegister = async (values: { email: string; password: string; name: string; role: string }) => {
    setLoading(true);
    try {
      await api.post("/auth/register", values);
      message.success("注册成功，请登录");
      setTab("login");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "注册失败";
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* 左侧品牌区（渐变背景） */}
      <div style={{
        flex: "0 0 46%", display: "flex", flexDirection: "column", justifyContent: "center",
        padding: "48px 64px", color: "#fff",
        background: "linear-gradient(135deg, #0F766E 0%, #1AAB9B 45%, #2762FF 100%)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 40 }}>
          <FundOutlined style={{ fontSize: 30 }} />
          <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: 1 }}>RealVest</span>
          <span style={{ fontSize: 11, border: "1px solid rgba(255,255,255,.4)", borderRadius: 4, padding: "1px 6px" }}>RWA</span>
        </div>
        <Title style={{ color: "#fff", fontSize: 34, lineHeight: 1.3, margin: "0 0 20px" }}>
          合规真实世界资产<br />代币化交易平台
        </Title>
        <Text style={{ color: "rgba(255,255,255,.8)", fontSize: 15, marginBottom: 32 }}>
          面向专业投资者与家族办公室，让不动产、基金份额、大宗商品在链上安全流通
        </Text>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {brandPoints.map((p, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                background: "rgba(255,255,255,.15)", fontSize: 16,
              }}>{p.icon}</div>
              <span style={{ fontSize: 14, color: "rgba(255,255,255,.9)" }}>{p.text}</span>
            </div>
          ))}
        </div>
        <Text style={{ color: "rgba(255,255,255,.4)", fontSize: 12, marginTop: 48 }}>
          © 2026 RealVest · 香港合规数字证券发行与交易基础设施
        </Text>
      </div>

      {/* 右侧登录卡片 */}
      <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", background: "#F7F9F9", padding: 24 }}>
        <Card style={{ width: 420, borderRadius: 12, boxShadow: "0 8px 32px rgba(15,118,110,.08)" }} styles={{ body: { padding: 32 } }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <Title level={3} style={{ marginBottom: 4 }}>欢迎回来</Title>
            <Text type="secondary">登录 RealVest 管理您的数字证券组合</Text>
          </div>
          <Tabs activeKey={tab} onChange={(k) => setTab(k as "login" | "register")} centered items={[
            {
              key: "login",
              label: "登录",
              children: (
                <Form name="login" onFinish={onLogin} size="large">
                  <Form.Item name="email" rules={[{ required: true, message: "请输入邮箱" }, { type: "email" }]}>
                    <Input prefix={<UserOutlined />} placeholder="邮箱" />
                  </Form.Item>
                  <Form.Item name="password" rules={[{ required: true, message: "请输入密码" }]}>
                    <Input.Password prefix={<LockOutlined />} placeholder="密码" />
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" htmlType="submit" loading={loading} block size="large">登录</Button>
                  </Form.Item>
                </Form>
              ),
            },
            {
              key: "register",
              label: "注册",
              children: (
                <Form name="register" onFinish={onRegister} size="large">
                  <Form.Item name="name" rules={[{ required: true, message: "请输入姓名" }]}>
                    <Input prefix={<IdcardOutlined />} placeholder="姓名" />
                  </Form.Item>
                  <Form.Item name="email" rules={[{ required: true, message: "请输入邮箱" }, { type: "email" }]}>
                    <Input prefix={<UserOutlined />} placeholder="邮箱" />
                  </Form.Item>
                  <Form.Item name="password" rules={[{ required: true, message: "请输入密码" }, { min: 8 }]}>
                    <Input.Password prefix={<LockOutlined />} placeholder="密码（至少8位）" />
                  </Form.Item>
                  <Form.Item name="role" rules={[{ required: true, message: "请选择角色" }]}>
                    <Select placeholder="选择角色" options={[
                      { value: "issuer", label: "发行方 (Issuer)" },
                      { value: "investor", label: "投资者 (Investor)" },
                    ]} />
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" htmlType="submit" loading={loading} block size="large">注册</Button>
                  </Form.Item>
                </Form>
              ),
            },
          ]} />
        </Card>
      </div>
    </div>
  );
}