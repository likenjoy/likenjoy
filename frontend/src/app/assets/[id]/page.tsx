"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, Descriptions, Tag, Table, Space, Button, Typography, message, Alert, Row, Col, Statistic } from "antd";
import { CopyOutlined, SafetyCertificateOutlined, LinkOutlined } from "@ant-design/icons";
import { api } from "@/lib/api";
import PerformanceChart from "@/components/PerformanceChart";

const { Title, Text } = Typography;

interface Asset {
  id: string;
  name: string;
  symbol: string;
  asset_type: string;
  total_supply: string;
  price_per_unit: string;
  min_investment: string;
  status: string;
  contract_address: string;
  description: string;
  created_at: string;
}

interface DividendPlan {
  id: string;
  name: string;
  type: string;
  rate: number;
  frequency: string;
  status: string;
  next_pay_date: string;
  total_periods: number;
  paid_periods: number;
}

const statusColor: Record<string, string> = { draft: "default", reviewing: "processing", approved: "blue", issuing: "cyan", live: "green", rejected: "red" };

export default function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [plans, setPlans] = useState<DividendPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.get<Asset>(`/assets/${id}`).then(setAsset).catch(() => {});
    api.get<DividendPlan[]>(`/assets/${id}/dividends/plans`)
      .then(setPlans).catch(() => setPlans([]))
      .finally(() => setLoading(false));
  }, [id]);

  if (!asset) return <Card loading={loading} />;

  // 绩效示意数据（真实历史数据接入后替换；此处由分红 rate 推算，标注"示例"）
  const base = (asset.price_per_unit ? Number(asset.price_per_unit) : 100) || 100;
  const annualRate = plans.length > 0 ? Math.max(plans[0].rate * 100, 1) : 5;
  const perfData = [
    { label: "M0", value: 100 },
    { label: "M1", value: +(100 + annualRate / 12 * 1).toFixed(2) },
    { label: "M2", value: +(100 + annualRate / 12 * 2).toFixed(2) },
    { label: "M3", value: +(100 + annualRate / 12 * 3).toFixed(2) },
    { label: "M6", value: +(100 + annualRate / 2).toFixed(2) },
    { label: "M12", value: +(100 + annualRate).toFixed(2) },
  ];

  const copyAddr = () => {
    if (asset.contract_address) {
      navigator.clipboard.writeText(asset.contract_address);
      message.success("合约地址已复制");
    }
  };

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Row gutter={16}>
        <Col span={14}>
          <Card title={`${asset.name} (${asset.symbol})`} loading={loading}>
            <Descriptions column={2} size="small">
              <Descriptions.Item label="资产类型">{asset.asset_type}</Descriptions.Item>
              <Descriptions.Item label="状态"><Tag color={statusColor[asset.status] || "default"}>{asset.status}</Tag></Descriptions.Item>
              <Descriptions.Item label="总供应量">{Number(asset.total_supply).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="单价">{asset.price_per_unit} HKD</Descriptions.Item>
              <Descriptions.Item label="最小认购">{asset.min_investment} HKD</Descriptions.Item>
              <Descriptions.Item label="发行时间">{new Date(asset.created_at).toLocaleDateString()}</Descriptions.Item>
              <Descriptions.Item label="描述" span={2}>{asset.description || "—"}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col span={10}>
          <Card title="链上信息" loading={loading}>
            <Space direction="vertical" style={{ width: "100%" }} size={8}>
              <Statistic title="合约地址" value={asset.contract_address ? asset.contract_address.slice(0, 12) + "..." : "未上链"} valueStyle={{ fontSize: 16 }} />
              <Space>
                <Button size="small" icon={<CopyOutlined />} onClick={copyAddr} disabled={!asset.contract_address}>复制地址</Button>
                <Button size="small" icon={<LinkOutlined />} disabled={!asset.contract_address} onClick={() => message.info("主网上线后接入区块浏览器")}>区块浏览器</Button>
              </Space>
              <Alert type="info" showIcon message="储备证明"
                description="上线后在此展示第三方审计报告与链上资产核对（Proof of Reserves）。"
                action={<Button size="small" icon={<SafetyCertificateOutlined />} onClick={() => message.info("审计报告待接入")}>查看</Button>} />
            </Space>
          </Card>
        </Col>
      </Row>

      <Card title="绩效表现">
        <PerformanceChart data={perfData} unit="%" color="#1677ff" />
        <Text type="secondary" style={{ fontSize: 12 }}>示例数据：按分红计划年化 {annualRate.toFixed(1)}% 推算，接入真实历史数据后自动更新。</Text>
      </Card>

      <Card title={`分红计划 (${plans.length})`}>
        <Table<DividendPlan> rowKey="id" dataSource={plans} size="small" pagination={false}
          columns={[
            { title: "计划", dataIndex: "name" },
            { title: "类型", dataIndex: "type" },
            { title: "年化率", dataIndex: "rate", render: (v: number) => `${(v * 100).toFixed(1)}%` },
            { title: "频率", dataIndex: "frequency" },
            { title: "期数", render: (_, r) => `${r.paid_periods}/${r.total_periods}` },
            { title: "状态", dataIndex: "status", render: (v: string) => <Tag>{v}</Tag> },
          ]} />
      </Card>
    </Space>
  );
}
