# 三级授权功能指南（Tier Guide）

> 授权模型：**Community（免费）/ Pro（商业）/ Enterprise（企业）**
> 技术实现：`LICENSE_TIER` 环境变量 + 后端中间件强制校验 + `/api/license` 接口

## 功能矩阵

| 功能 | Community | Pro | Enterprise |
|------|:---------:|:---:|:----------:|
| 资产浏览 / 价格曲线 | ✅ | ✅ | ✅ |
| 注册 / 登录 / 钱包连接 | ✅ | ✅ | ✅ |
| 交易（订单/Epoch 结算） | ❌ | ✅ | ✅ |
| 分红 / RDT 收益 | ❌ | ✅ | ✅ |
| 管理后台（KYC 审核/投资者） | ❌ | ✅ | ✅ |
| 广告系统 | ❌ | ✅ | ✅ |
| 系统设置（密钥轮换） | ❌ | ✅ | ✅ |
| 白标（品牌/域名定制） | ❌ | ❌ | ✅ |
| 多租户 | ❌ | ❌ | ✅ |

## 如何配置

```bash
# backend/.env
LICENSE_TIER=pro        # community | pro | enterprise
```

- **community**：交易/管理接口全部 403（中间件拦截）
- **pro**：完整业务功能（默认值）
- **enterprise**：pro + 白标/多租户（开发中）

## 接口

```json
GET /api/license
{
  "tier": "pro",
  "features": ["trading", "dividend", "admin", "advertising", "sysconfig"],
  "tiers": { "community": [], "pro": [...], "enterprise": [...] }
}
```

## 商业含义

| 等级 | 谁在用 | 收费 |
|------|--------|------|
| Community | 学习/演示/开源贡献者 | 免费 |
| Pro | 商业部署（自运营交易所） | 按年授权 |
| Enterprise | 白标/转售/SaaS 多租户 | 定制报价 |

> 许可依据：仓库 LICENSE 为 PolyForm Noncommercial —— 商业使用必须购买对应等级授权。
