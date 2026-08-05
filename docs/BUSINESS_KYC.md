# 商业 KYC / KYB 接入方案（调研与落地指引）

> 背景：现有 KYC 为个人投资者自填资料 + 人工审核（`/api/kyc` 提交、admin 审核）。
> 目标：接入第三方身份验证服务，实现自动化实名核验（个人 KYC）+ 企业 KYB（法人/受益所有人），满足 SFC 牌照语境下的客户尽调要求。

## 一、选型对比（2026-08 调研结论）

| 服务商 | 个人 KYC 单价 | 特点 | 适用阶段 |
|--------|--------------|------|---------|
| **Shufti Pro** | ~$0.3-1/次 | 身份证+人脸+地址证明，中文支持好，API 简单，香港常用 | ⭐ MVP（成本低、快） |
| **Sumsub** | ~$1-2/次 | 全流程（KYC/KYB/持续监控/KYT），合规报告完善 | 牌照期 / 机构客户 |
| **Onfido** | ~$1.5/次 | 生物识别强，西欧主流 | 备选 |
| **Fractal/Transmit** | 按量 | 印度/东南亚强 | 备选 |

**结论**：MVP 用 Shufti Pro（成本最低、中文+香港证件支持）；拿到牌照或做机构客户后升级 Sumsub（自带 KYB + 持续监控 + 报告导出，SFC 审计友好）。

## 二、接入架构（与现有系统整合）

```
用户提交 KYC 资料（现有表单）
        ↓
POST /api/kyc/applications（增加 vendor_session 字段）
        ↓
前端跳转/嵌入 Shufti Pro 验证 SDK（身份证 OCR + 活体检测）
        ↓
Shufti Webhook → /api/kyc/webhook/shufti（新增，公网回调）
        ↓
验证通过 → 自动更新 KYC 状态 approved + 审计日志
        ↓
（既有流程）链上 registerIdentity + addToWhitelist
```

## 三、落地步骤（按序）

1. 🔑 注册 Shufti Pro 商户账号，获取 `client_id` + `secret_key`（沙箱环境）
2. ✍️ 后端新增 `internal/kyc/vendor.go`：Shufti API 客户端（创建验证会话 / 校验签名）
3. ✍️ 新增 `POST /api/kyc/applications` 时创建 vendor 会话，返回 `verification_url`
4. ✍️ 新增 `POST /api/kyc/webhook/shufti`（无鉴权但验签：HMAC-SHA256）
5. ✍️ webhook 校验通过后复用现有 `KYCService.Approve()`（链上身份注册复用）
6. ⚠️ 决策：是否强制商业 KYC（机构客户必须 KYB：法人证书+受益所有人≥25%）

## 四、费用测算（对应商业模型）

- 假设月增 50 个投资者 × $0.5 ≈ $25/月（KYC 成本）
- 对比：每单代币化发行费 2%（约 200 万港币），KYC 成本占比可忽略
- 建议：KYC 费用由平台承担（获客友好），计入运营成本

## 五、合规注意

- SFC 语境下客户身份验证需留存 7 年（现有 kyc_documents 表已存证）
- 制裁名单筛查：Shufti Pro 内置 AML 筛查；后续可加 OpenSanctions 开源库增强（本地化，避免跨境数据依赖）
- 持续监控（KYT）：Sumsub 提供；MVP 阶段以定期人工复核代替

## 六、未决事项

- [ ] 需要用户提供 Shufti Pro API Key 才能联调（沙箱即可）
- [ ] Webhook 需要公网回调地址（生产环境已有域名后可配）
- [ ] 商业 KYB 的受益所有人门槛（≥25%）需按香港法规确认