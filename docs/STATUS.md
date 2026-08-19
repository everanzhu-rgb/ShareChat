# 栖笺开发状态

更新时间：2026-08-13

## 当前阶段

阶段 1 已完成；阶段 2 至 4 的本机产品闭环已开始，服务器认证和同步尚未完成。

## 已完成

- 完整读取工程总指令。
- 检查工作区；确认此前只有 Prompt，无既有项目与 Git 仓库。
- 使用 Sites 官方初始工程创建 `qijian/` 项目与独立 Git 仓库。
- 启动本地开发预览。
- 确认产品采用 iPhone PWA、自托管 PostgreSQL/MinIO 与 Cloudflare Tunnel 的目标架构。
- 安装本地持久化、图标和测试依赖。
- 完成“暮纸”响应式 iPhone 产品界面，替换全部临时骨架。
- 完成本机加密保险箱：AES-GCM、对象上下文绑定、不可导出设备密钥、IndexedDB。
- 完成自动草稿、三种可见范围、共享回忆流、手记筛选、日历、评论反应、回收站和深色主题。
- 完成图片/视频文件入口，以及语音、位置、天气、音乐、手绘和活动卡片入口。
- 完成 Manifest、Service Worker 离线壳、隐私化 Push 处理器和原创 PWA 图标。
- 完成 Docker Compose、PostgreSQL、MinIO、cloudflared 的生产骨架和 Cloudflare 操作文档。
- 完成生产加密协议包：XChaCha20-Poly1305、sealed box、Ed25519、24 词恢复短语与安全数字。
- 完成 PostgreSQL 核心迁移初稿与 RLS 策略，覆盖用户、情侣空间、设备、手记、Revision、密钥封装、附件、评论、回收站和 outbox。
- 完成应用层统一授权规则与测试，覆盖私人、共享、定时、回收站、编辑和跨情侣隔离语义。
- 生成并接入栖笺社交分享预览图 `public/og.png`；采用图像生成内置模式，第二次生成修正了中文标题。
- 移除 Sites 临时预览和不再使用的 skeleton 依赖。

## 正在进行

- PostgreSQL 数据模型、RLS、服务端 API 和多设备同步。
- Passkey、恢复短语、邀请确认与 Apple 登录适配。
- 媒体真正的分块加密上传和 MinIO 接入。

## 下一步

1. 实现 XChaCha20-Poly1305、Ed25519、密钥 envelope 和恢复短语。
2. 实现 PostgreSQL schema、RLS 和权限接口。
3. 实现多设备同步、分块附件与 MinIO。
4. 实现 Passkey、配对、安全短语和开发 Bootstrap。
5. 完成端到端、隔离、离线和服务端无明文测试。

## 已执行检查

- `init-site.sh D:/ShareChat/qijian`：成功。
- `npm install`：成功；依赖审计报告 20 项传递依赖风险，待阶段 8 逐项审计，不使用破坏性自动升级。
- `npm run dev`：在 Windows 下发现初始脚本的 Unix 环境变量语法不兼容；已改用 `cross-env` 修正。
- `npm run test`：加密与授权测试通过；精确数量以最近一次命令输出为准。
- `npm run typecheck`：通过。
- `npm run lint`：通过，保留 2 个本机 Blob 图片 `<img>` 性能提醒；这是避免把解密图片交给服务端优化的有意选择。
- `npm run build`：通过。

## 已知限制

- Apple 登录需要用户的 Apple Developer 配置，当前使用安全占位配置继续开发。
- Cloudflare 与真实 DNS 尚未修改。
- iPhone 真机测试尚未进行，不得标记为通过。
- 当前阶段的 AES-GCM 本机保险箱是开发闭环，不等同于最终 XChaCha20 端到端、多设备服务器同步。
- Docker Compose 是目标拓扑骨架；web 能构建，但 worker 目前还是同一应用启动命令，不能标记为后台任务已完成。
- `npm audit` 报告 20 项传递依赖风险；未使用破坏性的 `--force`，需在平台依赖升级和生产加固阶段逐项审计。
- 当前 Windows 环境未安装 Docker，因此 Compose 尚未实际启动；只能标记为配置骨架，必须在有 Docker 的 Linux 或开发机上演练。

## 待用户完成的外部操作

当前无。等本地实现与部署模板完成后，才请求 Apple 或 Cloudflare 的一项必要信息。
