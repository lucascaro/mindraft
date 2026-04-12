/**
 * E2E mock for @/lib/firestore.
 * In-memory store with the same API surface. Supports real-time
 * subscriptions so the UI updates reactively during tests.
 */

import type { Idea, IdeaStatus } from "@/lib/types";

// ── Mock Timestamp ──────────────────────────────────────────────────────────

function mockTimestamp(date = new Date()) {
  return {
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
    toDate: () => date,
    toMillis: () => date.getTime(),
  };
}

// ── In-memory store ─────────────────────────────────────────────────────────

let ideas: Idea[] = [];
let nextId = 1;
let tagColors: Record<string, Record<string, string>> = {};

type IdeaListener = (ideas: Idea[]) => void;
type TagColorListener = (overrides: Record<string, string>) => void;

const ideaListeners = new Set<{ userId: string; filter: string; cb: IdeaListener }>();
const tagColorListeners = new Set<{ userId: string; cb: TagColorListener }>();

function mockSortTier(idea: Idea): number {
  if (idea.refineNext) return 0;
  if (idea.sortOrder == null) return 1;
  return 2;
}

function notifyIdeaListeners() {
  for (const { userId, filter, cb } of ideaListeners) {
    const userIdeas = ideas.filter((i) => i.userId === userId);
    if (filter === "active") {
      const active = userIdeas
        .filter((i) => !i.archived)
        .sort((a, b) => {
          const aTier = mockSortTier(a);
          const bTier = mockSortTier(b);
          if (aTier !== bTier) return aTier - bTier;
          if (aTier !== 1) {
            const aOrder = a.sortOrder ?? 0;
            const bOrder = b.sortOrder ?? 0;
            if (aOrder !== bOrder) return aOrder - bOrder;
          }
          const aTime = a.createdAt?.toMillis?.() ?? 0;
          const bTime = b.createdAt?.toMillis?.() ?? 0;
          return bTime - aTime;
        });
      cb(active);
    } else {
      const archived = userIdeas.filter((i) => i.archived === true);
      cb(archived);
    }
  }
}

function notifyTagColorListeners(userId: string) {
  for (const listener of tagColorListeners) {
    if (listener.userId === userId) {
      listener.cb(tagColors[userId] ?? {});
    }
  }
}

// ── Exported API (matches @/lib/firestore) ──────────────────────────────────

export function subscribeToIdeas(
  userId: string,
  callback: (ideas: Idea[]) => void,
  filter: "active" | "archived" = "active",
  _mk: CryptoKey | null = null
) {
  const entry = { userId, filter, cb: callback };
  ideaListeners.add(entry);

  // Immediately fire with current state
  const userIdeas = ideas.filter((i) => i.userId === userId);
  if (filter === "active") {
    callback(
      userIdeas
        .filter((i) => !i.archived)
        .sort((a, b) => {
          const aTier = mockSortTier(a);
          const bTier = mockSortTier(b);
          if (aTier !== bTier) return aTier - bTier;
          if (aTier !== 1) {
            const aOrder = a.sortOrder ?? 0;
            const bOrder = b.sortOrder ?? 0;
            if (aOrder !== bOrder) return aOrder - bOrder;
          }
          const aTime = a.createdAt?.toMillis?.() ?? 0;
          const bTime = b.createdAt?.toMillis?.() ?? 0;
          return bTime - aTime;
        })
    );
  } else {
    callback(userIdeas.filter((i) => i.archived === true));
  }

  return () => {
    ideaListeners.delete(entry);
  };
}

export async function addIdea(userId: string, title: string, body = "", _mk: CryptoKey | null = null) {
  const now = mockTimestamp();
  const idea: Idea = {
    id: `mock-${nextId++}`,
    title,
    body,
    tags: [],
    status: "raw" as IdeaStatus,
    createdAt: now as Idea["createdAt"],
    updatedAt: now as Idea["updatedAt"],
    userId,
  };
  ideas.push(idea);
  notifyIdeaListeners();
  return { id: idea.id };
}

export async function updateIdea(
  id: string,
  data: Partial<Omit<Idea, "id" | "createdAt" | "userId">>,
  _opts?: { mk?: CryptoKey | null; currentIdea?: Idea }
) {
  const idx = ideas.findIndex((i) => i.id === id);
  if (idx === -1) return;
  ideas[idx] = {
    ...ideas[idx],
    ...data,
    updatedAt: mockTimestamp() as Idea["updatedAt"],
  };
  notifyIdeaListeners();
}

export async function archiveIdea(id: string) {
  const idx = ideas.findIndex((i) => i.id === id);
  if (idx === -1) return;
  ideas[idx] = {
    ...ideas[idx],
    archived: true,
    archivedAt: mockTimestamp() as Idea["archivedAt"],
    updatedAt: mockTimestamp() as Idea["updatedAt"],
  };
  notifyIdeaListeners();
}

export async function restoreIdea(id: string) {
  const idx = ideas.findIndex((i) => i.id === id);
  if (idx === -1) return;
  const { archivedAt: _, ...rest } = ideas[idx];
  ideas[idx] = {
    ...rest,
    archived: false,
    updatedAt: mockTimestamp() as Idea["updatedAt"],
  };
  notifyIdeaListeners();
}

export async function deleteIdea(id: string) {
  ideas = ideas.filter((i) => i.id !== id);
  notifyIdeaListeners();
}

export async function reorderIdeas(updates: { id: string; sortOrder: number }[]) {
  for (const { id, sortOrder } of updates) {
    const idx = ideas.findIndex((i) => i.id === id);
    if (idx !== -1) {
      ideas[idx] = { ...ideas[idx], sortOrder };
    }
  }
  notifyIdeaListeners();
}

export function subscribeToTagColors(
  userId: string,
  callback: (overrides: Record<string, string>) => void
) {
  const entry = { userId, cb: callback };
  tagColorListeners.add(entry);
  callback(tagColors[userId] ?? {});
  return () => {
    tagColorListeners.delete(entry);
  };
}

export async function setTagColor(userId: string, tag: string, colorKey: string) {
  if (!tagColors[userId]) tagColors[userId] = {};
  tagColors[userId][tag] = colorKey;
  notifyTagColorListeners(userId);
}

export async function exportAllIdeas(userId: string, _mk: CryptoKey | null = null): Promise<Idea[]> {
  return ideas
    .filter((i) => i.userId === userId)
    .sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() ?? 0;
      const bTime = b.createdAt?.toMillis?.() ?? 0;
      return bTime - aTime;
    });
}

export async function deleteAllUserIdeas(userId: string): Promise<void> {
  ideas = ideas.filter((i) => i.userId !== userId);
  notifyIdeaListeners();
}

// ── Test helpers (exposed on window for Playwright) ─────────────────────────

export function __resetStore() {
  ideas = [];
  nextId = 1;
  tagColors = {};
  ideaListeners.clear();
  tagColorListeners.clear();
}

export function __seedIdeas(seed: Idea[]) {
  ideas = [...seed];
  notifyIdeaListeners();
}

// Expose helpers on window so Playwright can call them
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__e2eMockStore = {
    resetStore: __resetStore,
    seedIdeas: __seedIdeas,
    getIdeas: () => [...ideas],
  };
}
