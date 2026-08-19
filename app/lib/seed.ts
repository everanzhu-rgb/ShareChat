import type { JournalEntry } from "./types";

function isoDaysAgo(days: number, hour: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 18, 0, 0);
  return date.toISOString();
}

export const seedEntries: JournalEntry[] = [
  {
    id: "memory-rain-window",
    author: "予安",
    title: "雨停以前",
    body: "下班路上忽然下起很大的雨。站在屋檐下等的时候，我想起第一次和你共用一把伞。那时我们都故意走得很慢。",
    createdAt: isoDaysAgo(1, 21),
    updatedAt: isoDaysAgo(1, 21),
    visibility: "shared",
    status: "published",
    attachments: [
      { id: "rain-weather", kind: "weather", label: "小雨", detail: "18°C · 空气里有潮湿的树叶味" },
      { id: "rain-place", kind: "location", label: "梧桐路口", detail: "只在这篇手记中保存" },
    ],
    mood: "安静",
    place: "梧桐路口",
    reactions: { "抱抱": 1, "🌧️": 1 },
    comments: [
      {
        id: "comment-rain-1",
        author: "我",
        body: "我也记得。其实那天我把伞往你那边偏了很多。",
        createdAt: isoDaysAgo(1, 22),
        quotedText: "我们都故意走得很慢",
      },
    ],
    favorite: true,
  },
  {
    id: "memory-sunflower",
    author: "我",
    title: "路过一棵开花的树",
    body: "今天没有发生什么大事。只是经过河边时，风把一整树的花吹下来，我忽然很想把这个瞬间留给你。",
    createdAt: isoDaysAgo(4, 18),
    updatedAt: isoDaysAgo(3, 9),
    visibility: "shared",
    status: "published",
    attachments: [
      { id: "tree-photo", kind: "photo", label: "暮色里的花树", detail: "照片预览将在客户端加密" },
      { id: "tree-music", kind: "music", label: "晚风播放列表", detail: "点击后播放 · 外部链接会先提示" },
    ],
    mood: "想念",
    place: "河畔步道",
    reactions: { "我们懂": 1, "✨": 1 },
    comments: [],
    edited: true,
  },
  {
    id: "memory-private-letter",
    author: "我",
    title: "还没说出口的话",
    body: "这是一页只属于我的私藏。等我准备好，再决定要不要让你看见。",
    createdAt: isoDaysAgo(2, 23),
    updatedAt: isoDaysAgo(2, 23),
    visibility: "private",
    status: "published",
    attachments: [],
    mood: "复杂",
    reactions: {},
    comments: [],
  },
];
