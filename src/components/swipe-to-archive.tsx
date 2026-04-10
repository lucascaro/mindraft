"use client";

import { useRef, useCallback, type ReactNode } from "react";
import { Archive } from "lucide-react";

const DEAD_ZONE = 10;
const THRESHOLD_FRACTION = 0.4;
const MIN_THRESHOLD = 100;
const MAX_THRESHOLD = 200;
const SNAP_BACK_MS = 200;
const FLY_OUT_MS = 300;

export function SwipeToArchive({
  children,
  enabled,
  onArchive,
}: {
  children: ReactNode;
  enabled: boolean;
  onArchive: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);

  const startX = useRef(0);
  const startY = useRef(0);
  const pointerId = useRef<number | null>(null);
  const isDragging = useRef(false);
  const directionLocked = useRef(false);
  const isArchiving = useRef(false);
  const swipedRef = useRef(false);

  const getThreshold = useCallback(() => {
    if (!containerRef.current) return MIN_THRESHOLD;
    const w = containerRef.current.offsetWidth * THRESHOLD_FRACTION;
    return Math.max(MIN_THRESHOLD, Math.min(MAX_THRESHOLD, w));
  }, []);

  const applyTransform = useCallback((deltaX: number) => {
    const card = cardRef.current;
    const bg = bgRef.current;
    const icon = iconRef.current;
    if (!card || !bg || !icon) return;

    const clamped = Math.max(0, deltaX);
    card.style.transform = `translateX(${clamped}px)`;

    const threshold = getThreshold();
    const progress = Math.min(1, clamped / threshold);
    icon.style.opacity = String(0.4 + progress * 0.6);
    icon.style.transform = `scale(${0.8 + progress * 0.2})`;
    bg.style.opacity = clamped > 0 ? "1" : "0";

    if (clamped >= threshold) {
      bg.style.backgroundColor = "var(--color-orange-600, #ea580c)";
    } else {
      bg.style.backgroundColor = "var(--color-orange-500, #f97316)";
    }
  }, [getThreshold]);

  const reset = useCallback(() => {
    const card = cardRef.current;
    const bg = bgRef.current;
    if (!card || !bg) return;

    card.style.transition = `transform ${SNAP_BACK_MS}ms ease-out`;
    card.style.transform = "translateX(0)";

    const onEnd = () => {
      card.style.transition = "";
      card.style.willChange = "";
      bg.style.opacity = "0";
      card.removeEventListener("transitionend", onEnd);
    };
    card.addEventListener("transitionend", onEnd, { once: true });
    // Fallback in case transitionend doesn't fire
    setTimeout(onEnd, SNAP_BACK_MS + 50);
  }, []);

  const flyOut = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;
    isArchiving.current = true;

    card.style.transition = `transform ${FLY_OUT_MS}ms ease-out, opacity ${FLY_OUT_MS}ms ease-out`;
    card.style.transform = "translateX(100%)";
    card.style.opacity = "0";

    const onEnd = () => {
      card.removeEventListener("transitionend", onEnd);
      onArchive();
    };
    card.addEventListener("transitionend", onEnd, { once: true });
    setTimeout(onEnd, FLY_OUT_MS + 50);
  }, [onArchive]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled || isArchiving.current) return;
      // Only track primary pointer (left mouse / first touch)
      if (e.button !== 0) return;
      if (pointerId.current !== null) return;

      pointerId.current = e.pointerId;
      startX.current = e.clientX;
      startY.current = e.clientY;
      isDragging.current = false;
      directionLocked.current = false;

      const card = cardRef.current;
      if (card) {
        card.style.willChange = "transform";
      }

      containerRef.current!.setPointerCapture(e.pointerId);
    },
    [enabled]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (pointerId.current !== e.pointerId) return;

      const deltaX = e.clientX - startX.current;
      const deltaY = e.clientY - startY.current;

      if (!directionLocked.current) {
        const total = Math.abs(deltaX) + Math.abs(deltaY);
        if (total < DEAD_ZONE) return;

        directionLocked.current = true;
        if (Math.abs(deltaX) > Math.abs(deltaY) && deltaX > 0) {
          isDragging.current = true;
          swipedRef.current = true;
        } else {
          // Vertical or leftward — bail out
          pointerId.current = null;
          return;
        }
      }

      if (!isDragging.current) return;

      e.preventDefault();
      applyTransform(deltaX);
    },
    [applyTransform]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (pointerId.current !== e.pointerId) return;
      pointerId.current = null;

      if (!isDragging.current) {
        cardRef.current?.style.removeProperty("will-change");
        return;
      }

      const deltaX = e.clientX - startX.current;
      const threshold = getThreshold();

      if (deltaX >= threshold) {
        flyOut();
      } else {
        reset();
      }

      isDragging.current = false;
      directionLocked.current = false;
    },
    [getThreshold, flyOut, reset]
  );

  const handlePointerCancel = useCallback(
    (e: React.PointerEvent) => {
      if (pointerId.current !== e.pointerId) return;
      pointerId.current = null;
      isDragging.current = false;
      directionLocked.current = false;
      reset();
    },
    [reset]
  );

  const handleClickCapture = useCallback((e: React.MouseEvent) => {
    if (swipedRef.current) {
      e.stopPropagation();
      e.preventDefault();
      requestAnimationFrame(() => {
        swipedRef.current = false;
      });
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-xl"
      style={{ touchAction: "pan-y" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onClickCapture={handleClickCapture}
    >
      {/* Background: archive indicator */}
      <div
        ref={bgRef}
        className="absolute inset-0 flex items-center pl-5 rounded-xl"
        style={{ backgroundColor: "#f97316", opacity: 0 }}
      >
        <div ref={iconRef} className="flex items-center text-white" style={{ opacity: 0.4 }}>
          <Archive className="h-5 w-5" />
          <span className="ml-2 text-sm font-medium">Archive</span>
        </div>
      </div>

      {/* Foreground: the card */}
      <div ref={cardRef} className="relative bg-card rounded-xl">
        {children}
      </div>
    </div>
  );
}
