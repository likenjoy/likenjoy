const fs = require("fs");
const sp = "C:/Users/Administrator/Desktop/rwa-exchange/backend/internal/trade/service.go";
let sc = fs.readFileSync(sp, "utf8");
// CloseEpoch 里 DB 更新后同步内存状态
sc = sc.replace('	if err := s.repo.CloseEpoch(epochID); err != nil {\n		return nil, 0, err\n	}',
'	if err := s.repo.CloseEpoch(epochID); err != nil {\n		return nil, 0, err\n	}\n	e.Status = "closed" // 同步内存状态（DB 已更新）');
fs.writeFileSync(sp, sc, "utf8");
console.log("status sync added");