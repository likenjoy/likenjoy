const fs = require("fs");
const sp = "C:/Users/Administrator/Desktop/rwa-exchange/backend/internal/trade/service.go";
let sc = fs.readFileSync(sp, "utf8");

// 1. 错误定义（在 ErrOrderNotFound 行前插入 var 块）
if (!sc.includes("ErrEpochNotFound")) {
  sc = sc.replace("ErrOrderNotFound     = errors.New(\"order not found\")",
    "ErrEpochNotFound = errors.New(\"epoch not found\")\n\tErrEpochClosed   = errors.New(\"epoch already closed\")\n\tErrOrderNotFound     = errors.New(\"order not found\")");
  console.log("epoch errors added");
}

// 2. sortOrdersByPriceDesc（在文件末尾追加，含 big import 检查——用 math/big 别名）
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