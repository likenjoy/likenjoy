// 本地 HTTP CONNECT 转发代理：git/curl → 本机 7899 → CloudRocket(20805) → github.com
// 解决 git(libcurl) 与 CloudRocket 代理直接握手不兼容的问题
// 用法：node scripts/proxy_bridge.cjs [本地端口=7899] [上游代理=127.0.0.1:20805]
const http = require("http");
const net = require("net");

const LOCAL_PORT = parseInt(process.argv[2] || "7899", 10);
const UPSTREAM = process.argv[3] || "127.0.0.1:20805";
const [UP_HOST, UP_PORT] = UPSTREAM.split(":");

const server = http.createServer((req, res) => {
  res.writeHead(405, { "Content-Type": "text/plain" });
  res.end("proxy_bridge: 仅支持 CONNECT 隧道");
});

// CONNECT 隧道：git 要求连 github.com:443 → 本代理转发到上游代理
server.on("connect", (req, clientSocket, head) => {
  // 连接上游代理（CloudRocket）并发 CONNECT 目标
  const upSocket = net.connect(parseInt(UP_PORT, 10), UP_HOST, () => {
    upSocket.write(`CONNECT ${req.url} HTTP/1.1\r\nHost: ${req.url}\r\n\r\n`);
  });

  let upBuf = Buffer.alloc(0);
  let tunneled = false;
  upSocket.on("data", (chunk) => {
    if (!tunneled) {
      upBuf = Buffer.concat([upBuf, chunk]);
      const idx = upBuf.indexOf("\r\n\r\n");
      if (idx === -1) return;
      const headStr = upBuf.slice(0, idx).toString();
      const status = parseInt(headStr.split(" ")[1] || "0", 10);
      if (status !== 200) {
        clientSocket.end();
        upSocket.end();
        return;
      }
      tunneled = true;
      const rest = upBuf.slice(idx + 4);
      clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (rest.length) upSocket.unshift(rest);
      clientSocket.pipe(upSocket);
      upSocket.pipe(clientSocket);
      return;
    }
    // 隧道建立后透传（pipe 已接管）
  });

  upSocket.on("error", () => clientSocket.destroy());
  clientSocket.on("error", () => upSocket.destroy());
  clientSocket.on("close", () => upSocket.destroy());
  upSocket.on("close", () => clientSocket.destroy());
});

server.listen(LOCAL_PORT, "127.0.0.1", () => {
  console.log(`proxy_bridge 运行中: 127.0.0.1:${LOCAL_PORT} → 上游 ${UPSTREAM}`);
});
