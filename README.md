# 理财记录仪表盘

一个纯静态、零成本的理财记录网站：持仓明细、收益统计、可视化图表、纳指100估值仪表盘。
估值指标（PE / PS / VIX）由 GitHub Actions 每天自动抓取更新；个人持仓数据保存在你自己的浏览器 localStorage 中，**不会上传到任何地方**。

## 功能

- 持仓明细表：增删改查，股票/债券/黄金/现金四大类
- 收益统计卡片：累计收益、今日收益、最大回撤、持仓天数（自动计算）
- 可视化图表：今日涨跌幅柱状图、资产配置饼图、收益率走势折线图（对比沪深300/中证500/纳指100/黄金ETF）
- 估值仪表盘：纳指100 PE/PB/PS 分位 + VIX 恐慌指数，云端每日自动更新
- 数据导入/导出 JSON，多设备备份迁移

## 目录结构

```
finance-dashboard/
├── index.html                          # 网站首页
├── assets/charts.js                    # 页面交互逻辑
├── _shared/js/echarts.min.js           # 图表库
├── data/valuation.json                 # 估值数据（每日自动更新）
├── scripts/fetch_valuation.py          # 数据抓取脚本
└── .github/workflows/update-valuation.yml  # 定时任务配置
```

## 部署步骤（一次性，约10分钟）

1. **注册 GitHub 账号**（免费）：https://github.com/signup

2. **创建仓库**：登录后点右上角 `+` → New repository
   - 名称：`finance-dashboard`（可自定义）
   - 可见性：**Public**（Private 无法免费使用 Pages 与 Actions）
   - 勾选 "Add a README file"
   - 点 Create repository

3. **上传文件**：在仓库页面点 "Add file" → "Upload files"，把本目录下所有文件和文件夹拖进去（包括隐藏的 `.github` 文件夹），点 Commit changes。
   > 注意：`.github` 是隐藏文件夹，Windows 资源管理器需开启"查看 → 显示 → 隐藏的项目"才能看到。

4. **启用 GitHub Pages**：仓库 Settings → 左侧 Pages
   - Source: `Deploy from a branch`
   - Branch: `main`，文件夹 `/ (root)`
   - 点 Save，等 1-2 分钟

5. **访问网站**：地址为 `https://<你的用户名>.github.io/finance-dashboard/`
   手机浏览器同样可以打开，建议添加到主屏幕。

6. **验证自动更新**：仓库顶部 Actions 标签 → 左侧 "Update valuation data" → 右侧 "Run workflow" 手动跑一次，确认绿勾。之后每天北京时间早上 5:30 左右自动执行（覆盖美股每个交易日收盘数据）。

## 数据源说明

| 指标 | 来源 | 更新方式 |
|------|------|----------|
| PE（含10年正态近似分位） | worldperatio.com | 每日自动 |
| PS（原始值） | gurufocus.com | 每日自动（偶有反爬拦截会自动沿用上次数据） |
| VIX（含近10年精确分位） | FRED (VIXCLS) 官方序列 | 每日自动 |
| PB | 无稳定免费数据源 | 页面「手动编辑」维护 |

修改自动更新时间：编辑 `.github/workflows/update-valuation.yml` 中的 `cron` 字段（UTC 时间，北京时间 = UTC + 8）。

## 隐私说明

- 公开仓库中的 `data/valuation.json` 只包含指数公开估值数据
- 你的持仓、收益、走势数据全部存在浏览器 localStorage，不上传
- 换设备/换浏览器时，用页面上的「导出数据」/「导入数据」迁移

## 本地预览

直接双击 `index.html` 即可打开（估值显示手动模式属正常现象，云端数据需 HTTP 服务才能加载）。
