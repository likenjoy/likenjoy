"use client";

import { usePathname, useRouter } from "next/navigation";
import { Layout, Menu } from "antd";
import {
  DashboardOutlined,
  GoldOutlined,
  SwapOutlined,
  WalletOutlined,
  DollarOutlined,
  RollbackOutlined,
  SafetyCertificateOutlined,
  FileTextOutlined,
  SettingOutlined,
  TeamOutlined,
  LogoutOutlined,
  FundOutlined,
} from "@ant-design/icons";
import { useAppTheme } from "@/components/ThemeProvider";

const { Sider } = Layout;

// 分组导航（参考 ant-design-pro 后台范式：按业务域分组）
const menuItems = [
  {
    type: "group" as const,
    label: "投资中心",
    children: [
      { key: "/dashboard", icon: <DashboardOutlined />, label: "仪表盘" },
      { key: "/assets", icon: <GoldOutlined />, label: "资产" },
      { key: "/trade", icon: <SwapOutlined />, label: "交易" },
    ],
  },
  {
    type: "group" as const,
    label: "我的资产",
    children: [
      { key: "/portfolio", icon: <WalletOutlined />, label: "持仓与转账" },
      { key: "/dividend", icon: <DollarOutlined />, label: "分红" },
      { key: "/redeem", icon: <RollbackOutlined />, label: "赎回" },
    ],
  },
  {
    type: "group" as const,
    label: "账户与合规",
    children: [
      { key: "/kyc", icon: <SafetyCertificateOutlined />, label: "KYC 认证" },
      { key: "/disclosure", icon: <FileTextOutlined />, label: "合规披露" },
    ],
  },
  {
    type: "group" as const,
    label: "管理后台",
    children: [
      { key: "/admin/fees", icon: <SettingOutlined />, label: "费率与收入" },
      { key: "/admin/investors", icon: <TeamOutlined />, label: "投资者管理" },
    ],
  },
];
export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme } = useAppTheme();
  const layoutColors = theme.layoutColors;
  const DARK_BG = layoutColors.sidebarBg;

  // 选中态：/assets/xxx 也高亮 /assets
  const selectedKey = menuItems
    .flatMap((g) => (g as { children: { key: string }[] }).children)
    .map((i) => i.key)
    .filter((k) => pathname.startsWith(k))
    .sort((a, b) => b.length - a.length)[0] || pathname;

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/login");
  };

  return (
    <Sider width={232} style={{ background: layoutColors.sidebarBg, position: "sticky", top: 0, height: "100vh", overflow: "auto" }}>
      {/* Logo */}
      <div style={{ height: 64, display: "flex", alignItems: "center", padding: "0 20px", borderBottom: "1px solid rgba(255,255,255,.08)" }}>
        <FundOutlined style={{ color: "#FFC012", fontSize: 22, marginRight: 10 }} />
        <span style={{ fontSize: 17, fontWeight: 700, color: "#fff", letterSpacing: .5 }}>RealVest</span>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,.45)", marginLeft: 8, border: "1px solid rgba(255,255,255,.2)", borderRadius: 4, padding: "0 4px" }}>RWA</span>
      </div>

      <Menu
        mode="inline"
        theme={layoutColors.menuTheme}
        selectedKeys={[selectedKey]}
        items={menuItems}
        onClick={({ key }) => router.push(key)}
        style={{
          background: "transparent",
          borderRight: 0,
          marginTop: 8,
        }}
      />

      {/* 退出 */}
      <div style={{ position: "absolute", bottom: 12, width: "100%", padding: "0 12px" }}>
        <Menu
          mode="inline"
          theme={layoutColors.menuTheme}
          items={[{ key: "logout", icon: <LogoutOutlined />, label: "退出登录" }]}
          onClick={handleLogout}
          style={{ background: "transparent", borderRight: 0 }}
        />
      </div>
    </Sider>
  );
}
