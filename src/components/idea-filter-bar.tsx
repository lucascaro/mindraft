"use client";

import { Search, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { FilterState } from "@/lib/use-idea-filter";
import { useTagColors } from "@/lib/tag-color-context";

type Props = {
  isOpen: boolean;
  filters: FilterState;
  availableTags: string[];
  onSearchChange: (s: string) => void;
  onStatusChange: (s: FilterState["status"]) => void;
  onTagToggle: (tag: string) => void;
};

const STATUS_OPTIONS: { value: FilterState["status"]; label: string }[] = [
  { value: "all", label: "All" },
  { value: "raw", label: "Raw" },
  { value: "developed", label: "Developed" },
];

export function IdeaFilterBar({
  isOpen,
  filters,
  availableTags,
  onSearchChange,
  onStatusChange,
  onTagToggle,
}: Props) {
  const { getSwatchColor } = useTagColors();
  return (
    <div
      className={cn(
        "grid transition-all duration-200 ease-in-out",
        isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
      )}
    >
      <div className="overflow-hidden">
        <div className="pb-4 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              placeholder="Search ideas…"
              value={filters.search}
              onChange={(e) => onSearchChange(e.target.value)}
              aria-label="Search ideas"
              className="pl-9"
            />
          </div>

          {/* Status pills */}
          <div className="flex gap-2" role="radiogroup" aria-label="Filter by status">
            {STATUS_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                role="radio"
                aria-checked={filters.status === value}
                onClick={() => onStatusChange(value)}
                className={cn(
                  "h-9 px-4 rounded-full text-sm font-medium border transition-colors",
                  filters.status === value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-input bg-background text-foreground hover:bg-accent"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Tag pills */}
          {availableTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by tag">
              {availableTags.map((tag) => {
                const active = filters.tags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => onTagToggle(tag)}
                    aria-pressed={active}
                    className={cn(
                      "inline-flex items-center gap-1 h-8 px-3 rounded-full text-xs font-medium border transition-colors",
                      active
                        ? "bg-primary/10 border-primary text-primary"
                        : "border-input bg-background text-foreground hover:bg-accent"
                    )}
                  >
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: getSwatchColor(tag) }}
                      aria-hidden="true"
                    />
                    {active && <Check className="h-3 w-3" />}
                    #{tag}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
