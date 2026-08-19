export type Visibility = "private" | "shared" | "scheduled";
export type EntryStatus = "published" | "trash";

export type AttachmentKind =
  | "photo"
  | "video"
  | "audio"
  | "location"
  | "weather"
  | "mood"
  | "music"
  | "drawing"
  | "activity";

export interface Attachment {
  id: string;
  kind: AttachmentKind;
  label: string;
  detail?: string;
  previewUrl?: string;
}

export interface Comment {
  id: string;
  author: "我" | "予安";
  body: string;
  createdAt: string;
  quotedText?: string;
}

export interface JournalEntry {
  id: string;
  author: "我" | "予安";
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  visibility: Visibility;
  publishAt?: string;
  status: EntryStatus;
  attachments: Attachment[];
  mood?: string;
  place?: string;
  reactions: Record<string, number>;
  comments: Comment[];
  edited?: boolean;
  favorite?: boolean;
}

export interface Draft {
  id: string;
  title: string;
  body: string;
  visibility: Visibility;
  publishAt?: string;
  attachments: Attachment[];
  mood?: string;
  place?: string;
  updatedAt: string;
}

export interface CipherRecord {
  id: string;
  kind: "entry" | "draft" | "setting";
  iv: string;
  ciphertext: string;
  updatedAt: string;
}
