"use client";

import { useRouter } from "next/navigation";
import { Button, Card, Col, Row, Space, Typography, Divider } from "antd";
import {
  SafetyCertificateOutlined, ThunderboltOutlined, EyeOutlined,
  FundOutlined, ArrowRightOutlined, WalletOutlined, HomeOutlined,
  BankOutlined, FileProtectOutlined, GlobalOutlined,
} from "@ant-design/icons";
import { useAppTheme } from "@/components/ThemeProvider";
import AdBanner from "@/components/AdBanner";

const { Title, Text, Paragraph } = Typography;

// 产品展示页（Landing），参考 Centrifuge / RealT 官网结构：
// Hero → 数据条 → 特性 → 资产类别 → 投资流程 → CTA → 页脚

const features = [
  { icon: <SafetyCertificateOutlined />, title: "合规代币化", desc: "ERC-3643 标准，KYC/AML 认证 + 链上白名单 + 锁定期，每一笔转账都过合规检查" },
  { icon: <ThunderboltOutlined />, title: "免 Gas 体验", desc: "平台代付 Gas（EIP-2771 元交易），投资者无需持有 ETH 即可交易与转账" },
  { icon: <EyeOutlined />, title: "链上透明", desc: "资产净值、分红、赎回全程上链可查，审计留痕，杜绝暗箱操作" },
  { icon: <FileProtectOutlined />, title: "专业投资者服务", desc: "面向家族办公室与高净值个人，专业投资者认证，私募合规发行" },
];

const assetClasses = [
  { icon: <HomeOutlined />, name: "不动产", desc: "商业地产、公寓、REITs 份额代币化" },
  { icon: <BankOutlined />, name: "债权与基金", desc: "私募基金份额、结构化债权、票据" },
  { icon: <GlobalOutlined />, name: "大宗商品", desc: "贵金属、能源、碳资产" },
  { icon: <FundOutlined />, name: "另类资产", desc: "艺术、版权、无形资产收益权" },
];

const steps = [
  { n: "01", title: "认证", desc: "注册并完成 KYC / 专业投资者认证" },
  { n: "02", title: "投资", desc: "连接钱包，免 Gas 认购合规代币化资产" },
  { n: "03", title: "收益", desc: "链上分红、净值增长、到期赎回，全程透明" },
];

