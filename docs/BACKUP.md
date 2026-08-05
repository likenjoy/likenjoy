# 数据库备份与恢复

## 手动备份

```bash
node --experimental-sqlite scripts/backup_db.cjs
# 备份到 backup/rwa_exchange_<时间戳>.db，默认保留最近 14 份
```

## 定时自动备份（Windows 计划任务）

1. 打开「任务计划程序」→ 创建基本任务
2. 触发器：每天 03:00
3. 操作：启动程序
   - 程序：`C:\Program Files\nodejs\node.exe`
   - 参数：`--experimental-sqlite C:\Users\Administrator\Desktop\rwa-exchange\scripts\backup_db.cjs`
   - 起始于：`C:\Users\Administrator\Desktop\rwa-exchange`

## 异地备份（生产建议）

- 备份目录 `backup/` 已 gitignore（不入库）
- 生产环境建议：备份后同步到**独立磁盘/对象存储**（如阿里云 OSS/腾讯云 COS，或另一台机器），防止服务器故障丢数据
- 示例（每月手动/任务）：`robocopy backup D:\offsite-backup /MIR`

## 恢复

```bash
# 1. 停止后端
# 2. 用备份覆盖数据库
Copy-Item backup\rwa_exchange_<时间戳>.db backend\rwa_exchange.db
# 3. 重启后端
```

## 验证备份完整性

```bash
node --experimental-sqlite -e "const{DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('backup/rwa_exchange_<时间戳>.db',{readOnly:true});console.log('表数:',db.prepare(\"SELECT count(*) c FROM sqlite_master WHERE type='table'\").get().c);db.close();"
```
