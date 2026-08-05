"use client";

import { useState, useEffect } from "react";
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

const menuItems: any[] = [
  {
    type: "group" as const,
    label: "投资中心",
    children: [
      { key: "/dashboard", icon: <DashboardOutlined />, label: "仪表盘" },
      { key: "/assets", icon: <GoldOutlined />, label: "资产" },
      { key: "/trade", icon: <SwapOutlined />, label: "交易", tier: "pro" },
    ],
  },
  {
    type: "group" as const,
    label: "我的资产",
    children: [
      { key: "/portfolio", icon: <WalletOutlined />, label: "持仓与转账" },
      { key: "/dividend", icon: <DollarOutlined />, label: "分红", tier: "pro" },
      { key: "/redeem", icon: <RollbackOutlined />, label: "赎回", tier: "pro" },
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
    label: "管理后台", tier: "pro",
    children: [
      { key: "/admin/fees", icon: <SettingOutlined />, label: "费率与收入" },
      { key: "/admin/system", icon: <SettingOutlined />, label: "系统设置" },
      { key: "/admin/ads", icon: <FundOutlined />, label: "广告管理" },
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
  const [licenseTier, setLicenseTier] = useState<string>("pro");
  useEffect(() => {
    fetch("/api/license").then(r => r.json()).then(d => setLicenseTier(d.tier || "pro")).catch(() => {});
  }, []);

  // 选中态：/assets/xxx 也高亮 /assets
  
  const visibleItems: any[] = menuItems
    .map((g) => {
      const group = g as { label: string; tier?: string; children?: { key: string; tier?: string }[] };
      if (group.children) {
        const kids = group.children.filter((i) => !i.tier || i.tier === "enterprise" || licenseTier === "pro" || licenseTier === "enterprise" || i.tier === licenseTier);
        return { ...group, children: kids };
      }
      return group;
    })
    .filter((g) => !(g as { tier?: string }).tier || (g as { tier?: string }).tier === "enterprise" || licenseTier === "pro" || licenseTier === "enterprise" || (g as { tier?: string }).tier === licenseTier);

const selectedKey = visibleItems
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
        items={visibleItems}
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
