# GitHub 网页端上传交接单

请使用已授权的 GitHub 插件完成以下操作。不要把本说明中的范围扩大到其他本地文件。

## 目标

- GitHub 仓库名：`aitraceroot-v2`
- 描述：`AI-native crypto market and on-chain intelligence terminal.`
- 可见性：`Public`（用于活动、黑客松和生态 Quest 展示）
- 默认分支：`main`
- Website：`https://aitraceroot.pro/v2/`
- Topics：`crypto`、`web3`、`onchain`、`ai`、`trading-terminal`、`smart-money`、`pwa`、`javascript`

## 上传内容

上传用户附带的 `aitraceroot-v2-public-d723acf.zip` 中的全部内容，并保持目录结构。该压缩包由本地 Git 提交 `d723acf` 生成，只包含经过筛选的 251 个公开文件。

压缩包应包含：

- 前端源码：`webroot/v2/`
- 构建与验证：`scripts/*.mjs`
- 测试：`tests/`
- 活动材料：`docs/event/`
- 架构、安全与功能文档：`docs/`
- `README.md`、`SECURITY.md`、`CONTRIBUTING.md`、`LICENSE`
- `package.json`、`package-lock.json`、`.gitignore`

## 禁止上传

不要从用户电脑继续搜索或补充其他文件。尤其不要上传：

- `_tmp_ssh/`、`id_ed25519*`、任何 `.pem` 或 `.key`
- `.env*`、API Key、密码、Token、TOTP、Cookie
- 数据库、CSV 客户数据、邮箱列表
- Python 部署脚本、服务器 IP、运维脚本
- `node_modules/`、`dist/`、临时截图和其他同级项目

## 执行要求

1. 检查 GitHub 当前登录账号，并在该账号下创建公开仓库 `aitraceroot-v2`。
2. 不要让 GitHub 自动生成 README、License 或 `.gitignore`，压缩包内已有这些文件。
3. 将压缩包内容上传到仓库根目录，不要把外层文件夹作为额外一级目录。
4. 默认分支设为 `main`。
5. 设置仓库描述、Website 和 Topics。
6. 上传完成后核对根目录能直接看到 `README.md`、`package.json`、`webroot/`、`scripts/`、`tests/` 和 `docs/`。
7. 返回最终仓库 URL、默认分支和最新提交 SHA。

## 验收标准

- 仓库公开可访问，README 正常渲染。
- 没有密钥、数据库、部署凭据或未列入压缩包的文件。
- 文件结构保持不变。
- `npm ci && npm test && npm run build` 是 README 中的可复现流程。
- 核心保护说明准确：生产构建采用压缩、tree shaking、无 sourcemap、入口混淆及 SHA-256 内容寻址；真正的凭据和私有算法留在服务端。

