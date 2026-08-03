import { http, createConfig } from "wagmi";
import { hardhat } from "wagmi/chains";

// wagmi 配置：本地 Hardhat 开发链（上线时换 RPC + 主网/测试网链）
export const wagmiConfig = createConfig({
  chains: [hardhat],
  transports: {
    [hardhat.id]: http("http://localhost:8545"),
  },
  ssr: true,
});

// 钱包绑定签名消息
export function buildBindMessage(address: string): string {
  return `RealVest wallet binding\nAddress: ${address}\nNonce: ${Date.now()}`;
}
