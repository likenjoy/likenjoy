"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Form, Input, Button, Card, message, Typography, Select, Tabs } from "antd";
import { UserOutlined, LockOutlined, IdcardOutlined } from "@ant-design/icons";
import { api } from "@/lib/api";

const { Title, Text } = Typography;

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
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "#f0f2f5" }}>
      <Card style={{ width: 400, boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <Title level={3} style={{ marginBottom: 4 }}>RealVest</Title>
          <Text type="secondary">合规RWA私募资产交易平台</Text>
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
                  <Button type="primary" htmlType="submit" loading={loading} block>登录</Button>
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
                  <Button type="primary" htmlType="submit" loading={loading} block>注册</Button>
                </Form.Item>
              </Form>
            ),
          },
        ]} />
      </Card>
    </div>
  );
}
