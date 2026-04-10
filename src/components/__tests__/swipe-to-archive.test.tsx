import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { SwipeToArchive } from "../swipe-to-archive";
import {
  pointerDown,
  pointerMove,
  pointerUp,
  simulateSwipe,
} from "@/test/helpers";

function renderSwipe({
  enabled = true,
  onArchive = vi.fn(),
  onClick = vi.fn(),
} = {}) {
  const result = render(
    <SwipeToArchive enabled={enabled} onArchive={onArchive}>
      <button onClick={onClick}>Child</button>
    </SwipeToArchive>
  );
  const container = result.container.firstElementChild as HTMLElement;
  const child = result.getByText("Child");
  // Spread result first so our container/child override RTL's container
  return { ...result, container, child, onArchive, onClick };
}

describe("SwipeToArchive", () => {
  it("allows click events to propagate when no swipe occurs", () => {
    const { child, onClick } = renderSwipe();
    fireEvent.click(child);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("allows click after tap (pointerdown+pointerup without movement)", () => {
    const { container, child, onClick } = renderSwipe();

    pointerDown(container, { clientX: 100, clientY: 100 });
    pointerUp(container, { clientX: 100, clientY: 100 });

    fireEvent.click(child);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("blocks click events after a swipe gesture", () => {
    const { container, child, onClick } = renderSwipe();

    pointerDown(container, { clientX: 0, clientY: 100 });
    pointerMove(container, { clientX: 30, clientY: 100 });
    pointerUp(container, { clientX: 30, clientY: 100 });

    // After a swipe, handleClickCapture blocks clicks (swipedRef is true)
    fireEvent.click(child);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("calls onArchive when swiped past threshold", () => {
    vi.useFakeTimers();
    const onArchive = vi.fn();
    const { container } = renderSwipe({ onArchive });

    // MIN_THRESHOLD is 100 (offsetWidth is 0 in jsdom)
    simulateSwipe(container, { startX: 0, endX: 250 });

    // flyOut uses setTimeout(onEnd, FLY_OUT_MS + 50) = 350ms as fallback
    vi.advanceTimersByTime(400);
    vi.useRealTimers();

    expect(onArchive).toHaveBeenCalledTimes(1);
  });

  it("does NOT call onArchive when swipe is below threshold", () => {
    const { container, onArchive } = renderSwipe();
    simulateSwipe(container, { startX: 0, endX: 50 });
    expect(onArchive).not.toHaveBeenCalled();
  });

  it("does not respond to swipe when disabled", () => {
    const { container, onArchive } = renderSwipe({ enabled: false });
    simulateSwipe(container, { startX: 0, endX: 250 });
    expect(onArchive).not.toHaveBeenCalled();
  });

  it("does not trigger swipe on vertical movement", () => {
    const { container, child, onClick, onArchive } = renderSwipe();

    pointerDown(container, { clientX: 100, clientY: 100 });
    pointerMove(container, { clientX: 105, clientY: 150 });
    pointerUp(container, { clientX: 105, clientY: 150 });

    expect(onArchive).not.toHaveBeenCalled();
    fireEvent.click(child);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not capture pointer on simple taps", () => {
    const captureSpy = vi.fn();
    const { container } = renderSwipe();
    container.setPointerCapture = captureSpy;

    pointerDown(container, { clientX: 100, clientY: 100 });
    pointerUp(container, { clientX: 100, clientY: 100 });

    expect(captureSpy).not.toHaveBeenCalled();
  });

  it("captures pointer only when a rightward swipe is detected", () => {
    const captureSpy = vi.fn();
    const { container } = renderSwipe();
    container.setPointerCapture = captureSpy;

    pointerDown(container, { clientX: 0, clientY: 100 });
    expect(captureSpy).not.toHaveBeenCalled();

    pointerMove(container, { clientX: 30, clientY: 100 });
    expect(captureSpy).toHaveBeenCalledTimes(1);

    pointerUp(container, { clientX: 30, clientY: 100 });
  });
});
