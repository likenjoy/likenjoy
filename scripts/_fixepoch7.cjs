const fs = require("fs");
const mp = "C:/Users/Administrator/Desktop/rwa-exchange/backend/cmd/api/main.go";
let mc = fs.readFileSync(mp, "utf8");
if (!mc.includes("/epochs")) {
  const needle = '		protected.POST("/trades/orders", tradeHandler.PlaceOrder)';
  const add = '		protected.POST("/trades/orders", tradeHandler.PlaceOrder)\n		protected.POST("/trades/epochs", tradeHandler.CreateEpochHandler)\n		protected.POST("/trades/epochs/:id/close", tradeHandler.CloseEpochHandler)\n		protected.GET("/trades/epochs", tradeHandler.ListEpochsHandler)';
  if (mc.includes(needle)) {
    mc = mc.replace(needle, add);
    fs.writeFileSync(mp, mc, "utf8");
    console.log("epoch routes added");
  } else { console.log("NEEDLE NOT FOUND"); }
}
console.log("done");