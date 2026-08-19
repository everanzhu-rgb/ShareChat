# 部署到 qijian.everanz.com

当前文件只提供模板，不代表已经修改 Cloudflare。

## 将新增的唯一公网入口

- 主机名：`qijian.everanz.com`
- 目标：名为 `qijian-prod` 的 Cloudflare Tunnel
- Tunnel 内部服务：`http://web:3000`

不会修改 `everanz.com` 根记录、邮件记录或其他子域。

## 操作顺序

1. 在 Linux 服务器安装 Docker 与 Compose。
2. 将项目复制到服务器，复制 `.env.example` 为 `.env`。
3. 生成并填写 PostgreSQL、MinIO、会话和备份密码；不要把 `.env` 发给别人。
4. 先不启用 cloudflared，运行 `docker compose up -d postgres minio web`。
5. 确认 web、postgres、minio 的健康状态。
6. 在 Cloudflare Zero Trust 中创建 `qijian-prod` Tunnel。
7. 新增 Public Hostname `qijian.everanz.com`，服务选择 HTTP，地址 `web:3000`。
8. 将 Tunnel token 安全写入服务器 `.env`，不要提交 Git。
9. 运行 `docker compose --profile cloudflare up -d`。
10. 访问 `https://qijian.everanz.com`，确认 HTTPS 和主机名正确。

## 缓存规则

- `/api/*`、`/auth/*`、`/attachments/*`、`/keys/*` 全部 Bypass Cache。
- Service Worker 每次重新验证。
- 仅带内容哈希的静态资源长期缓存。
- 不启用覆盖全站的 Cache Everything。

真实修改前，Codex 必须向用户展示上述精确新增项并得到确认。
