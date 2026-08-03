import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // 生产部署：独立 Node 服务
  // 前端/后端统一入口：/api/* 由 Next 服务端转发到 Go 后端（消除跨域，生产可换环境变量）
  async rewrites() {
    const backend = process.env.BACKEND_URL || "http://localhost:8080";
    return [{ source: "/api/:path*", destination: `${backend}/api/:path*` }];
  },
};

export default nextConfig;
