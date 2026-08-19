export type EntryVisibility = "private" | "shared" | "scheduled";
export type EntryState = "published" | "trash" | "purged";

export interface EntryAccessContext {
  ownerUserId: string;
  coupleSpaceId?: string;
  visibility: EntryVisibility;
  state: EntryState;
  publishAt?: string;
}

export interface ViewerContext {
  userId: string;
  activeCoupleSpaceIds: ReadonlySet<string>;
  now: Date;
}

export function canReadEntry(entry: EntryAccessContext, viewer: ViewerContext): boolean {
  if (entry.state !== "published") return entry.ownerUserId === viewer.userId;
  if (entry.ownerUserId === viewer.userId) return true;
  if (!entry.coupleSpaceId || !viewer.activeCoupleSpaceIds.has(entry.coupleSpaceId)) return false;
  if (entry.visibility === "shared") return true;
  if (entry.visibility !== "scheduled" || !entry.publishAt) return false;
  return new Date(entry.publishAt).getTime() <= viewer.now.getTime();
}

export function canEditEntry(entry: EntryAccessContext, viewerUserId: string): boolean {
  return entry.ownerUserId === viewerUserId && entry.state !== "purged";
}

export function canInteractWithEntry(entry: EntryAccessContext, viewer: ViewerContext): boolean {
  return canReadEntry(entry, viewer) && entry.visibility !== "private" && entry.state === "published";
}

export function isEligibleForSharedMemory(entry: EntryAccessContext, now: Date): boolean {
  if (entry.state !== "published") return false;
  if (entry.visibility === "shared") return true;
  return entry.visibility === "scheduled" && !!entry.publishAt && new Date(entry.publishAt).getTime() <= now.getTime();
}
