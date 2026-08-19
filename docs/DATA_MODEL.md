# 数据模型与权限摘要

核心迁移位于 `db/migrations/0001_qijian_core.sql`。

## 隔离边界

- `app_user`：账号；
- `couple_space` 与 `membership`：最多两名 active 成员；
- `device`：每设备独立公钥和撤销状态；
- `entry`：只保存权限、状态、版本、时间和密文引用所需元数据；
- `entry_revision`：不可变密文版本；
- `entry_key_envelope`：按个人、情侣或设备封装 Data Key；
- `attachment` 与 `attachment_chunk`：MinIO 密文对象的最小元数据；
- `entry_comment`：加密评论；
- `trash_record`：回收与到期清理；
- `outbox_event`：定时公开和通知的可靠投递。

## 一致授权语义

应用层规则位于 `packages/shared/src/authorization.ts`：

- 私人：仅 owner；
- 共享：同一 active couple；
- 定时：到期前仅 owner，到期后同一 active couple；
- trash：仅 owner；
- 编辑：仅 owner；
- 互动：必须可读、非私人、published。

PostgreSQL RLS 使用相同语义作为纵深防御。后续 API 测试必须同时验证应用规则和真实 PostgreSQL RLS。
