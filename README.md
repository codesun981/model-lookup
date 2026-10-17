# 模型参数查询

输入模型名称，查询上下文窗口、最大输出、价格与能力。

- **在线地址**：https://codesun981.github.io/model-lookup/
- **数据来源**：[models.dev](https://models.dev)（`data/models.json`，GitHub Actions 每天 08:00 CST 自动更新，有变化才提交）
- **图标来源**：[LobeHub Icons](https://icons.lobehub.com)（`@lobehub/icons-static-svg`，MIT），按需 vendor 到 `icons/` 目录

## 本地预览

纯静态站，无构建步骤，直接用任意静态服务器打开：

```bash
cd model-lookup && python3 -m http.server 8000
# 浏览器打开 http://localhost:8000
```

## 商标声明

`icons/` 下的品牌图标其商标权归各品牌所有者，本项目仅作识别性使用（指名性合理使用），不暗示任何背书或关联。
