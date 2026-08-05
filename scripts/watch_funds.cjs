// 到账监控：轮询钱包主网余额（提币到账检测）+ 测试网余额
// 用法：node scripts/watch_funds.cjs [轮询秒数=20] [次数=60]
const WALLET = "0xc71c96adcc0ef1da8ead8e5224bbbe23d25d2a05"; // 用户 MetaMask 主地址
const PLATFORM = "0x57A189d77883E43b1D505135d481178Ae9107d0b"; // 平台部署账户
const MAINNET_RPC = "https://ethereum-rpc.publicnode.com";
const ARB_RPC = "https://sepolia-rollup.arbitrum.io/rpc";

const INTERVAL = parseInt(process.argv[2] || "20", 10);
const MAX = parseInt(process.argv[3] || "60", 10);

async function balance(rpc, addr) {
  const r = await fetch(rpc, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", method: "eth_getBalance", params: [addr, "latest"], id: 1 }), signal: AbortSignal.timeout(10000) });
  const d = await r.json();
  return parseInt(d.result, 16) / 1e18;
}

(async () => {
  console.log("=== 资金到账监控 ===");
  console.log(`钱包(主网)   ${WALLET}`);
  console.log(`平台(测试网) ${PLATFORM}\n`);
  for (let i = 0; i < MAX; i++) {
    try {
      const main = await balance(MAINNET_RPC, WALLET);
      const arb = await balance(ARB_RPC, PLATFORM);
      const ts = new Date().toLocaleTimeString();
      console.log(`[${ts}] 主网: ${main.toFixed(6)} ETH | 测试网: ${arb.toFixed(6)} ETH`);
      if (main > 0.0005) {
        console.log("\n🎉 主网到账！钱包现在有主网余额，可以领水了！");
        process.exit(0);
      }
      if (arb > 0) {
        console.log("\n🎉 测试网已到账！平台账户有 gas，可以部署了！");
        process.exit(0);
      }
    } catch (e) {
      console.log(`[${new Date().toLocaleTimeString()}] 查询失败: ${e.message.slice(0, 40)}`);
    }
    await new Promise(r => setTimeout(r, INTERVAL * 1000));
  }
  console.log("\n监控结束（未到账，可加大次数重跑）");
  process.exit(1);
})();
