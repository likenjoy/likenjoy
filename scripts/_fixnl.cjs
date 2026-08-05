const fs = require("fs");
const path = "C:/Users/Administrator/Desktop/rwa-exchange/frontend/src/app/dashboard/page.tsx";
let c = fs.readFileSync(path, "utf8");
// 移除字面 \n 字符
c = c.replace(/\\n/g, "\n");
fs.writeFileSync(path, c, "utf8");
console.log("fixed literal \\n");