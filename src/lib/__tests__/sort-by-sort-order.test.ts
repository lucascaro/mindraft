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
  it("places refineNext items before others", () => {
    const ideas = [
      stub({ id: "a", sortOrder: 0 }),
      stub({ id: "b", sortOrder: 1, refineNext: true }),
      stub({ id: "c", sortOrder: 2 }),
    ];
    const sorted = sortBySortOrder(ideas);
    expect(sorted.map((i) => i.id)).toEqual(["b", "a", "c"]);
  });

  it("preserves sortOrder among refineNext items", () => {
    const ideas = [
      stub({ id: "a", sortOrder: 2, refineNext: true }),
      stub({ id: "b", sortOrder: 0, refineNext: true }),
      stub({ id: "c", sortOrder: 1 }),
    ];
    const sorted = sortBySortOrder(ideas);
    expect(sorted.map((i) => i.id)).toEqual(["b", "a", "c"]);
  });

  it("falls back to newest-first when sortOrder matches", () => {
    const ideas = [
      stub({ id: "old", createdAt: { toMillis: () => 100 } as Idea["createdAt"] }),
      stub({ id: "new", createdAt: { toMillis: () => 200 } as Idea["createdAt"] }),
    ];
    const sorted = sortBySortOrder(ideas);
    expect(sorted.map((i) => i.id)).toEqual(["new", "old"]);
  });
});
