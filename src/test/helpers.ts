import { fireEvent } from "@testing-library/react";

export function pointerDown(
  element: Element,
  opts: { clientX?: number; clientY?: number; pointerId?: number } = {}
) {
  fireEvent.pointerDown(element, {
    pointerId: opts.pointerId ?? 1,
    clientX: opts.clientX ?? 0,
    clientY: opts.clientY ?? 0,
    button: 0,
  });
}

export function pointerMove(
  element: Element,
  opts: { clientX?: number; clientY?: number; pointerId?: number } = {}
) {
  fireEvent.pointerMove(element, {
    pointerId: opts.pointerId ?? 1,
    clientX: opts.clientX ?? 0,
    clientY: opts.clientY ?? 0,
  });
}

export function pointerUp(
  element: Element,
  opts: { clientX?: number; clientY?: number; pointerId?: number } = {}
) {
  fireEvent.pointerUp(element, {
    pointerId: opts.pointerId ?? 1,
    clientX: opts.clientX ?? 0,
    clientY: opts.clientY ?? 0,
  });
}

/** Simulate a full rightward swipe gesture. */
export function simulateSwipe(
  element: Element,
  {
    startX = 0,
    endX = 200,
    steps = 5,
  }: { startX?: number; endX?: number; steps?: number } = {}
) {
  pointerDown(element, { clientX: startX, clientY: 100 });
  const dx = (endX - startX) / steps;
  for (let i = 1; i <= steps; i++) {
    pointerMove(element, { clientX: startX + dx * i, clientY: 100 });
  }
  pointerUp(element, { clientX: endX, clientY: 100 });
}
