const fs = require("fs");
const sp = "C:/Users/Administrator/Desktop/rwa-exchange/backend/internal/trade/service.go";
let sc = fs.readFileSync(sp, "utf8");

// 1. 错误定义（检查定义行而非引用）
if (!sc.includes("ErrEpochNotFound = errors.New")) {
  sc = sc.replace("ErrOrderNotFound     = errors.New(\"order not found\")",
    "ErrEpochNotFound = errors.New(\"epoch not found\")\n\tErrEpochClosed   = errors.New(\"epoch already closed\")\n\tErrOrderNotFound     = errors.New(\"order not found\")");
  console.log("epoch errors DEFINED");
} else { console.log("epoch errors already defined"); }

// 2. sort 函数（检查函数定义而非调用）
if (!sc.includes("func sortOrdersByPriceDesc")) {
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
  console.log("sort fn DEFINED");
} else { console.log("sort fn already defined"); }

fs.writeFileSync(sp, sc, "utf8");
console.log("done");