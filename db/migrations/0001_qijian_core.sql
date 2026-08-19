CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE membership_state AS ENUM ('pending', 'active', 'left');
CREATE TYPE entry_visibility AS ENUM ('private', 'shared', 'scheduled');
CREATE TYPE entry_state AS ENUM ('published', 'trash', 'purged');

CREATE TABLE app_user (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apple_subject text UNIQUE,
  auth_mode text NOT NULL CHECK (auth_mode IN ('apple', 'passkey', 'development')),
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE couple_space (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'active', 'frozen', 'dissolving', 'closed')),
  created_by_user_id uuid NOT NULL REFERENCES app_user(id),
  current_shared_key_version integer NOT NULL DEFAULT 1,
  encrypted_settings_blob bytea,
  created_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  closed_at timestamptz
);

CREATE TABLE membership (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_space_id uuid NOT NULL REFERENCES couple_space(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  state membership_state NOT NULL DEFAULT 'pending',
  joined_at timestamptz,
  left_at timestamptz,
  UNIQUE (couple_space_id, user_id)
);

CREATE UNIQUE INDEX membership_one_active_space_per_user
  ON membership(user_id) WHERE state = 'active';

CREATE TABLE device (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  display_name_ciphertext bytea NOT NULL,
  encryption_public_key bytea NOT NULL,
  signing_public_key bytea NOT NULL,
  key_version integer NOT NULL DEFAULT 1,
  trust_state text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz,
  revoked_at timestamptz
);

CREATE TABLE entry (
  id uuid PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES app_user(id),
  couple_space_id uuid REFERENCES couple_space(id),
  visibility entry_visibility NOT NULL,
  state entry_state NOT NULL DEFAULT 'published',
  current_revision integer NOT NULL DEFAULT 1 CHECK (current_revision > 0),
  publish_at timestamptz,
  shared_at timestamptz,
  crypto_version integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CHECK ((visibility = 'private' AND couple_space_id IS NULL) OR (visibility <> 'private' AND couple_space_id IS NOT NULL)),
  CHECK (visibility <> 'scheduled' OR publish_at IS NOT NULL)
);

CREATE INDEX entry_owner_updated_idx ON entry(owner_user_id, updated_at DESC);
CREATE INDEX entry_space_updated_idx ON entry(couple_space_id, updated_at DESC) WHERE couple_space_id IS NOT NULL;
CREATE INDEX entry_publish_due_idx ON entry(publish_at) WHERE visibility = 'scheduled' AND state = 'published';

CREATE TABLE entry_revision (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES entry(id) ON DELETE CASCADE,
  revision_number integer NOT NULL,
  base_revision_number integer,
  author_user_id uuid NOT NULL REFERENCES app_user(id),
  encrypted_payload bytea NOT NULL,
  payload_header jsonb NOT NULL,
  content_schema_version integer NOT NULL,
  signature bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entry_id, revision_number)
);

