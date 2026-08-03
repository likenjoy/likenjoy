import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { hardhat } from "wagmi/chains";

// WalletConnect 项目 ID：用于手机钱包扫码登录
// 注册（免费）：https://cloud.walletconnect.com → 创建项目 → 复制 Project ID 填入环境变量
const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID || "00000000000000000000000000000000";

export const wagmiConfig = getDefaultConfig({
  appName: "RealVest RWA Exchange",
  projectId,
  chains: [hardhat],
  ssr: true,
});

// 钱包绑定签名消息
export function buildBindMessage(address: string): string {
  return `RealVest wallet binding\nAddress: ${address}\nNonce: ${Date.now()}`;
}
