"use client";

import { useEffect, useState } from "react";
import { Card, Col, Row, Statistic, Table, Tag, Typography } from "antd";
import { GoldOutlined, SwapOutlined, DollarOutlined, TeamOutlined } from "@ant-design/icons";
import { api } from "@/lib/api";

const { Title } = Typography;

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

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({ total_assets: 0, total_trades: 0, total_dividends: 0, total_users: 0 });
  const [recentTrades, setRecentTrades] = useState<RecentTrade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 从各模块汇总数据
    Promise.all([
      api.get<{ items: unknown[] }>("/assets/live"),
      api.get<{ items: unknown[] }>("/trades/orders"),
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
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const columns = [
    { title: "资产", dataIndex: "asset_name", key: "asset_name" },
    {
      title: "类型",
      dataIndex: "type",
      key: "type",
      render: (t: string) => <Tag color={t === "buy" ? "green" : "red"}>{t === "buy" ? "买入" : "卖出"}</Tag>,
    },
    { title: "数量", dataIndex: "amount", key: "amount" },
    { title: "单价", dataIndex: "price", key: "price", render: (v: number) => `$${Number(v).toLocaleString()}` },
    { title: "时间", dataIndex: "created_at", key: "created_at" },
  ];

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>仪表盘</Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}><Statistic title="资产总数" value={stats.total_assets} prefix={<GoldOutlined />} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}><Statistic title="交易笔数" value={stats.total_trades} prefix={<SwapOutlined />} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}><Statistic title="分红总额" value={stats.total_dividends} prefix={<DollarOutlined />} precision={2} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}><Statistic title="注册用户" value={stats.total_users} prefix={<TeamOutlined />} /></Card>
        </Col>
      </Row>
      <Card title="最近交易" style={{ marginTop: 24 }}>
        <Table dataSource={recentTrades} columns={columns} rowKey="id" loading={loading} pagination={false} />
      </Card>
    </div>
  );
}
