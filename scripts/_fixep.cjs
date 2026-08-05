const fs = require("fs");
const path = "C:/Users/Administrator/Desktop/rwa-exchange/frontend/src/app/trade/page.tsx";
let c = fs.readFileSync(path, "utf8");

// 1. import
c = c.replace('import { api } from "@/lib/api";', 'import { api } from "@/lib/api";\nimport EpochPanel from "@/components/EpochPanel";');

// 2. 在左侧下单卡片后插入 EpochPanel（找到右侧订单卡片注释前）
const needle = "        {/* 右侧：订单列表 */}";
const add = `        {/* 结算周期（Epoch 两阶段结算） */}\n        <EpochPanel assetId={assetId} />\n\n        {/* 右侧：订单列表 */}`;
if (c.includes(needle)) {
  c = c.replace(needle, add);
  fs.writeFileSync(path, c, "utf8");
  console.log("EpochPanel integrated");
} else {
  console.log("NEEDLE NOT FOUND");
}