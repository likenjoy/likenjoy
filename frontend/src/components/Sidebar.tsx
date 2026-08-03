"use client";

import { usePathname, useRouter } from "next/navigation";
import { Layout, Menu } from "antd";
import WalletButton from "@/components/WalletButton";
import {
  WalletOutlined,
  DashboardOutlined,
  GoldOutlined,
  SwapOutlined,
  DollarOutlined,
  RollbackOutlined,
  SafetyCertificateOutlined,
  FileTextOutlined,
  LogoutOutlined,
} from "@ant-design/icons";

const { Sider } = Layout;

const menuItems = [
  { key: "/dashboard", icon: <DashboardOutlined />, label: "仪表盘" },
  { key: "/portfolio", icon: <WalletOutlined />, label: "我的持仓" },
  { key: "/assets", icon: <GoldOutlined />, label: "资产发行" },
  { key: "/disclosure", icon: <FileTextOutlined />, label: "募集公告" },
  { key: "/trade", icon: <SwapOutlined />, label: "私募交易" },
  { key: "/dividend", icon: <DollarOutlined />, label: "分红信息" },
  { key: "/redeem", icon: <RollbackOutlined />, label: "实物赎回" },
  { key: "/kyc", icon: <SafetyCertificateOutlined />, label: "KYC 认证" },
  { key: "/admin/fees", icon: <DollarOutlined />, label: "收入管理" },
  { key: "/admin/investors", icon: <SafetyCertificateOutlined />, label: "投资者管理" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/login");
  };

  return (
    <Sider width={220} style={{ background: "#fff", borderRight: "1px solid #f0f0f0" }}>
      <div style={{ height: 64, display: "flex", alignItems: "center", justifyContent: "center", borderBottom: "1px solid #f0f0f0" }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: "#1677ff" }}>RealVest</span>
      </div>
      <div style={{ padding: "12px 16px 4px" }}>
        <WalletButton />
      </div>
      <Menu
        mode="inline"
        selectedKeys={[pathname]}
        items={menuItems}
        onClick={({ key }) => router.push(key)}
        style={{ borderRight: 0, marginTop: 8 }}
      />
      <div style={{ position: "absolute", bottom: 16, width: "100%", padding: "0 16px" }}>
        <Menu
          mode="inline"
          items={[{ key: "logout", icon: <LogoutOutlined />, label: "退出登录" }]}
          onClick={handleLogout}
          style={{ borderRight: 0 }}
        />
      </div>
    </Sider>
  );
}
