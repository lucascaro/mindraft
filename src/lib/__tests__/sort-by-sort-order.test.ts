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
  it("sorts refinement queue (refineNext) before new and ordered items", () => {
    const ideas = [
      stub({ id: "ordered", sortOrder: 1 }),
      stub({ id: "new" }),
      stub({ id: "refine", refineNext: true, sortOrder: -1 }),
    ];
    const sorted = sortBySortOrder(ideas);
    expect(sorted.map((i) => i.id)).toEqual(["refine", "new", "ordered"]);
  });

  it("sorts new items (no sortOrder) between refinement and ordered", () => {
    const ideas = [
      stub({ id: "ordered-b", sortOrder: 2 }),
      stub({ id: "ordered-a", sortOrder: 1 }),
      stub({ id: "new-1" }),
      stub({ id: "refine", refineNext: true, sortOrder: -1 }),
      stub({ id: "new-2" }),
    ];
    const sorted = sortBySortOrder(ideas);
    expect(sorted.map((i) => i.id)).toEqual([
      "refine",
      "new-1",
      "new-2",
      "ordered-a",
      "ordered-b",
    ]);
  });

  it("sorts ordered items by sortOrder ascending", () => {
    const ideas = [
      stub({ id: "c", sortOrder: 3 }),
      stub({ id: "a", sortOrder: 1 }),
      stub({ id: "b", sortOrder: 2 }),
    ];
    const sorted = sortBySortOrder(ideas);
    expect(sorted.map((i) => i.id)).toEqual(["a", "b", "c"]);
  });

  it("sorts new items by createdAt newest first", () => {
    const ideas = [
      stub({ id: "old", createdAt: { toMillis: () => 100 } as Idea["createdAt"] }),
      stub({ id: "new", createdAt: { toMillis: () => 200 } as Idea["createdAt"] }),
    ];
    const sorted = sortBySortOrder(ideas);
    expect(sorted.map((i) => i.id)).toEqual(["new", "old"]);
  });

  it("treats legacy items with sortOrder 0 as ordered (not new)", () => {
    const ideas = [
      stub({ id: "legacy", sortOrder: 0 }),
      stub({ id: "new-idea" }),
      stub({ id: "refine", refineNext: true, sortOrder: -1 }),
    ];
    const sorted = sortBySortOrder(ideas);
    expect(sorted.map((i) => i.id)).toEqual(["refine", "new-idea", "legacy"]);
  });
});
