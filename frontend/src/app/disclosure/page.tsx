"use client";

import { useState, useEffect } from "react";
import {
  Card,
  Descriptions,
  Progress,
  Collapse,
  Checkbox,
  Button,
  Tag,
  Space,
  Typography,
  Alert,
  Spin,
  message,
} from "antd";
import {
  SafetyCertificateOutlined,
  LinkOutlined,
  FileTextOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  BankOutlined,
  DollarOutlined,
} from "@ant-design/icons";

const { Title, Text, Paragraph } = Typography;

interface DisclosureData {
  asset: {
    id: string;
    name: string;
    type: string;
    valuation: string;
    custodian: string;
    legalOpinionUrl: string;
    auditReportUrl: string;
    description: string;
  };
  token: {
    contractAddress: string;
    standard: string;
    totalSupply: string;
    decimals: number;
    chainId: number;
    chainName: string;
    blockExplorer: string;
  };
  offering: {
    targetAmount: string;
    raisedAmount: string;
    unitPrice: string;
    minInvestment: string;
    lockupPeriod: string;
    startDate: string;
    endDate: string;
    participantCount: number;
    maxParticipants: number;
  };
  risks: string[];
  issuer: {
    name: string;
    registrationNumber: string;
    jurisdiction: string;
    website: string;
  };
  useOfFunds: string[];
  onChainRecords: {
    txHash: string;
    description: string;
    timestamp: string;
  }[];
}

// 模拟数据 - 实际从后端API获取
const mockData: DisclosureData = {
  asset: {
    id: "GOLD-001",
    name: "黄金储备代币化产品一期",
    type: "贵金属",
    valuation: "5,000,000 USD",
    custodian: "ABC Trust Company (Hong Kong)",
    legalOpinionUrl: "#",
    auditReportUrl: "#",
    description: "本产品对应托管在ABC Trust Company金库中的500公斤AU9999标准金条，每枚代币对应1克黄金的所有权。资产由独立第三方每月审计。",
  },
  token: {
    contractAddress: "0x（部署后填入）",
    standard: "ERC-3643",
    totalSupply: "500,000",
    decimals: 18,
    chainId: 11155111,
    chainName: "Ethereum Sepolia (测试网)",
    blockExplorer: "https://sepolia.etherscan.io",
  },
  offering: {
    targetAmount: "5,000,000",
    raisedAmount: "2,350,000",
    unitPrice: "10",
    minInvestment: "10,000",
    lockupPeriod: "12个月",
    startDate: "2026-08-01",
    endDate: "2026-10-31",
    participantCount: 23,
    maxParticipants: 50,
  },
  risks: [
    "市场风险：黄金价格波动可能导致代币净值变化，历史表现不代表未来收益。",
    "流动性风险：本产品为私募发行，二级市场流动性有限，投资者可能无法在预期时间内以合理价格退出。",
    "托管风险：底层资产由第三方托管机构保管，存在托管机构运营风险。",
    "监管风险：数字资产监管政策可能发生变化，影响代币的合法性和可交易性。",
    "技术风险：智能合约可能存在未被发现的漏洞，尽管已通过第三方审计。",
    "汇率风险：本产品以美元计价，非美元投资者面临汇率波动风险。",
  ],
  issuer: {
    name: "RealVest Digital Assets Limited",
    registrationNumber: "HK-12345678",
    jurisdiction: "香港特别行政区",
    website: "https://realvest.ai",
  },
  useOfFunds: [
    "80% 用于购买实物黄金并托管",
    "10% 用于运营和合规成本",
    "5% 用于技术开发和审计",
    "5% 作为流动性储备",
  ],
  onChainRecords: [
    {
      txHash: "0x（部署后填入）",
      description: "ERC-3643代币合约部署",
      timestamp: "2026-08-01 10:00 UTC+8",
    },
    {
      txHash: "0x（部署后填入）",
      description: "首次代币发行（500,000枚）",
      timestamp: "2026-08-01 12:00 UTC+8",
    },
  ],
};

