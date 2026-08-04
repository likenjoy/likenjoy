// EIP-2771 元交易端到端测试：投资者签名 → 平台 relayer 代付 gas → 链上执行
// 覆盖：正常链路 / 错误签名 / 钱包不匹配 / 目标不在白名单 / 过期
const { ethers } = require(require("path").join(__dirname, "..", "contracts", "erc3643", "node_modules", "ethers"));
const fs = require("fs");
const path = require("path");

const BASE = "http://localhost:8080/api";
const contracts = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "backend", "contracts.json"), "utf8"));
const provider = new ethers.JsonRpcProvider("http://localhost:8545");
const FORWARDER_NAME = "RWAExchangeForwarder";

// Hardhat 测试账户私钥
const PK_SENDER = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"; // #2
const PK_RECEIVER = "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6"; // #3
const PK_PLATFORM = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // #0 后端签名者

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok: !!ok });
  console.log(`  ${ok ? "PASS" : "FAIL"} ${name}${extra ? " | " + extra : ""}`);
}
async function req(method, p, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = "Bearer " + token;
  const res = await fetch(BASE + p, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

function typedData(chainId, forwarderAddr, req) {
  return {
    domain: { name: FORWARDER_NAME, version: "1", chainId, verifyingContract: forwarderAddr },
    types: {
      ForwardRequest: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "gas", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint48" },
        { name: "data", type: "bytes" },
      ],
    },
    primaryType: "ForwardRequest",
    message: req,
  };
}

(async () => {
  console.log("=== EIP-2771 元交易（gas 代付）端到端测试 ===\n");
  const chainId = (await provider.getNetwork()).chainId;
  const sender = new ethers.Wallet(PK_SENDER, provider);
  const receiver = new ethers.Wallet(PK_RECEIVER, provider);
  const platform = new ethers.Wallet(PK_PLATFORM, provider);
  const forwarderAddr = contracts.forwarder;
  const tokenAddr = contracts.rwaToken;

  // 1. 链上准备：sender/receiver 注册身份 + 白名单 + mint 100 给 sender
  console.log("[1] 链上准备（身份注册 + 白名单 + mint）");
  const iface = new ethers.Interface([
    "function registerIdentity(address,bytes32,uint16)",
    "function addToWhitelist(address,uint256,uint256)",
    "function mint(address,uint256,bytes32)",
    "function balanceOf(address) view returns (uint256)",
    "function transfer(address,uint256)",
    "function isWhitelisted(address) view returns (bool)",
  ]);
  const ir = new ethers.Contract(contracts.identityRegistry, iface, platform);
  const cm = new ethers.Contract(contracts.complianceModule, iface, platform);
  const token = new ethers.Contract(tokenAddr, iface, platform);
  const assetId = contracts.assetId;

  const hash2 = ethers.keccak256(ethers.toUtf8Bytes("relay-sender-kyc"));
  const hash3 = ethers.keccak256(ethers.toUtf8Bytes("relay-receiver-kyc"));
  // 显式 nonce 管理（ethers Wallet 自动 nonce 在 revert 交易下会与链上偏移）
  let pnonce = await provider.getTransactionCount(platform.address, "pending");
  const send = async (contract, method, args) => {
    const tx = await contract[method](...args, { nonce: pnonce++ });
    await tx.wait();
    return tx;
  };
  const isVerified = await new ethers.Contract(contracts.identityRegistry, ["function isVerified(address) view returns (bool)"], provider).isVerified(sender.address);
  if (!isVerified) { await send(ir, "registerIdentity", [sender.address, hash2, 344]); }
  if (!(await new ethers.Contract(contracts.identityRegistry, ["function isVerified(address) view returns (bool)"], provider).isVerified(receiver.address))) {
    await send(ir, "registerIdentity", [receiver.address, hash3, 344]);
  }
  if (!(await cm.isWhitelisted(sender.address))) { await send(cm, "addToWhitelist", [sender.address, 0, 0]); }
  if (!(await cm.isWhitelisted(receiver.address))) { await send(cm, "addToWhitelist", [receiver.address, 0, 0]); }
  if ((await token.balanceOf(sender.address)) < 100n) {
    await send(token, "mint", [sender.address, ethers.parseEther("100"), assetId]);
  }
  check("链上身份/白名单/mint 就绪", true);

  // 2. 注册 + 登录 + 绑定钱包
  console.log("[2] 用户体系 + 钱包绑定");
  const uniq = Date.now().toString(36);
  const email = "relay_" + uniq + "@test.com";
  await req("POST", "/auth/register", { email, password: "Test123456", role: "investor" });
  const login = await req("POST", "/auth/login", { email, password: "Test123456" });
  const tokenJwt = login.data.token;
  check("注册+登录", login.status === 200 && !!tokenJwt);

  const bindMsg = `RealVest wallet binding\nAddress: ${sender.address}\nNonce: ${Date.now()}`;
  const bindSig = await sender.signMessage(bindMsg);
  const bind = await req("POST", "/auth/bind-wallet", { wallet_address: sender.address, signature: bindSig, message: bindMsg }, tokenJwt);
  check("钱包绑定", bind.status === 200 && bind.data.wallet_address === sender.address);

  // 3. 正常链路：免 gas 转账 5 个代币
  console.log("[3] 正常链路（sign → relay → on-chain）");
  const calldata = iface.encodeFunctionData("transfer", [receiver.address, ethers.parseEther("5")]);
  const fwd = new ethers.Contract(forwarderAddr, [
    "function nonces(address) view returns (uint256)",
  ], provider);
  const nonce = await fwd.nonces(sender.address);
  const reqData = {
    from: sender.address, to: tokenAddr, value: "0", gas: 300000,
    nonce: Number(nonce), deadline: Math.floor(Date.now() / 1000) + 600, data: calldata,
  };
  const sig = await sender.signTypedData(typedData(chainId, forwarderAddr, reqData).domain, typedData(chainId, forwarderAddr, reqData).types, reqData);

  const balBefore = await token.balanceOf(receiver.address);
  const r3 = await req("POST", "/relay/execute", { ...reqData, signature: sig }, tokenJwt);
  check("relay 接口 200", r3.status === 200 && !!r3.data.tx_hash, "resp=" + JSON.stringify(r3.data).slice(0, 150));

  await new Promise(r => setTimeout(r, 1500));
  const balAfter = await token.balanceOf(receiver.address);
  check("接收方余额 +5（链上确认）", balAfter === balBefore + ethers.parseEther("5"), `+${ethers.formatEther(balAfter - balBefore)}`);

  const newNonce = await fwd.nonces(sender.address);
  check("nonce 递增（防重放生效）", newNonce === nonce + 1n);

  // 4. gas 账本记录
  console.log("[4] gas 账本（审计留痕）");
  const adminEmail = "adm_relay_" + uniq + "@test.com";
  await req("POST", "/auth/register", { email: adminEmail, password: "Admin123456", role: "admin" });
  const al = await req("POST", "/auth/login", { email: adminEmail, password: "Admin123456" });
  const gasList = await req("GET", "/admin/gas", null, al.data.token);
  const found = (gasList.data.data || []).some(x => x.action === "meta_tx_relay" && x.tx_hash === r3.data.tx_hash);
  check("gas 账本记录 meta_tx_relay", found);

  // 5. 攻击面：错误签名 / 钱包不匹配 / 目标白名单外 / 过期
  console.log("[5] 攻击面拦截");
  const badSig = await receiver.signTypedData(typedData(chainId, forwarderAddr, reqData).domain, typedData(chainId, forwarderAddr, reqData).types, reqData);
  const r5a = await req("POST", "/relay/execute", { ...reqData, nonce: Number(newNonce), signature: badSig }, tokenJwt);
  check("错误签名被拒", r5a.status === 400 && String(r5a.data.error || "").includes("signature"), r5a.data.error || "");

  const reqData2 = { ...reqData, from: receiver.address, nonce: Number(await fwd.nonces(receiver.address)) };
  const sig2 = await receiver.signTypedData(typedData(chainId, forwarderAddr, reqData2).domain, typedData(chainId, forwarderAddr, reqData2).types, reqData2);
  const r5b = await req("POST", "/relay/execute", { ...reqData2, signature: sig2 }, tokenJwt);
  check("from≠绑定钱包被拒", r5b.status === 400, r5b.data.error || "");

  const evilTarget = ethers.Wallet.createRandom().address;
  const reqData3 = { ...reqData, to: evilTarget, nonce: Number(await fwd.nonces(sender.address)) };
  const sig3 = await sender.signTypedData(typedData(chainId, forwarderAddr, reqData3).domain, typedData(chainId, forwarderAddr, reqData3).types, reqData3);
  const r5c = await req("POST", "/relay/execute", { ...reqData3, signature: sig3 }, tokenJwt);
  check("目标不在白名单被拒", r5c.status === 400 && String(r5c.data.error || "").includes("target"), r5c.data.error || "");

  const reqData4 = { ...reqData, nonce: Number(await fwd.nonces(sender.address)), deadline: Math.floor(Date.now() / 1000) - 60 };
  const sig4 = await sender.signTypedData(typedData(chainId, forwarderAddr, reqData4).domain, typedData(chainId, forwarderAddr, reqData4).types, reqData4);
  const r5d = await req("POST", "/relay/execute", { ...reqData4, signature: sig4 }, tokenJwt);
  check("过期请求被拒", r5d.status === 400 && String(r5d.data.error || "").includes("expired"), r5d.data.error || "");

  const reqData5 = { ...reqData, value: "1000000000000000000", nonce: Number(await fwd.nonces(sender.address)) };
  const sig5 = await sender.signTypedData(typedData(chainId, forwarderAddr, reqData5).domain, typedData(chainId, forwarderAddr, reqData5).types, reqData5);
  const r5e = await req("POST", "/relay/execute", { ...reqData5, signature: sig5 }, tokenJwt);
  check("value≠0 被拒（防资产转移滥用）", r5e.status === 400, r5e.data.error || "");

  console.log("\n=== 验证结果 ===");
  const failed = results.filter(r => !r.ok);
  console.log(`总计 ${results.length} 项：${results.length - failed.length} 通过，${failed.length} 失败`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error("FATAL:", e.message); process.exit(2); });
