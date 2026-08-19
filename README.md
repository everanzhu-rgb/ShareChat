# 栖笺 Qijian

让两个人的日常，有一处安静栖居。

这是面向 iPhone 的情侣共享私密手记 PWA。当前已交付可运行的本机核心版本：今日回忆、私人/共享/定时手记、自动加密草稿、照片与多类附件入口、心情、评论反应、回收站、主题和离线应用壳。

> 当前阶段说明：浏览器内容使用本机不可导出密钥加密后写入 IndexedDB。PostgreSQL、MinIO、Apple 登录和多设备端到端同步的生产架构已经写入规格和部署骨架，但服务端业务尚未完成，不能把当前版本宣传成已经完成多设备端到端加密。

## 路径 A：在电脑本地体验

### 1. 准备

需要 Node.js 22.13 或更高版本。项目在 Node.js 24 上验证通过。

### 2. 安装

在 `qijian` 文件夹打开终端：

    npm ci

成功时会看到依赖安装完成。不要执行带 `--force` 的自动升级。

### 3. 启动

    npm run dev

看到 `http://localhost:3000/` 后，用浏览器打开这个地址。

### 4. 当前可以体验

- 在“今日”查看共同回忆；
- 点击中央按钮写手记；
- 选择仅自己、立即共享或定时开启；
- 添加照片、视频和各类内容卡片；
- 草稿自动加密保存到本机；
- 在“手记”切换共享、私藏、待开启和草稿；
- 打开共享手记，添加反应或评论；
- 删除到回收站并恢复；
- 切换深色暮纸主题。

本机数据位于浏览器站点数据的 IndexedDB。清除浏览器站点数据会删除它；接入服务器同步之前，请勿把该版本用于唯一的重要日记副本。

### 5. 验证

    npm run test
    npm run typecheck
    npm run lint
    npm run build

### 6. 停止

在运行开发服务的终端按 `Ctrl+C`。

## 路径 B：未来部署到 qijian.everanz.com

部署骨架位于 `compose.yaml`，详细步骤见 `docs/DEPLOY_CLOUDFLARE.md`。

目前不建议把这一阶段直接当作正式私密服务上线，因为服务器端 PostgreSQL 权限、MinIO 密文附件、多设备密钥分享和 Apple 登录仍需继续实现。

真实上线前至少需要：

1. 完成服务端权限与 RLS；
2. 完成媒体分块端到端加密；
3. 完成 Passkey、恢复密钥和 Apple 登录；
4. 完成跨情侣隔离与端到端测试；
5. 完成备份恢复演练；
6. 创建 Cloudflare Tunnel 和 `qijian.everanz.com`。

## 关键文档

- `docs/STATUS.md`：当前进度；
- `docs/THREAT_MODEL.md`：安全边界；
- `docs/PWA_LIMITATIONS.md`：iPhone 网页限制；
- `docs/DEPLOY_CLOUDFLARE.md`：Cloudflare 部署；
- `docs/OPERATOR_ACTIONS.md`：需要拥有者完成的外部操作；
- `QIJIAN_CODEX_MASTER_PROMPT.md`：完整产品工程规格位于上级目录。

## 安全提示

- 不要提交 `.env`；
- 不要把 Apple 私钥、Tunnel token、恢复短语发给别人；
- 服务端未来只保存密文，但 PWA 仍不能绝对防御服务器被控制后下发恶意脚本；
- 已经被伴侣看到、截图或导出的内容无法通过撤销权限让其“忘记”。
