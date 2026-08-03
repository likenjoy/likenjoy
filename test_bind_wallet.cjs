const { ethers } = require("C:/Users/Administrator/Desktop/rwa-exchange/contracts/erc3643/node_modules/ethers");

const BASE = "http://localhost:8080/api";
async function req(method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = "Bearer " + token;
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}
(async () => {
  // 1. login
  const login = await req("POST", "/auth/login", { email: "e2e@test.com", password: "Test123456" });
  const token = login.data.token;
  console.log("login:", login.status, "wallet_address=" + JSON.stringify(login.data.user.wallet_address));

  // 2. 客户钱包 = Hardhat 账户 #1
  const wallet = new ethers.Wallet("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
  console.log("wallet:", wallet.address);

  // 3. 签名绑定消息（与前端 buildBindMessage 相同格式）
  const message = `RealVest wallet binding\nAddress: ${wallet.address}\nNonce: ${Date.now()}`;
  const signature = await wallet.signMessage(message);
  console.log("signature:", signature.slice(0, 20) + "...");

  // 4. bind
  const bind = await req("POST", "/auth/bind-wallet", { wallet_address: wallet.address, signature, message }, token);
  console.log("bind:", bind.status, JSON.stringify(bind.data));

  // 5. 错误签名测试（篡改地址应被拒绝）
  const wrong = await req("POST", "/auth/bind-wallet", { wallet_address: "0x1111111111111111111111111111111111111111", signature, message }, token);
  console.log("bind wrong-addr (expect 403):", wrong.status, JSON.stringify(wrong.data));

  // 6. 未登录测试（expect 401）
  const noauth = await req("POST", "/auth/bind-wallet", { wallet_address: wallet.address, signature, message });
  console.log("bind no-auth (expect 401):", noauth.status);

  // 7. 重新登录确认持久化
  const login2 = await req("POST", "/auth/login", { email: "e2e@test.com", password: "Test123456" });
  console.log("relogin wallet_address:", login2.data.user.wallet_address, "match:", login2.data.user.wallet_address.toLowerCase() === wallet.address.toLowerCase());
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
