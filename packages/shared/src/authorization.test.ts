import { describe, expect, it } from "vitest";
import { canEditEntry, canInteractWithEntry, canReadEntry, isEligibleForSharedMemory } from "./authorization";

const now = new Date("2026-08-13T12:00:00.000Z");
const owner = { userId: "a", activeCoupleSpaceIds: new Set(["couple-1"]), now };
const partner = { userId: "b", activeCoupleSpaceIds: new Set(["couple-1"]), now };
const stranger = { userId: "c", activeCoupleSpaceIds: new Set(["couple-2"]), now };

describe("手记授权语义", () => {
  it("私人内容只允许作者", () => {
    const entry = { ownerUserId: "a", visibility: "private" as const, state: "published" as const };
    expect(canReadEntry(entry, owner)).toBe(true);
    expect(canReadEntry(entry, partner)).toBe(false);
    expect(canReadEntry(entry, stranger)).toBe(false);
    expect(isEligibleForSharedMemory(entry, now)).toBe(false);
  });

  it("共享内容只允许同一 active 情侣空间", () => {
    const entry = { ownerUserId: "a", coupleSpaceId: "couple-1", visibility: "shared" as const, state: "published" as const };
    expect(canReadEntry(entry, partner)).toBe(true);
    expect(canInteractWithEntry(entry, partner)).toBe(true);
    expect(canReadEntry(entry, stranger)).toBe(false);
  });

  it("定时内容到期前只允许作者", () => {
    const future = { ownerUserId: "a", coupleSpaceId: "couple-1", visibility: "scheduled" as const, state: "published" as const, publishAt: "2026-08-14T12:00:00.000Z" };
    expect(canReadEntry(future, owner)).toBe(true);
    expect(canReadEntry(future, partner)).toBe(false);
    expect(isEligibleForSharedMemory(future, now)).toBe(false);

    const due = { ...future, publishAt: "2026-08-13T11:59:59.000Z" };
    expect(canReadEntry(due, partner)).toBe(true);
    expect(isEligibleForSharedMemory(due, now)).toBe(true);
  });

  it("回收站不对伴侣开放，且只有作者可编辑", () => {
    const entry = { ownerUserId: "a", coupleSpaceId: "couple-1", visibility: "shared" as const, state: "trash" as const };
    expect(canReadEntry(entry, partner)).toBe(false);
    expect(canReadEntry(entry, owner)).toBe(true);
    expect(canEditEntry(entry, "a")).toBe(true);
    expect(canEditEntry(entry, "b")).toBe(false);
  });
});
