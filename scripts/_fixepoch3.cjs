const fs = require("fs");

// ===== model.go：Epoch 结构 + Order.EpochID =====
const mp = "C:/Users/Administrator/Desktop/rwa-exchange/backend/internal/trade/model.go";
let mc = fs.readFileSync(mp, "utf8");
if (!mc.includes("type Epoch struct")) {
  const add = `

// Epoch 结算周期（两阶段：订单收集 → 批量结算）
type Epoch struct {
	ID        string    \`json:"id"\`
	AssetID   uuid.UUID \`json:"asset_id"\`
	Status    string    \`json:"status"\` // open / closed
	CreatedBy string    \`json:"created_by"\`
	CreatedAt string    \`json:"created_at"\`
	ClosedAt  string    \`json:"closed_at"\`
}
`;
  mc = mc.trimEnd() + "\n" + add;
  fs.writeFileSync(mp, mc, "utf8");
  console.log("Epoch model added");
}

// Order 结构加 EpochID（在 CreatedAt 前插入）
if (!mc.includes("EpochID")) {
  mc = mc.replace("CreatedAt", "EpochID    string    \`json:\"epoch_id\"\`\n\tCreatedAt");
  fs.writeFileSync(mp, mc, "utf8");
  console.log("Order.EpochID added");
}

// ===== service.go：错误定义 + sortOrdersByPriceDesc =====
const sp = "C:/Users/Administrator/Desktop/rwa-exchange/backend/internal/trade/service.go";
let sc = fs.readFileSync(sp, "utf8");
if (!sc.includes("ErrEpochNotFound")) {
  sc = sc.replace("var ErrOrderNotFound", "var (\n\tErrEpochNotFound = errors.New(\"epoch not found\")\n\tErrEpochClosed   = errors.New(\"epoch already closed\")\n)\n\nvar ErrOrderNotFound");
  console.log("epoch errors added");
}
if (!sc.includes("sortOrdersByPriceDesc")) {
  const fn = `

// sortOrdersByPriceDesc 买单按价格降序（价格优先）
func sortOrdersByPriceDesc(orders []Order) []Order {
	out := make([]Order, len(orders))
	copy(out, orders)
	for i := 1; i < len(out); i++ {
		for j := i; j > 0; j-- {
			a := new(big.Float)
			a.SetString(out[j].Price)
			b := new(big.Float)
			b.SetString(out[j-1].Price)
			if a.Cmp(b) > 0 {
				out[j], out[j-1] = out[j-1], out[j]
			} else {
				break
			}
		}
	}
	return out
}
`;
  sc = sc.trimEnd() + "\n" + fn;
  fs.writeFileSync(sp, sc, "utf8");
  console.log("sort fn added");
}
console.log("done");