"use client";

import { usePathname } from "next/navigation";
import "@rainbow-me/rainbowkit/styles.css";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { Layout } from "antd";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import WalletProvider from "@/components/WalletProvider";
import ThemeProvider, { useAppTheme } from "@/components/ThemeProvider";
import "./globals.css";

const { Content } = Layout;

function AppShell({ children }: { children: React.ReactNode }) {
  const { theme } = useAppTheme();
  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sidebar />
      <Layout style={{ background: theme.layoutColors.contentBg }}>
        <TopBar />
        <Content style={{ padding: 24, background: theme.layoutColors.contentBg }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  return (
    <html lang="zh-CN" className="h-full">
      <body className="h-full">
        <WalletProvider>
          <AntdRegistry>
            <ThemeProvider>
              {isLogin ? children : <AppShell>{children}</AppShell>}
            </ThemeProvider>
          </AntdRegistry>
        </WalletProvider>
      </body>
    </html>
  );
}
