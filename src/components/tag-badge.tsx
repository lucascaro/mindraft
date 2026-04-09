"use client";

import { useEffect, useRef, useState } from "react";
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
  const pickerRef = useRef<HTMLDivElement>(null);

  const colorClasses = getColorClasses(tag);
  const activeKey = getColorKey(tag);
  const swatchColor = getSwatchColor(tag);

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

  return (
    <span className="relative inline-flex">
      <span
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
          colorClasses,
          onClick && "cursor-pointer",
          className
        )}
      >
        {/* Color dot — opens picker in edit mode */}
        {editable && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPickerOpen((o) => !o);
            }}
            className="h-2.5 w-2.5 rounded-full shrink-0 opacity-60 hover:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            style={{ backgroundColor: swatchColor }}
            aria-label={`Change color for #${tag}`}
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
          className="absolute top-full left-0 mt-1.5 z-50 p-2.5 rounded-lg border shadow-lg bg-card w-max"
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
                    setPickerOpen(false);
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
