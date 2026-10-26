# TaxBench

TaxBench 的静态交互原型，使用 React、TypeScript 和 Vite，适用于 GitHub Pages。

- 仓库：[jokeviner/taxbench](https://github.com/jokeviner/taxbench)
- GitHub Pages 地址：[https://jokeviner.github.io/taxbench/](https://jokeviner.github.io/taxbench/)

本仓库提供页面、图表、案例切换和评测流程的浏览器内体验。源代码保存在 `main`，静态产物发布到 `gh-pages`；实际发布状态以 GitHub Pages 的部署结果为准。

## 本地运行

使用 Node.js 22.13 或更新的 22.x 版本及 npm。

```sh
npm ci
npm run dev
```

开发地址由 Vite 在终端输出，默认是 `http://127.0.0.1:5173/`。

```sh
npm run build
npm run preview
```

`build` 先执行 TypeScript 检查，再生成 `dist/`；`preview` 在本地预览构建产物，默认地址是 `http://127.0.0.1:4173/`。也可单独运行 `npm run check` 进行类型检查。

运行 `npm test` 可检查浏览器内的体验评测、依据核验、输入校验与无外部请求等行为；测试使用 Node.js 内置测试运行器，不调用真实模型服务。

## 数据与交互

此版本从 TaxBench 原型的展示组件和本地数据整理而来，所有模型、成绩、成本、耗时、回答、评分和参考资料均为人工编写或确定性生成的 mock 数据，并非真实模型测量或法律依据。

| 文件 | 用途 |
| --- | --- |
| `src/lib/mock-data.ts` | 9 个模型、4 个公开案例、8 道体验题及基准元数据 |
| `src/lib/case-responses.ts` | 不同模型的案例回答、逐项评分和参考资料 |
| `src/lib/benchmark-analytics.ts` | 分析报告、完成状态、核验调用和失分分布 |
| `src/lib/mock-runtime.ts` | 体验评测与依据核验的计时、状态和确定性结果 |
| `src/lib/mock-client.ts` | 浏览器内的 `mockFetch` 请求适配器与输入校验 |

“240 道私有基准题”只表示页面中的基准规模设定；本仓库不包含该题库的题目。公开案例和体验题独立编写。

页面中的 `/api/...` 路径只是 `mockFetch` 的分派名称，不会请求 GitHub Pages 上的 API，也没有服务端、数据库、真实模型调用或付费调用。填写的模型地址不会被连接，真实 API Key、密码和令牌不应填入，适配器会拒绝凭据字段。

合作咨询和订阅仅在浏览器中校验输入、生成回执，不发送邮件、提交给外部服务或保存联系信息。应用不使用数据库、Cookie、localStorage、sessionStorage 或 IndexedDB 持久化表单与任务状态；当前交互保留在页面内存中，刷新后重置。主动导出的体验结果只会在本机生成下载文件。

## 发布到 GitHub Pages

默认使用分支发布：`main` 保存源代码，`gh-pages` 的根目录保存 `dist/` 内的静态文件。

在 `origin` 已指向本仓库、Git 已登录且具备仓库推送权限的环境中运行：

```sh
npm test
npm run deploy
```

`npm run deploy` 先构建，再把 `dist/` 内容提交并推送到 `gh-pages`，不会部署源文件。源代码的提交与 `main` 推送独立进行。仅推送 `main` 不会更新已发布页面。

`gh-pages` 首次推送成功后，在仓库 **Settings → Pages → Build and deployment** 中设置：

- **Source**：Deploy from a branch
- **Branch**：`gh-pages`
- **Folder**：`/(root)`

保存后由 GitHub Pages 发布该分支。后续更新再次运行 `npm run deploy`，发布结果可在仓库的 Pages 设置和部署记录中查看。本文不代表已完成远程发布。

`vite.config.ts` 使用相对资源基路径 `./`，构建产物可以放在项目路径 `/taxbench/` 下。部署目录是 `dist/`，无需上传源文件或运行 Node.js 服务。

发布来源的设置见 [GitHub Pages 官方文档](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)。

## 可选：GitHub Actions 自动发布

`deployment/github-actions.yml.example` 是备用模板，不会自动执行。启用前，推送所用的凭据必须具备工作流写入权限；OAuth 或 classic PAT 需要 `workflow` scope。

如需切换为 Actions 发布，将模板复制为 `.github/workflows/deploy.yml`，并把 Pages 的 **Source** 改为 **GitHub Actions**。该工作流在 `main` 推送或手动触发后，使用 Node.js 22 依次安装依赖、测试、构建并上传 `dist/`，再部署到 `github-pages` 环境。

模板将构建任务的仓库读取权限与部署任务的 Pages 写入、OIDC 令牌权限分开，且串行处理站点发布。模板依据 [GitHub Pages 自定义工作流文档](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) 配置。切换后应统一使用 Actions 更新站点，避免和分支发布混用。
