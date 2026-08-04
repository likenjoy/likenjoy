"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Card, Table, Button, Space, Tag, Switch, Modal, Form, Input, InputNumber, Select,
  Typography, message, Popconfirm,
} from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, PictureOutlined } from "@ant-design/icons";
import { api } from "@/lib/api";

const { Title } = Typography;

interface Ad {
  id: string;
  title: string;
  image_url: string;
  link_url: string;
  position: string;
  enabled: boolean;
  sort_order: number;
  created_at?: string;
}

const POSITIONS = [
  { label: "首页横幅", value: "home_banner" },
  { label: "交易页横幅", value: "trade_banner" },
];

export default function AdminAdsPage() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Ad | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(() => {
    setLoading(true);
    api
      .get<{ data: Ad[] }>("/admin/ads")
      .then((r) => setAds(r.data || []))
      .catch(() => message.error("加载广告失败"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ position: "home_banner", enabled: true, sort_order: 0 });
    setModalOpen(true);
  };

  const openEdit = (ad: Ad) => {
    setEditing(ad);
    form.setFieldsValue(ad);
    setModalOpen(true);
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/admin/ads/${editing.id}`, values);
        message.success("广告已更新");
      } else {
        await api.post("/admin/ads", values);
        message.success("广告已创建");
      }
      setModalOpen(false);
      load();
    } catch (e: any) {
      message.error(e?.message || "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/admin/ads/${id}`);
      message.success("已删除");
      load();
    } catch (e: any) {
      message.error(e?.message || "删除失败");
    }
  };

  const handleToggle = async (ad: Ad, enabled: boolean) => {
    try {
      await api.put(`/admin/ads/${ad.id}`, { ...ad, enabled });
      message.success(enabled ? "已上线" : "已下线");
      load();
    } catch (e: any) {
      message.error(e?.message || "操作失败");
    }
  };

  const columns = [
    { title: "标题", dataIndex: "title", key: "title", render: (v: string) => <Typography.Text strong>{v}</Typography.Text> },
    {
      title: "预览", dataIndex: "image_url", key: "image_url",
      render: (v: string, r: Ad) => v ? (
        <img src={v} alt={r.title} style={{ width: 120, height: 56, objectFit: "cover", borderRadius: 6 }} />
      ) : <Tag icon={<PictureOutlined />} color="default">纯文字</Tag>,
    },
    {
      title: "位置", dataIndex: "position", key: "position",
      render: (v: string) => <Tag color="blue">{POSITIONS.find((p) => p.value === v)?.label || v}</Tag>,
    },
    { title: "排序", dataIndex: "sort_order", key: "sort_order", width: 80 },
    {
      title: "状态", dataIndex: "enabled", key: "enabled", width: 100,
      render: (v: boolean, r: Ad) => <Switch checked={v} onChange={(c) => handleToggle(r, c)} size="small" />,
    },
    {
      title: "操作", key: "actions", width: 130,
      render: (_: unknown, r: Ad) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
          <Popconfirm title="确认删除该广告？" onConfirm={() => handleDelete(r.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Title level={4} style={{ margin: 0 }}>广告管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增广告</Button>
      </div>

      <Card>
        <Table<Ad> rowKey="id" dataSource={ads} columns={columns} loading={loading} pagination={false} size="middle" />
      </Card>

      <Modal
        title={editing ? "编辑广告" : "新增广告"}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        confirmLoading={saving}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="title" label="广告标题" rules={[{ required: true, message: "请输入标题" }]}>
            <Input placeholder="例如：某基金份额代币化发行中" />
          </Form.Item>
          <Form.Item name="image_url" label="图片地址（可选）">
            <Input placeholder="https://.../banner.png（留空则显示纯文字横幅）" />
          </Form.Item>
          <Form.Item name="link_url" label="跳转链接（可选）">
            <Input placeholder="https://...（点击广告跳转）" />
          </Form.Item>
          <Form.Item name="position" label="广告位">
            <Select options={POSITIONS} />
          </Form.Item>
          <Space size={16}>
            <Form.Item name="sort_order" label="排序（越小越靠前）">
              <InputNumber min={0} style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="enabled" label="启用" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </Space>
  );
}
