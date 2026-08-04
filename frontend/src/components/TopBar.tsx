"use client";

import { usePathname, useRouter } from "next/navigation";
import { Button, Dropdown, Space, Typography, Avatar, Tag } from "antd";
import { UserOutlined, LogoutOutlined, WalletOutlined } from "@ant-design/icons";
import { useAccount, useDisconnect } from "wagmi";
import WalletButton from "@/components/WalletButton";
import { useAppTheme } from "@/components/ThemeProvider";
import { THEMES } from "@/lib/theme";
import { BgColorsOutlined } from "@ant-design/icons";

const { Text } = Typography;

// 页面标题映射（面包屑/顶栏）
const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "仪表盘",
  "/assets": "资产",
  "/trade": "交易",
  "/portfolio": "持仓与转账",
  "/dividend": "分红",
  "/redeem": "赎回",
  "/kyc": "KYC 认证",
  "/disclosure": "合规披露",
  "/admin/fees": "费率与收入",
  "/admin/investors": "投资者管理",
};

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { theme, setThemeId } = useAppTheme();
  const layoutColors = theme.layoutColors;

  const title = PAGE_TITLES[pathname] || "RealVest";
  const isAdmin = pathname.startsWith("/admin");

  const themeMenu = {
    items: THEMES.map((t) => ({
      key: t.id,
      label: t.name,
      icon: t.id === theme.id ? <span style={{ color: "#16A34A" }}>●</span> : null,
    })),
    onClick: ({ key }: { key: string }) => setThemeId(key),
  };

  const userMenu = {
    items: [
      { key: "logout", icon: <LogoutOutlined />, label: "退出登录" },
    ],
    onClick: ({ key }: { key: string }) => {
      if (key === "logout") {
        localStorage.removeItem("token");
        disconnect();
        router.push("/login");
      }
    },
  };

  return (
    <div style={{
      height: 64,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 24px",
      background: layoutColors.topbarBg,
      borderBottom: `1px solid ${layoutColors.border}`,
    }}>
      <Space size={12}>
        <Text strong style={{ fontSize: 16, color: layoutColors.textPrimary }}>{title}</Text>
        {isAdmin && <Tag color="gold" style={{ borderRadius: 4 }}>管理后台</Tag>}
      </Space>

      <Space size={12}>
        {isConnected && address && (
          <Tag icon={<WalletOutlined />} color="blue" style={{ borderRadius: 4, fontSize: 12 }}>
            {address.slice(0, 6)}...{address.slice(-4)}
          </Tag>
        )}
        <Dropdown menu={themeMenu} placement="bottomRight">
          <Button
            type="text"
            icon={<BgColorsOutlined />}
            style={{ color: layoutColors.textPrimary }}
            title="切换主题"
          >
            {theme.name}
          </Button>
        </Dropdown>
        <WalletButton />
        <Dropdown menu={userMenu} placement="bottomRight">
          <Avatar
            size={32}
            icon={<UserOutlined />}
            style={{ background: "#2762FF", cursor: "pointer" }}
          />
        </Dropdown>
      </Space>
    </div>
  );
}
