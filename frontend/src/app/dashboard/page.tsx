"use client";

import { useEffect, useState } from "react";
import { Card, Col, Row, Statistic, Table, Tag, Typography, Button, Space } from "antd";
import {
  GoldOutlined, SwapOutlined, DollarOutlined, TeamOutlined,
  ArrowRightOutlined, ThunderboltOutlined, SafetyCertificateOutlined, WalletOutlined,
} from "@ant-design/icons";
import Link from "next/link";
import { api } from "@/lib/api";

const { Title, Text } = Typography;

interface DashboardStats {
  total_assets: number;
  total_trades: number;
  total_dividends: number;
  total_users: number;
}

interface RecentTrade {
  id: string;
  asset_name: string;
  type: string;
  amount: number;
  price: number;
  created_at: string;
}

const quickActions = [
  { title: "浏览资产", desc: "发现可投资 RWA 资产", icon: <GoldOutlined />, href: "/assets", color: "#2762FF" },
  { title: "交易中心", desc: "下单与订单管理", icon: <SwapOutlined />, href: "/trade", color: "#005B96" },
  { title: "我的持仓", desc: "余额与免 Gas 转账", icon: <WalletOutlined />, href: "/portfolio", color: "#16A34A" },
  { title: "KYC 认证", desc: "专业投资者认证", icon: <SafetyCertificateOutlined />, href: "/kyc", color: "#FFC012" },
];

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({ total_assets: 0, total_trades: 0, total_dividends: 0, total_users: 0 });
  const [recentTrades, setRecentTrades] = useState<RecentTrade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<{ items: unknown[] }>("/assets/live").catch(() => ({ items: [] })),
      api.get<{ items: unknown[] }>("/trades/orders").catch(() => ({ items: [] })),
    ])
      .then(([assetsRes, tradesRes]) => {
        setStats({
          total_assets: assetsRes.items?.length || 0,
          total_trades: tradesRes.items?.length || 0,
          total_dividends: 0,
          total_users: 1,
        });
        setRecentTrades((tradesRes.items || []) as RecentTrade[]);
      })
      .finally(() => setLoading(false));
  }, []);

  const columns = [
    { title: "资产", dataIndex: "asset_name", key: "asset_name", render: (v: string) => <Text strong>{v}</Text> },
    {
      title: "类型", dataIndex: "type", key: "type",
      render: (t: string) => <Tag color={t === "buy" ? "success" : "error"}>{t === "buy" ? "买入" : "卖出"}</Tag>,
    },
    { title: "数量", dataIndex: "amount", key: "amount", render: (v: number) => Number(v).toLocaleString() },
    { title: "单价", dataIndex: "price", key: "price", render: (v: number) => `$${Number(v).toLocaleString()}` },
    { title: "时间", dataIndex: "created_at", key: "created_at", render: (v: string) => <Text type="secondary">{v}</Text> },
  ];

  return (
    <div>
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Title level={4} style={{ margin: 0 }}>仪表盘</Title>
          <Link href="/assets"><Button type="primary" icon={<ArrowRightOutlined />}>开始投资</Button></Link>
        </div>

        {/* 统计卡 */}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card loading={loading} hoverable>
              <Statistic title="资产总数" value={stats.total_assets} prefix={<GoldOutlined style={{ color: "#2762FF" }} />} valueStyle={{ color: "#252B34" }} />
              <Text type="secondary" style={{ fontSize: 12 }}>已上线可投资资产</Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card loading={loading} hoverable>
              <Statistic title="交易笔数" value={stats.total_trades} prefix={<SwapOutlined style={{ color: "#005B96" }} />} valueStyle={{ color: "#252B34" }} />
              <Text type="secondary" style={{ fontSize: 12 }}>全部订单记录</Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card loading={loading} hoverable>
              <Statistic title="累计分红" value={stats.total_dividends} prefix={<DollarOutlined style={{ color: "#16A34A" }} />} precision={2} valueStyle={{ color: "#252B34" }} />
              <Text type="secondary" style={{ fontSize: 12 }}>已发放收益（HKD）</Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card loading={loading} hoverable>
              <Statistic title="注册用户" value={stats.total_users} prefix={<TeamOutlined style={{ color: "#667085" }} />} valueStyle={{ color: "#252B34" }} />
              <Text type="secondary" style={{ fontSize: 12 }}>平台认证投资者</Text>
            </Card>
          </Col>
        </Row>

        {/* 快速入口 */}
        <Row gutter={[16, 16]}>
          {quickActions.map((a) => (
            <Col xs={24} sm={12} lg={6} key={a.title}>
              <Link href={a.href} style={{ textDecoration: "none" }}>
                <Card hoverable>
                  <Space align="start" size={12}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                      background: `${a.color}14`, color: a.color, fontSize: 20,
                    }}>{a.icon}</div>
                    <div>
                      <Text strong style={{ display: "block", color: "#252B34" }}>{a.title}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>{a.desc}</Text>
                    </div>
                  </Space>
                </Card>
              </Link>
            </Col>
          ))}
        </Row>

        {/* 最近交易 */}
        <Card
          title={<Space><ThunderboltOutlined style={{ color: "#2762FF" }} />最近交易</Space>}
          extra={<Link href="/trade"><Text type="secondary" style={{ fontSize: 12 }}>查看全部 →</Text></Link>}
        >
          <Table dataSource={recentTrades} columns={columns} rowKey="id" loading={loading} pagination={false} size="middle" />
        </Card>
      </Space>
    </div>
  );
}
