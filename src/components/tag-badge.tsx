"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTagColors } from "@/lib/tag-color-context";
import { useTheme } from "@/lib/theme-context";
import { TAG_COLORS, type ColorKey } from "@/lib/tag-colors";

type Props = {
  tag: string;
  /** Show color-dot picker trigger and remove button. */
  editable?: boolean;
  onRemove?: () => void;
  className?: string;
  /** Called when the outer element is clicked (e.g. filter toggle). */
  onClick?: (e: React.MouseEvent) => void;
};

export function TagBadge({
  tag,
  editable = false,
  onRemove,
  className,
  onClick,
}: Props) {
  const { getColorClasses, getColorKey, setTagColor, getSwatchColor } =
    useTagColors();
  const { resolvedTheme } = useTheme();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerAlign, setPickerAlign] = useState<"left" | "right">("left");
  const pickerRef = useRef<HTMLDivElement>(null);
  const colorTriggerRef = useRef<HTMLButtonElement>(null);

  const colorClasses = getColorClasses(tag);
  const activeKey = getColorKey(tag);
  const swatchColor = getSwatchColor(tag);

  const closePicker = useCallback(() => {
    setPickerOpen(false);
    colorTriggerRef.current?.focus();
  }, []);

  // Close picker on outside click.
  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [pickerOpen]);

  // Close picker on Escape key.
  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closePicker();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [pickerOpen, closePicker]);

  // Focus active (or first) swatch when picker opens.
  useEffect(() => {
    if (!pickerOpen || !pickerRef.current) return;
    const active = pickerRef.current.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    const first = pickerRef.current.querySelector<HTMLButtonElement>("button");
    (active ?? first)?.focus();
  }, [pickerOpen]);

  // Flip popover to the left if it overflows the right edge of the viewport.
  useEffect(() => {
    if (!pickerOpen || !pickerRef.current) return;
    const rect = pickerRef.current.getBoundingClientRect();
    setPickerAlign(rect.right > window.innerWidth ? "right" : "left");
  }, [pickerOpen]);

  const badgeProps = onClick
    ? {
        role: "button" as const,
        tabIndex: 0,
        onClick,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick(e as unknown as React.MouseEvent);
          }
        },
        "aria-label": `Filter by tag ${tag}`,
      }
    : {};

  return (
    <span className="relative inline-flex">
      <span
        {...badgeProps}
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
          colorClasses,
          onClick && "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          className
        )}
      >
        {/* Color dot — opens picker in edit mode */}
        {editable && (
          <button
            ref={colorTriggerRef}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPickerOpen((o) => !o);
            }}
            className="h-2.5 w-2.5 rounded-full shrink-0 opacity-60 hover:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            style={{ backgroundColor: swatchColor }}
            aria-label={`Change color for #${tag}`}
            aria-expanded={pickerOpen}
            aria-haspopup="dialog"
          />
        )}

        {tag}

        {onRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="ml-0.5 -mr-0.5 p-0.5 rounded-full hover:opacity-70 transition-opacity"
            aria-label={`Remove tag ${tag}`}
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </span>

      {/* Color picker popover */}
      {pickerOpen && (
        <div
          ref={pickerRef}
          role="dialog"
          aria-label="Choose tag color"
          className={cn(
            "absolute top-full mt-1.5 z-50 p-2.5 rounded-lg border shadow-lg bg-card w-max",
            pickerAlign === "right" ? "right-0" : "left-0"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="grid grid-cols-5 gap-1.5">
            {TAG_COLORS.map((color) => {
              const swatch =
                resolvedTheme === "dark"
                  ? color.swatchDark
                  : color.swatchLight;
              const isActive = activeKey === color.key;
              return (
                <button
                  key={color.key}
                  type="button"
                  onClick={() => {
                    setTagColor(tag, color.key as ColorKey);
                    closePicker();
                  }}
                  className={cn(
                    "h-6 w-6 rounded-full transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isActive
                      ? "ring-2 ring-offset-1 ring-foreground scale-110"
                      : "ring-1 ring-black/10 dark:ring-white/10"
                  )}
                  style={{ backgroundColor: swatch }}
                  aria-label={color.label}
                  aria-pressed={isActive}
                  title={color.label}
                />
              );
            })}
          </div>
        </div>
      )}
    </span>
  );
}
