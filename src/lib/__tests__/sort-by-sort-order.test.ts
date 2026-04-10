import { describe, it, expect } from "vitest";
import { sortBySortOrder } from "../firestore";
import type { Idea } from "../types";

function stub(overrides: Partial<Idea>): Idea {
  return {
    id: "id",
    title: "",
    body: "",
    tags: [],
    status: "raw",
    userId: "u",
    createdAt: { toMillis: () => 0 } as Idea["createdAt"],
    updatedAt: { toMillis: () => 0 } as Idea["updatedAt"],
    ...overrides,
  };
}

describe("sortBySortOrder", () => {
  it("sorts by sortOrder ascending", () => {
    const ideas = [
      stub({ id: "c", sortOrder: 2 }),
      stub({ id: "a", sortOrder: 0 }),
      stub({ id: "b", sortOrder: 1 }),
    ];
    const sorted = sortBySortOrder(ideas);
    expect(sorted.map((i) => i.id)).toEqual(["a", "b", "c"]);
  });

  it("negative sortOrder sorts before zero (refineNext uses -1)", () => {
    const ideas = [
      stub({ id: "a", sortOrder: 0 }),
      stub({ id: "b", sortOrder: 1 }),
      stub({ id: "c", sortOrder: -1, refineNext: true }),
    ];
    const sorted = sortBySortOrder(ideas);
    expect(sorted.map((i) => i.id)).toEqual(["c", "a", "b"]);
  });

  it("falls back to newest-first when sortOrder matches", () => {
    const ideas = [
      stub({ id: "old", createdAt: { toMillis: () => 100 } as Idea["createdAt"] }),
      stub({ id: "new", createdAt: { toMillis: () => 200 } as Idea["createdAt"] }),
    ];
    const sorted = sortBySortOrder(ideas);
    expect(sorted.map((i) => i.id)).toEqual(["new", "old"]);
  });

  it("treats undefined sortOrder as Infinity", () => {
    const ideas = [
      stub({ id: "no-order", sortOrder: undefined }),
      stub({ id: "has-order", sortOrder: 0 }),
    ];
    const sorted = sortBySortOrder(ideas);
    expect(sorted.map((i) => i.id)).toEqual(["has-order", "no-order"]);
  });
});
