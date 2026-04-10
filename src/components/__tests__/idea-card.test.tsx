import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { IdeaCard } from "../idea-card";
import type { Idea } from "@/lib/types";

function mockIdea(overrides: Partial<Idea> = {}): Idea {
  return {
    id: "test-1",
    title: "Test Idea",
    body: "Some body text",
    tags: ["tag1"],
    status: "raw",
    createdAt: { seconds: 1000, nanoseconds: 0, toDate: () => new Date() } as Idea["createdAt"],
    updatedAt: { seconds: 1000, nanoseconds: 0, toDate: () => new Date() } as Idea["updatedAt"],
    userId: "user-1",
    ...overrides,
  };
}

describe("IdeaCard", () => {
  it("calls onExpand when clicking a collapsed card", () => {
    const onExpand = vi.fn();
    const onCollapse = vi.fn();
    const { getByLabelText } = render(
      <IdeaCard
        idea={mockIdea()}
        expanded={false}
        onExpand={onExpand}
        onCollapse={onCollapse}
      />
    );

    // The card has aria-label="Test Idea" and role="button" when collapsed
    const card = getByLabelText("Test Idea");
    fireEvent.click(card);
    expect(onExpand).toHaveBeenCalledTimes(1);
  });

  it("does not call onExpand when clicking an expanded card", () => {
    const onExpand = vi.fn();
    const onCollapse = vi.fn();
    const { container } = render(
      <IdeaCard
        idea={mockIdea()}
        expanded={true}
        onExpand={onExpand}
        onCollapse={onCollapse}
      />
    );

    // Expanded card should not have role="button"
    const card = container.querySelector("[aria-expanded]") as HTMLElement;
    expect(card).not.toBeNull();
    expect(card.getAttribute("role")).toBeNull();

    fireEvent.click(card);
    expect(onExpand).not.toHaveBeenCalled();
  });

  it("expands via keyboard Enter on collapsed card", () => {
    const onExpand = vi.fn();
    const onCollapse = vi.fn();
    const { getByLabelText } = render(
      <IdeaCard
        idea={mockIdea()}
        expanded={false}
        onExpand={onExpand}
        onCollapse={onCollapse}
      />
    );

    const card = getByLabelText("Test Idea");
    fireEvent.keyDown(card, { key: "Enter" });
    expect(onExpand).toHaveBeenCalledTimes(1);
  });
});
