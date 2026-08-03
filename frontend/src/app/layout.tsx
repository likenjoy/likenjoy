"use client";

import { usePathname } from "next/navigation";
import "@rainbow-me/rainbowkit/styles.css";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ConfigProvider, Layout } from "antd";
import zhCN from "antd/locale/zh_CN";
import Sidebar from "@/components/Sidebar";
import WalletProvider from "@/components/WalletProvider";
import "./globals.css";

const { Content } = Layout;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  return (
    <html lang="zh-CN" className="h-full">
      <body className="h-full">
        <WalletProvider>
          <AntdRegistry>
            <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: "#1677ff" } }}>
            {isLogin ? (
              children
            ) : (
              <Layout style={{ minHeight: "100vh" }}>
                <Sidebar />
                <Layout>
                  <Content style={{ padding: 24, background: "#f5f5f5" }}>{children}</Content>
                </Layout>
              </Layout>
            )}
          </ConfigProvider>
          </AntdRegistry>
        </WalletProvider>
      </body>
    </html>
  );
}
