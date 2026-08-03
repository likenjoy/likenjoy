"use client";

import { useEffect, useState } from "react";
import { Button, Card, Descriptions, Form, Input, Select, Steps, Tag, Typography, Upload, message } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import { api } from "@/lib/api";

const { Title } = Typography;

interface KYCSubmission {
  id: string;
  user_id: string;
  status: string;
  created_at: string;
}

const statusColors: Record<string, string> = {
  not_submitted: "default",
  pending: "processing",
  approved: "green",
  rejected: "red",
  expired: "orange",
};

const statusLabels: Record<string, string> = {
  not_submitted: "未提交",
  pending: "审核中",
  approved: "已通过",
  rejected: "已拒绝",
  expired: "已过期",
};

const steps = [
  { title: "提交资料" },
  { title: "审核中" },
  { title: "认证完成" },
];

interface Accreditation {
  id: string;
  user_id: string;
  level: string;
  net_worth_proof: string;
  status: string;
  expires_at: string;
}

export default function KYCPage() {
  const [submission, setSubmission] = useState<KYCSubmission | null>(null);
  const [accreditation, setAccreditation] = useState<Accreditation | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [accredLevel, setAccredLevel] = useState("individual");
  const [fullName, setFullName] = useState("");
  const [country, setCountry] = useState("HK");

  const fetchKYC = () => {
    setLoading(true);
    const userId = localStorage.getItem("user_id");
    if (!userId) {
      setLoading(false);
      return;
    }
    api.get<KYCSubmission>(`/kyc/status/${userId}`)
      .then((res) => setSubmission(res))
      .catch(() => setSubmission(null));
    api.get<Accreditation>(`/kyc/accreditation/${userId}`)
      .then((res) => { setAccreditation(res); setAccredLevel(res.level || "individual"); })
      .catch(() => setAccreditation(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchKYC(); }, []);

  const handleSubmit = async () => {
    const userId = localStorage.getItem("user_id");
    if (!userId) return;
    setSubmitting(true);
    try {
      await api.post("/kyc/submit", {
        user_id: userId,
        full_name: fullName,
        country,
        accreditation_level: accredLevel,
        net_worth_proof: accredLevel === "professional_investor" ? "proof-pending-upload" : "",
      });
      message.success("KYC 资料已提交");
      fetchKYC();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : "提交失败");
    } finally {
      setSubmitting(false);
    }
  };

  const getStepCurrent = () => {
    if (!submission) return 0;
    if (submission.status === "pending") return 1;
    if (submission.status === "approved") return 2;
    if (submission.status === "rejected") return 0;
    return 0;
  };

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>KYC 认证</Title>
      <Card style={{ marginBottom: 24 }}>
        <Steps current={getStepCurrent()} items={steps} />
      </Card>
      {submission ? (
        <Card loading={loading}>
          <Descriptions title="认证信息" column={2}>
            <Descriptions.Item label="用户ID">{submission.user_id}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={statusColors[submission.status]}>{statusLabels[submission.status] || submission.status}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="提交时间">{submission.created_at}</Descriptions.Item>
          </Descriptions>
        </Card>
      ) : (
        <Card title="提交 KYC 认证" loading={loading}>
          <p style={{ marginBottom: 16, color: "#666" }}>
            点击下方按钮提交KYC认证申请。提交后管理员将审核您的资料。
          </p>
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8 }}>姓名（用于合规筛查）：</div>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="护照/身份证姓名（拼音或英文）" style={{ marginBottom: 12 }} />
            <div style={{ marginBottom: 8 }}>居住国家/地区（ISO 代码，受限国家将被拒绝）：</div>
            <Select
              value={country}
              onChange={setCountry}
              style={{ width: "100%", marginBottom: 12 }}
              options={[
                { value: "HK", label: "中国香港 (HK)" },
                { value: "CN", label: "中国大陆 (CN)" },
                { value: "SG", label: "新加坡 (SG)" },
                { value: "US", label: "美国 (US)" },
                { value: "GB", label: "英国 (GB)" },
                { value: "JP", label: "日本 (JP)" },
              ]}
            />
            <div style={{ marginBottom: 8 }}>投资者类型（影响可认购产品范围）：</div>
            <Select
              value={accredLevel}
              onChange={setAccredLevel}
              style={{ width: "100%" }}
              options={[
                { value: "individual", label: "个人投资者（零售）" },
                { value: "professional_investor", label: "专业投资者（需净资产证明，如香港≥800万港币流动资产）" },
              ]}
            />
            {accredLevel === "professional_investor" && (
              <Upload
                beforeUpload={() => false}
                maxCount={1}
                onChange={(info) => {
                  const f = info.fileList[0]?.originFileObj as File | undefined;
                  message.info(f ? `已选择资产证明：${f.name}` : "");
                }}
              >
                <Button icon={<UploadOutlined />} style={{ marginTop: 12 }}>上传资产证明文件</Button>
              </Upload>
            )}
          </div>
          {accreditation && (
            <Descriptions title="专业投资者认证" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="类型">{accreditation.level === "professional_investor" ? "专业投资者" : "个人投资者"}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={accreditation.status === "approved" ? "green" : accreditation.status === "pending" ? "processing" : "default"}>
                  {accreditation.status === "approved" ? "已认证" : accreditation.status === "pending" ? "审核中" : "未认证"}
                </Tag>
              </Descriptions.Item>
              {accreditation.expires_at && (
                <Descriptions.Item label="有效期至">{new Date(accreditation.expires_at).toLocaleDateString()}</Descriptions.Item>
              )}
            </Descriptions>
          )}
          <Button type="primary" onClick={handleSubmit} loading={submitting} block>
            提交 KYC 认证
          </Button>
        </Card>
      )}
    </div>
  );
}
