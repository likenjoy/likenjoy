"use client";

import { useEffect, useState } from "react";
import { Card, Table, Tag, Drawer, Descriptions, Button, Tabs, Input, Space, message, Typography, Alert, Statistic } from "antd";
import { api } from "@/lib/api";

const { Title, Text } = Typography;

interface AdminUser {
  id: string;
  email: string;
  role: string;
  status: string;
  wallet_address: string;
  kyc_status: string;
  created_at: string;
}

interface PendingKYC {
  id: string;
  user_id: string;
  email: string;
  status: string;
  submitted_at: string;
  doc_count: number;
}

const kycColor: Record<string, string> = {
  not_submitted: "default", pending: "processing", approved: "green", rejected: "red", expired: "orange", "": "default",
};
const kycLabel: Record<string, string> = {
  not_submitted: "未提交", pending: "审核中", approved: "已通过", rejected: "已拒绝", expired: "已过期", "": "未提交",
};

export default function AdminInvestorsPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pending, setPending] = useState<PendingKYC[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [drawerUser, setDrawerUser] = useState<AdminUser | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const isAdmin = typeof window !== "undefined" && localStorage.getItem("user_role") === "admin";

  const loadUsers = (p = 1) => {
    api.get<{ data: AdminUser[]; total: number }>(`/admin/users?page=${p}&size=20`)
      .then((r) => { setUsers(r.data || []); setTotal(r.total || 0); })
      .catch(() => {});
  };
  const loadPending = () => {
    api.get<{ data: PendingKYC[] }>("/admin/kyc/pending")
      .then((r) => setPending(r.data || []))
      .catch(() => {});
  };
  useEffect(() => { loadUsers(); loadPending(); }, []);

  const handleReview = async (submissionId: string, action: "approve" | "reject") => {
    setReviewing(true);
    try {
      const reviewerId = localStorage.getItem("user_id") || "";
      await api.post("/admin/kyc/review", { submission_id: submissionId, reviewer_id: reviewerId, action });
      message.success(action === "approve" ? "已通过" : "已拒绝");
      setDrawerUser(null);
      loadUsers(page); loadPending();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : "操作失败");
    } finally {
      setReviewing(false);
    }
  };

  if (!isAdmin) {
    return <Card><Alert type="warning" showIcon message="需要管理员权限" /></Card>;
  }

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Title level={4} style={{ margin: 0 }}>投资者管理（合规审核）</Title>
      <Tabs items={[
        {
          key: "pending",
          label: `待审核 KYC (${pending.length})`,
          children: (
            <Card>
              <Table<PendingKYC> rowKey="id" dataSource={pending} size="small" pagination={false}
                columns={[
                  { title: "邮箱", dataIndex: "email" },
                  { title: "提交时间", dataIndex: "submitted_at", render: (v: string) => new Date(v).toLocaleString() },
                  { title: "文件数", dataIndex: "doc_count" },
                  {
                    title: "操作",
                    render: (_, rec) => (
                      <Space>
                        <Button size="small" type="primary" loading={reviewing} onClick={() => handleReview(rec.id, "approve")}>通过</Button>
                        <Button size="small" danger loading={reviewing} onClick={() => handleReview(rec.id, "reject")}>拒绝</Button>
                      </Space>
                    ),
                  },
                ]} />
            </Card>
          ),
        },
        {
          key: "users",
          label: `全部用户 (${total})`,
          children: (
            <Card>
              <Table<AdminUser> rowKey="id" dataSource={users} size="small"
                pagination={{ current: page, pageSize: 20, total, onChange: (p) => { setPage(p); loadUsers(p); } }}
                onRow={(rec) => ({ onClick: () => setDrawerUser(rec), style: { cursor: "pointer" } })}
                columns={[
                  { title: "邮箱", dataIndex: "email" },
                  { title: "角色", dataIndex: "role", render: (v: string) => <Tag color={v === "admin" ? "purple" : v === "issuer" ? "blue" : "green"}>{v}</Tag> },
                  { title: "KYC", dataIndex: "kyc_status", render: (v: string) => <Tag color={kycColor[v]}>{kycLabel[v]}</Tag> },
                  { title: "钱包", dataIndex: "wallet_address", render: (v: string) => v ? <Text code>{v.slice(0, 10)}...</Text> : "-" },
                  { title: "注册时间", dataIndex: "created_at", render: (v: string) => new Date(v).toLocaleDateString() },
                ]} />
            </Card>
          ),
        },
      ]} />

      {/* 抽屉：用户详情 + 审核（仿 Centrifuge InvestorDrawer） */}
      <Drawer
        title="投资者详情"
        open={!!drawerUser}
        onClose={() => setDrawerUser(null)}
        width={420}
      >
        {drawerUser && (
          <>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="邮箱">{drawerUser.email}</Descriptions.Item>
              <Descriptions.Item label="角色">{drawerUser.role}</Descriptions.Item>
              <Descriptions.Item label="账户状态">{drawerUser.status}</Descriptions.Item>
              <Descriptions.Item label="KYC 状态">
                <Tag color={kycColor[drawerUser.kyc_status]}>{kycLabel[drawerUser.kyc_status]}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="绑定钱包">{drawerUser.wallet_address || "未绑定"}</Descriptions.Item>
              <Descriptions.Item label="注册时间">{new Date(drawerUser.created_at).toLocaleString()}</Descriptions.Item>
            </Descriptions>
            <div style={{ marginTop: 24 }}>
              <Text type="secondary">KYC 审核操作：</Text>
              <Space style={{ marginTop: 8 }}>
                <Button type="primary" onClick={() => handleReview("", "approve")}>通过</Button>
                <Button danger onClick={() => handleReview("", "reject")}>拒绝</Button>
              </Space>
              <div style={{ marginTop: 12, color: "#999", fontSize: 12 }}>
                说明：抽屉内审核需在"待审核 KYC"列表操作（此处展示用户信息）。
              </div>
            </div>
          </>
        )}
      </Drawer>
    </Space>
  );
}
