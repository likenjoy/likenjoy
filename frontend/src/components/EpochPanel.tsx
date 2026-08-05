"use client";

// Epoch 结算周期面板：展示当前结算状态 + 创建/关闭操作
// 参考 Centrifuge investment epoch：订单收集期 → 批量结算（防抢跑）
import { useCallback, useEffect, useState } from "react";
import { Card, Tag, Space, Button, Typography, message, Statistic, Row, Col } from "antd";
import { ClockCircleOutlined, ThunderboltOutlined, CheckCircleOutlined } from "@ant-design/icons";
import { api } from "@/lib/api";

const { Text } = Typography;

interface Epoch {
  id: string;
  asset_id: string;
  status: string; // open / closed
  created_at: string;
  closed_at: string;
}

interface Props {
  assetId: string | undefined;
}

export default function EpochPanel({ assetId }: Props) {
  const [epochs, setEpochs] = useState<Epoch[]>([]);
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState(false);

  const load = useCallback(() => {
    if (!assetId) return;
    api
      .get<{ data: Epoch[] }>(`/trades/epochs?asset_id=${assetId}`)
      .then((r) => setEpochs(r.data || []))
      .catch(() => {});
  }, [assetId]);

  useEffect(load, [load]);

  const open = epochs.find((e) => e.status === "open");
  const closed = epochs.filter((e) => e.status === "closed");

  const handleCreate = async () => {
    if (!assetId) return;
    setLoading(true);
    try {
      await api.post("/trades/epochs", { asset_id: assetId });
      message.success("结算周期已创建：进入订单收集期");
      load();
    } catch (e: any) {
      message.error(e?.message || "创建失败");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = async () => {
    if (!open) return;
    setClosing(true);
    try {
      const r = await api.post<{ matched_orders: number }>(`/trades/epochs/${open.id}/close`);
      message.success(`结算完成：批量撮合 ${r.matched_orders || 0} 笔订单`);
      load();
    } catch (e: any) {
      message.error(e?.message || "关闭失败");
    } finally {
      setClosing(false);
    }
  };

  return (
    <Card
      title={<Space><ClockCircleOutlined style={{ color: "#1AAB9B" }} />结算周期（Epoch）</Space>}
      extra={<Text type="secondary" style={{ fontSize: 12 }}>两阶段结算 · 防抢跑</Text>}
      style={{ borderRadius: 12 }}
    >
      <Row gutter={16} align="middle">
        <Col flex="auto">
          {open ? (
            <Space direction="vertical" size={4}>
              <Space>
                <Tag color="processing" icon={<ClockCircleOutlined />}>订单收集期</Tag>
                <Text strong>当前周期 #{open.id.slice(0, 8)}</Text>
              </Space>
              <Text type="secondary" style={{ fontSize: 12 }}>
                开始于 {open.created_at} · 关闭后按价格优先批量结算
              </Text>
            </Space>
          ) : (
            <Space direction="vertical" size={4}>
              <Space>
                <Tag color="default">无开放周期</Tag>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {closed.length ? `已完成 ${closed.length} 个结算周期` : "尚未创建结算周期"}
                </Text>
              </Space>
            </Space>
          )}
        </Col>
        <Col>
          <Space>
            {!open && (
              <Button icon={<ThunderboltOutlined />} loading={loading} onClick={handleCreate} disabled={!assetId}>
                创建结算周期
              </Button>
            )}
            {open && (
              <Button type="primary" icon={<CheckCircleOutlined />} loading={closing} onClick={handleClose}>
                关闭并结算
              </Button>
            )}
          </Space>
        </Col>
      </Row>
    </Card>
  );
}