export default function LandingPage() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const dark = theme.id === "dark";
  const C = theme.themeConfig.token!;
  const primary = C.colorPrimary as string;

  const bg = dark ? "#0F1115" : "#FFFFFF";
  const fg = dark ? "#E6E8EB" : "#141414";
  const muted = dark ? "#8A90A0" : "#667085";
  const cardBg = dark ? "#16181D" : "#FFFFFF";
  const border = dark ? "#262A33" : "#E8ECEC";

  return (
    <div style={{ background: bg, color: fg, minHeight: "100vh" }}>
      {/* ===== 顶部导航 ===== */}
      <div style={{
        position: "sticky", top: 0, zIndex: 100, height: 68,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 48px", background: bg, borderBottom: `1px solid ${border}`,
      }}>
        <Space size={10}>
          <FundOutlined style={{ color: primary, fontSize: 24 }} />
          <Text strong style={{ fontSize: 18, color: fg }}>RealVest</Text>
          <Text style={{ fontSize: 11, color: muted, border: `1px solid ${border}`, borderRadius: 4, padding: "0 6px" }}>RWA</Text>
        </Space>
        <Space size={8}>
          <Button type="text" onClick={() => router.push("/dashboard")} style={{ color: muted }}>产品</Button>
          <Button type="text" onClick={() => router.push("/assets")} style={{ color: muted }}>资产</Button>
          <Button type="text" onClick={() => router.push("/disclosure")} style={{ color: muted }}>合规</Button>
          <Button type="primary" onClick={() => router.push("/login")}>进入平台</Button>
        </Space>
      </div>

      {/* ===== 广告横幅（管理后台配置）===== */}
      <AdBanner />

      {/* ===== Hero ===== */}
      <div style={{ textAlign: "center", padding: "96px 24px 64px" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "4px 14px", borderRadius: 999, border: `1px solid ${border}`,
          background: dark ? "#1A1D24" : "#F4F7F7", color: muted, fontSize: 13, marginBottom: 24,
        }}>
          <SafetyCertificateOutlined style={{ color: primary }} />
          合规真实世界资产（RWA）代币化交易平台
        </div>
        <Title style={{ fontSize: 52, fontWeight: 700, lineHeight: 1.15, margin: 0, color: fg, letterSpacing: -1 }}>
          把真实资产，<br />
          变成<span style={{ color: primary }}>可交易的数字证券</span>
        </Title>
        <Paragraph style={{ fontSize: 18, color: muted, maxWidth: 640, margin: "24px auto 0" }}>
          不动产、基金份额、大宗商品——通过 ERC-3643 合规标准代币化，
          面向专业投资者提供链上发行、交易、分红与赎回的一站式服务。
        </Paragraph>
        <Space size={12} style={{ marginTop: 36 }}>
          <Button type="primary" size="large" icon={<ArrowRightOutlined />} onClick={() => router.push("/login")}>
            开始投资
          </Button>
          <Button size="large" onClick={() => router.push("/assets")}>浏览资产</Button>
        </Space>
      </div>

      {/* ===== 数据条 ===== */}
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 24px 64px" }}>
        <Row gutter={24}>
          {[["资产类别", "4+"], ["合规校验", "100%"], ["Gas 成本", "0"], ["链上透明", "全程"]].map(([k, v]) => (
            <Col span={6} key={k}>
              <Card style={{ background: cardBg, borderColor: border, textAlign: "center" }} styles={{ body: { padding: "28px 16px" } }}>
                <Title level={2} style={{ margin: 0, color: primary, fontSize: 36 }}>{v}</Title>
                <Text style={{ color: muted }}>{k}</Text>
              </Card>
            </Col>
          ))}
        </Row>
      </div>

      {/* ===== 特性 ===== */}
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 24px 72px" }}>
        <Title level={2} style={{ textAlign: "center", color: fg }}>为什么选择 RealVest</Title>
        <Row gutter={[24, 24]} style={{ marginTop: 16 }}>
          {features.map((f) => (
            <Col xs={24} md={12} key={f.title}>
              <Card hoverable style={{ background: cardBg, borderColor: border, height: "100%" }} styles={{ body: { padding: 28 } }}>
                <Space align="start" size={14}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: dark ? "rgba(26,171,155,.15)" : "rgba(26,171,155,.1)",
                    color: primary, fontSize: 20,
                  }}>{f.icon}</div>
                  <div>
                    <Text strong style={{ fontSize: 16, color: fg }}>{f.title}</Text>
                    <Paragraph style={{ color: muted, margin: "6px 0 0", fontSize: 14 }}>{f.desc}</Paragraph>
                  </div>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      </div>

      {/* ===== 资产类别 ===== */}
      <div style={{ background: dark ? "#131722" : "#F7F9F9", padding: "72px 24px" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <Title level={2} style={{ textAlign: "center", color: fg }}>可代币化的资产</Title>
          <Row gutter={[24, 24]} style={{ marginTop: 16 }}>
            {assetClasses.map((a) => (
              <Col xs={24} sm={12} lg={6} key={a.name}>
                <Card hoverable style={{ background: cardBg, borderColor: border, textAlign: "center" }} styles={{ body: { padding: 32 } }}>
                  <div style={{ fontSize: 32, color: primary, marginBottom: 12 }}>{a.icon}</div>
                  <Text strong style={{ fontSize: 16, color: fg, display: "block" }}>{a.name}</Text>
                  <Text style={{ color: muted, fontSize: 13 }}>{a.desc}</Text>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      </div>

      {/* ===== 流程 ===== */}
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "72px 24px" }}>
        <Title level={2} style={{ textAlign: "center", color: fg }}>三步完成投资</Title>
        <Row gutter={[24, 24]} style={{ marginTop: 16 }}>
          {steps.map((s) => (
            <Col xs={24} md={8} key={s.n}>
              <div style={{ textAlign: "center", padding: "8px 16px" }}>
                <div style={{ fontSize: 44, fontWeight: 800, color: primary, opacity: .35 }}>{s.n}</div>
                <Text strong style={{ fontSize: 17, color: fg, display: "block", margin: "8px 0 6px" }}>{s.title}</Text>
                <Text style={{ color: muted }}>{s.desc}</Text>
              </div>
            </Col>
          ))}
        </Row>
      </div>

      {/* ===== CTA ===== */}
      <div style={{ padding: "16px 24px 80px" }}>
        <div style={{
          maxWidth: 1080, margin: "0 auto", padding: "56px 32px", textAlign: "center", borderRadius: 16,
          background: dark ? "linear-gradient(135deg,#1AAB9B22,#1AAB9B44)" : "linear-gradient(135deg,#F0FBF9,#E6F7F4)",
          border: `1px solid ${dark ? "rgba(26,171,155,.3)" : "#D3EFEA"}`,
        }}>
          <Title level={2} style={{ color: fg, margin: 0 }}>准备好配置你的 RWA 组合了吗？</Title>
          <Paragraph style={{ color: muted, marginTop: 12, fontSize: 16 }}>
            完成专业投资者认证，即刻开启合规数字证券投资
          </Paragraph>
          <Button type="primary" size="large" icon={<WalletOutlined />} onClick={() => router.push("/login")} style={{ marginTop: 16 }}>
            立即进入平台
          </Button>
        </div>
      </div>

      {/* ===== 页脚 ===== */}
      <div style={{ borderTop: `1px solid ${border}`, padding: "32px 48px" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <Space size={10}>
            <FundOutlined style={{ color: primary, fontSize: 20 }} />
            <Text strong style={{ color: fg }}>RealVest</Text>
            <Text style={{ color: muted, fontSize: 12 }}>合规真实世界资产代币化交易平台</Text>
          </Space>
          <Text style={{ color: muted, fontSize: 12 }}>
            ERC-3643 · EIP-2771 · 基于以太坊生态
          </Text>
        </div>
        <Divider style={{ borderColor: border, margin: "20px 0 12px" }} />
        <Text style={{ color: muted, fontSize: 12, display: "block", textAlign: "center" }}>
          免责声明：本平台内容不构成投资建议或法律意见。投资有风险，入市需谨慎。
        </Text>
      </div>
    </div>
  );
}