CREATE TABLE entry_key_envelope (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES entry(id) ON DELETE CASCADE,
  key_version integer NOT NULL,
  recipient_scope text NOT NULL CHECK (recipient_scope IN ('user', 'couple', 'device')),
  recipient_id uuid NOT NULL,
  wrapped_data_key bytea NOT NULL,
  algorithm text NOT NULL,
  signature bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE TABLE attachment (
  id uuid PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES app_user(id),
  couple_space_id uuid REFERENCES couple_space(id),
  state text NOT NULL CHECK (state IN ('uploading', 'ready', 'failed', 'orphaned', 'purged')),
  storage_object_prefix text NOT NULL UNIQUE,
  encrypted_manifest bytea,
  chunk_count integer NOT NULL CHECK (chunk_count >= 0),
  ciphertext_size bigint NOT NULL DEFAULT 0,
  crypto_version integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  deleted_at timestamptz
);

CREATE TABLE attachment_chunk (
  attachment_id uuid NOT NULL REFERENCES attachment(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL CHECK (chunk_index >= 0),
  storage_object_key text NOT NULL UNIQUE,
  ciphertext_size integer NOT NULL CHECK (ciphertext_size > 0),
  ciphertext_hash bytea NOT NULL,
  upload_state text NOT NULL DEFAULT 'ready',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (attachment_id, chunk_index)
);

CREATE TABLE entry_comment (
  id uuid PRIMARY KEY,
  entry_id uuid NOT NULL REFERENCES entry(id) ON DELETE CASCADE,
  couple_space_id uuid NOT NULL REFERENCES couple_space(id),
  author_user_id uuid NOT NULL REFERENCES app_user(id),
  encrypted_payload bytea NOT NULL,
  key_version integer NOT NULL,
  signature bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

CREATE TABLE trash_record (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  object_type text NOT NULL,
  object_id uuid NOT NULL,
  owner_user_id uuid NOT NULL REFERENCES app_user(id),
  deleted_at timestamptz NOT NULL DEFAULT now(),
  purge_after timestamptz NOT NULL,
  restored_at timestamptz,
  purged_at timestamptz
);

CREATE TABLE outbox_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  minimal_payload jsonb NOT NULL DEFAULT '{}',
  available_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0,
  locked_at timestamptz,
  completed_at timestamptz,
  last_error_code text
);

CREATE INDEX outbox_available_idx ON outbox_event(available_at) WHERE completed_at IS NULL;

CREATE FUNCTION current_app_user_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.current_user_id', true), '')::uuid
$$;

ALTER TABLE couple_space ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership ENABLE ROW LEVEL SECURITY;
ALTER TABLE device ENABLE ROW LEVEL SECURITY;
ALTER TABLE entry ENABLE ROW LEVEL SECURITY;
ALTER TABLE entry_revision ENABLE ROW LEVEL SECURITY;
ALTER TABLE entry_key_envelope ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachment ENABLE ROW LEVEL SECURITY;
ALTER TABLE entry_comment ENABLE ROW LEVEL SECURITY;
ALTER TABLE trash_record ENABLE ROW LEVEL SECURITY;

CREATE POLICY device_owner_policy ON device
  USING (user_id = current_app_user_id())
  WITH CHECK (user_id = current_app_user_id());

CREATE POLICY membership_self_policy ON membership
  USING (user_id = current_app_user_id() OR EXISTS (
    SELECT 1 FROM membership mine
    WHERE mine.couple_space_id = membership.couple_space_id
      AND mine.user_id = current_app_user_id() AND mine.state = 'active'
  ));

CREATE POLICY couple_member_policy ON couple_space
  USING (created_by_user_id = current_app_user_id() OR EXISTS (
    SELECT 1 FROM membership m
    WHERE m.couple_space_id = couple_space.id
      AND m.user_id = current_app_user_id() AND m.state = 'active'
  ));

CREATE POLICY entry_access_policy ON entry
  USING (
    owner_user_id = current_app_user_id()
    OR (
      (visibility = 'shared' OR (visibility = 'scheduled' AND publish_at <= now()))
      AND state = 'published'
      AND EXISTS (
        SELECT 1 FROM membership m
        WHERE m.couple_space_id = entry.couple_space_id
          AND m.user_id = current_app_user_id() AND m.state = 'active'
      )
    )
  )
  WITH CHECK (owner_user_id = current_app_user_id());

CREATE POLICY revision_entry_policy ON entry_revision
  USING (EXISTS (SELECT 1 FROM entry e WHERE e.id = entry_revision.entry_id));

CREATE POLICY envelope_entry_policy ON entry_key_envelope
  USING (EXISTS (SELECT 1 FROM entry e WHERE e.id = entry_key_envelope.entry_id));

CREATE POLICY attachment_access_policy ON attachment
  USING (
    owner_user_id = current_app_user_id()
    OR EXISTS (
      SELECT 1 FROM membership m
      WHERE m.couple_space_id = attachment.couple_space_id
        AND m.user_id = current_app_user_id() AND m.state = 'active'
    )
  )
  WITH CHECK (owner_user_id = current_app_user_id());

CREATE POLICY comment_entry_policy ON entry_comment
  USING (EXISTS (SELECT 1 FROM entry e WHERE e.id = entry_comment.entry_id))
  WITH CHECK (
    author_user_id = current_app_user_id()
    AND EXISTS (SELECT 1 FROM entry e WHERE e.id = entry_comment.entry_id AND e.visibility = 'shared')
  );

CREATE POLICY trash_owner_policy ON trash_record
  USING (owner_user_id = current_app_user_id())
  WITH CHECK (owner_user_id = current_app_user_id());

-- 生产迁移角色应在执行后将应用角色权限收敛至所需表和操作。
