import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { SwipeToArchive } from "../swipe-to-archive";
import { IdeaCard } from "../idea-card";
import type { Idea } from "@/lib/types";
import { pointerDown, pointerUp, simulateSwipe } from "@/test/helpers";

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

function renderWrappedCard() {
  const onExpand = vi.fn();
  const onCollapse = vi.fn();
  const onArchive = vi.fn();

  const result = render(
    <SwipeToArchive enabled={true} onArchive={onArchive}>
      <IdeaCard
        idea={mockIdea()}
        expanded={false}
        onExpand={onExpand}
        onCollapse={onCollapse}
      />
    </SwipeToArchive>
  );

  const wrapper = result.container.firstElementChild as HTMLElement;
  const card = result.getByLabelText("Test Idea");

  return { wrapper, card, onExpand, onCollapse, onArchive, ...result };
}

describe("SwipeToArchive + IdeaCard integration", () => {
  it("click on wrapped card triggers expand, not archive", () => {
    const { card, onExpand, onArchive } = renderWrappedCard();

    fireEvent.click(card);

    expect(onExpand).toHaveBeenCalledTimes(1);
    expect(onArchive).not.toHaveBeenCalled();
  });

  it("swipe on wrapped card triggers archive, not expand", () => {
    vi.useFakeTimers();
    const { wrapper, onExpand, onArchive } = renderWrappedCard();

    simulateSwipe(wrapper, { startX: 0, endX: 250 });
    vi.advanceTimersByTime(400);
    vi.useRealTimers();

    expect(onArchive).toHaveBeenCalledTimes(1);
    expect(onExpand).not.toHaveBeenCalled();
  });

  it("tap (pointerdown+pointerup same position) still triggers expand", () => {
    const { wrapper, card, onExpand, onArchive } = renderWrappedCard();

    // Simulate a tap: pointer down and up at same position
    pointerDown(wrapper, { clientX: 100, clientY: 100 });
    pointerUp(wrapper, { clientX: 100, clientY: 100 });

    // Then the click fires
    fireEvent.click(card);

    expect(onExpand).toHaveBeenCalledTimes(1);
    expect(onArchive).not.toHaveBeenCalled();
  });
});