export default function DisclosurePage() {
  const [data, setData] = useState<DisclosureData | null>(null);
  const [loading, setLoading] = useState(true);
  const [riskAcknowledged, setRiskAcknowledged] = useState(false);
  const [kycVerified, setKycVerified] = useState(false);

  useEffect(() => {
    // TODO: 从后端API获取实际数据
    setTimeout(() => {
      setData(mockData);
      setLoading(false);
    }, 500);

    // 检查KYC状态
    const token = localStorage.getItem("token");
    if (token) {
      setKycVerified(true); // 简化：有token即视为已KYC
    }
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 100 }}>
        <Spin size="large" tip="加载募集公示数据..." />
      </div>
    );
  }

  if (!data) return null;

  const raisedPercent = Math.round(
    (parseFloat(data.offering.raisedAmount) / parseFloat(data.offering.targetAmount)) * 100
  );

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ marginBottom: 4 }}>
          <FileTextOutlined style={{ marginRight: 8 }} />
          项目披露平台 — 募集公示
        </Title>
        <Text type="secondary">
          根据香港证监会（SFC）及欧盟MiCA框架要求，以下为本次RWA代币发行的完整披露信息
        </Text>
      </div>

      {/* 合规声明 */}
      <Alert
        type="info"
        showIcon
        icon={<SafetyCertificateOutlined />}
        message="合规声明"
        description="本募集仅面向《证券及期货条例》定义的「专业投资者」。投资者需完成KYC认证及合格投资者声明后方可参与认购。本页面所有信息均真实、准确、完整，并已由独立法律顾问审核。"
        style={{ marginBottom: 24 }}
      />

      {/* 资产详情卡片 */}
      <Card
        title={
          <Space>
            <BankOutlined />
            资产信息
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="资产名称">{data.asset.name}</Descriptions.Item>
          <Descriptions.Item label="资产类型">
            <Tag color="gold">{data.asset.type}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="资产估值">{data.asset.valuation}</Descriptions.Item>
          <Descriptions.Item label="托管机构">{data.asset.custodian}</Descriptions.Item>
          <Descriptions.Item label="法律意见书">
            <Button type="link" icon={<LinkOutlined />} size="small">
              查看
            </Button>
          </Descriptions.Item>
          <Descriptions.Item label="审计报告">
            <Button type="link" icon={<LinkOutlined />} size="small">
              查看
            </Button>
          </Descriptions.Item>
          <Descriptions.Item label="资产描述" span={2}>
            {data.asset.description}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 代币信息卡片 */}
      <Card
        title={
          <Space>
            <LinkOutlined />
            代币信息
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="代币标准">
            <Tag color="blue">{data.token.standard}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="总供应量">{data.token.totalSupply} 枚</Descriptions.Item>
          <Descriptions.Item label="合约地址" span={2}>
            <Text copyable style={{ fontFamily: "monospace", fontSize: 12 }}>
              {data.token.contractAddress}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="区块链网络">{data.token.chainName}</Descriptions.Item>
          <Descriptions.Item label="链ID">{data.token.chainId}</Descriptions.Item>
          <Descriptions.Item label="区块浏览器" span={2}>
            <Button type="link" icon={<LinkOutlined />} size="small">
              {data.token.blockExplorer}
            </Button>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 募集进度 */}
      <Card
        title={
          <Space>
            <DollarOutlined />
            募集条款与进度
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Descriptions column={2} bordered size="small" style={{ marginBottom: 16 }}>
          <Descriptions.Item label="募集总额">{data.offering.targetAmount} USD</Descriptions.Item>
          <Descriptions.Item label="代币单价">{data.offering.unitPrice} USD/枚</Descriptions.Item>
          <Descriptions.Item label="最小认购额">{data.offering.minInvestment} USD</Descriptions.Item>
          <Descriptions.Item label="锁定期">{data.offering.lockupPeriod}</Descriptions.Item>
          <Descriptions.Item label="募集开始">{data.offering.startDate}</Descriptions.Item>
          <Descriptions.Item label="募集截止">{data.offering.endDate}</Descriptions.Item>
          <Descriptions.Item label="参与人数">
            {data.offering.participantCount} / {data.offering.maxParticipants} 人
          </Descriptions.Item>
        </Descriptions>

        <div style={{ marginBottom: 8 }}>
          <Text strong>募集进度</Text>
        </div>
        <Progress
          percent={raisedPercent}
          status={raisedPercent >= 100 ? "success" : "active"}
          format={() => `${data.offering.raisedAmount} / ${data.offering.targetAmount} USD`}
        />
      </Card>

      {/* 发行方信息 */}
      <Card
        title={
          <Space>
            <BankOutlined />
            发行方信息
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="发行主体">{data.issuer.name}</Descriptions.Item>
          <Descriptions.Item label="注册编号">{data.issuer.registrationNumber}</Descriptions.Item>
          <Descriptions.Item label="注册地">{data.issuer.jurisdiction}</Descriptions.Item>
          <Descriptions.Item label="官网">
            <Button type="link" icon={<LinkOutlined />} size="small">
              {data.issuer.website}
            </Button>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 资金用途 */}
      <Card
        title="资金用途"
        style={{ marginBottom: 16 }}
      >
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          {data.useOfFunds.map((item, i) => (
            <li key={i} style={{ marginBottom: 4 }}>
              <Text>{item}</Text>
            </li>
          ))}
        </ul>
      </Card>

      {/* 链上记录 */}
      <Card
        title={
          <Space>
            <LinkOutlined />
            链上记录（不可篡改）
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        {data.onChainRecords.map((record, i) => (
          <div key={i} style={{ marginBottom: 8, padding: "8px 12px", background: "#fafafa", borderRadius: 6 }}>
            <Space direction="vertical" size={0}>
              <Text strong>{record.description}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {record.timestamp}
              </Text>
              <Text copyable style={{ fontFamily: "monospace", fontSize: 12 }}>
                {record.txHash}
              </Text>
            </Space>
          </div>
        ))}
      </Card>

      {/* 风险提示 */}
      <Card
        title={
          <Space>
            <WarningOutlined style={{ color: "#faad14" }} />
            风险提示
          </Space>
        }
        style={{ marginBottom: 16, border: "1px solid #faad14" }}
      >
        <Collapse
          items={[
            {
              key: "risks",
              label: `风险因素（共 ${data.risks.length} 项，请仔细阅读）`,
              children: (
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {data.risks.map((risk, i) => (
                    <li key={i} style={{ marginBottom: 8 }}>
                      <Text>{risk}</Text>
                    </li>
                  ))}
                </ul>
              ),
            },
          ]}
        />

        <div style={{ marginTop: 16, padding: "12px 16px", background: "#fffbe6", borderRadius: 6 }}>
          <Checkbox
            checked={riskAcknowledged}
            onChange={(e) => setRiskAcknowledged(e.target.checked)}
          >
            <Text strong>
              本人已仔细阅读并充分理解以上全部风险提示，确认本人符合「专业投资者」资格，自愿承担投资风险。
            </Text>
          </Checkbox>
        </div>
      </Card>

      {/* 认购入口 */}
      {kycVerified && riskAcknowledged && (
        <Card style={{ textAlign: "center", marginBottom: 16 }}>
          <Space direction="vertical" size="middle">
            <CheckCircleOutlined style={{ fontSize: 48, color: "#52c41a" }} />
            <Title level={4} style={{ margin: 0 }}>
              您已满足认购条件
            </Title>
            <Text type="secondary">
              作为合格投资者，您可以参与本次私募认购
            </Text>
            <Button
              type="primary"
              size="large"
              onClick={() => {
                message.info("认购功能将在链上合约部署后开放");
              }}
            >
              立即认购
            </Button>
          </Space>
        </Card>
      )}

      {!kycVerified && (
        <Alert
          type="warning"
          showIcon
          message="需要KYC认证"
          description="您需要先完成KYC身份认证，才能查看认购入口。请前往「KYC认证」页面提交资料。"
          style={{ marginBottom: 16 }}
        />
      )}
    </div>
  );
}
