import Dexie, { type EntityTable } from "dexie";
import { createDeviceKey, decryptJson, encryptJson } from "./crypto";
import type { CipherRecord, Draft, JournalEntry } from "./types";

interface KeyRecord {
  id: "device-key";
  key: CryptoKey;
}

type QijianDatabase = Dexie & {
  records: EntityTable<CipherRecord, "id">;
  keys: EntityTable<KeyRecord, "id">;
};

let database: QijianDatabase | undefined;

function getDatabase(): QijianDatabase {
  if (!database) {
    database = new Dexie("qijian-local-vault") as QijianDatabase;
    database.version(1).stores({
      records: "id, kind, updatedAt",
      keys: "id",
    });
  }
  return database;
}

async function getDeviceKey(): Promise<CryptoKey> {
  const db = getDatabase();
  const existing = await db.keys.get("device-key");
  if (existing) return existing.key;

  const key = await createDeviceKey();
  await db.keys.put({ id: "device-key", key });
  return key;
}

async function putEncrypted<T>(
  id: string,
  kind: CipherRecord["kind"],
  value: T,
): Promise<void> {
  const key = await getDeviceKey();
  const encrypted = await encryptJson(key, id, value);
  await getDatabase().records.put({
    id,
    kind,
    ...encrypted,
    updatedAt: new Date().toISOString(),
  });
}

async function readKind<T>(kind: CipherRecord["kind"]): Promise<T[]> {
  const records = await getDatabase().records.where("kind").equals(kind).toArray();
  if (records.length === 0) return [];
  const key = await getDeviceKey();
  return Promise.all(
    records.map((record) =>
      decryptJson<T>(key, record.id, record.iv, record.ciphertext),
    ),
  );
}

export const localVault = {
  loadEntries: () => readKind<JournalEntry>("entry"),
  loadDrafts: () => readKind<Draft>("draft"),
  saveEntry: (entry: JournalEntry) => putEncrypted(entry.id, "entry", entry),
  saveDraft: (draft: Draft) => putEncrypted(draft.id, "draft", draft),
  deleteEntry: (id: string) => getDatabase().records.delete(id),
  deleteDraft: (id: string) => getDatabase().records.delete(id),
  clear: () => getDatabase().delete(),
};
