// GitHub MITM 转发代理：git → 本机 8443（TLS 终止，自签证书）→ undici(走CloudRocket) → github.com
// 解决：git(openssl) TLS 指纹被 CloudRocket 拦截，node(undici) 指纹被放行
// 用法：node scripts/gh_mitm_proxy.cjs [本地端口=8443] [上游代理=127.0.0.1:20805]
const https = require("https");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const LOCAL_PORT = parseInt(process.argv[2] || "8443", 10);
const UPSTREAM = process.argv[3] || "127.0.0.1:20805";
const TARGET = "https://github.com"; // 固定转发目标

// 生成自签证书（git 自带 openssl）
const CERT_DIR = path.join(__dirname, "..", ".gh-mitm");
fs.mkdirSync(CERT_DIR, { recursive: true });
const keyPath = path.join(CERT_DIR, "key.pem");
const certPath = path.join(CERT_DIR, "cert.pem");
if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
  execSync(`openssl req -x509 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -subj "/CN=github.com"`, { stdio: "ignore" });
  console.log("自签证书已生成:", CERT_DIR);
}

const server = https.createServer(
  { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) },
  async (req, res) => {
    try {
      // 转发到 github.com（undici 走 HTTP_PROXY 环境变量 → CloudRocket）
      const targetUrl = TARGET + req.url;
      const headers = { ...req.headers, host: "github.com" };
      delete headers["proxy-connection"];

      const upstream = await fetch(targetUrl, {
        method: req.method,
        headers,
        body: req.method === "GET" || req.method === "HEAD" ? undefined : req,
        duplex: "half",
        redirect: "manual",
      });

      res.writeHead(upstream.status, upstream.headers);
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.end(buf);
    } catch (e) {
      res.writeHead(502, { "Content-Type": "text/plain" });
      res.end("mitm error: " + e.message);
    }
  }
);

// 设置 undici 走上游代理
process.env.HTTP_PROXY = `http://${UPSTREAM}`;
process.env.HTTPS_PROXY = `http://${UPSTREAM}`;
process.env.ALL_PROXY = `http://${UPSTREAM}`;
// 忽略上游自签/拦截（不校验）
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

server.listen(LOCAL_PORT, "127.0.0.1", () => {
  console.log(`gh_mitm_proxy 运行中: https://127.0.0.1:${LOCAL_PORT} → ${TARGET} (via ${UPSTREAM})`);
});
