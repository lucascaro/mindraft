"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { FilterState } from "@/lib/use-idea-filter";
import { TagBadge } from "@/components/tag-badge";

type Props = {
  filters: FilterState;
  totalCount: number;
  filteredCount: number;
  onRemoveSearch: () => void;
  onRemoveStatus: () => void;
  onRemoveTag: (tag: string) => void;
  onClearAll: () => void;
};

export function ActiveFilterStrip({
  filters,
  totalCount,
  filteredCount,
  onRemoveSearch,
  onRemoveStatus,
  onRemoveTag,
  onClearAll,
}: Props) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-1.5 flex-wrap">
        {filters.search && (
          <FilterChip label={`"${filters.search}"`} onRemove={onRemoveSearch} />
        )}
        {filters.status !== "all" && (
          <FilterChip
            label={
              filters.status.charAt(0).toUpperCase() + filters.status.slice(1)
            }
            onRemove={onRemoveStatus}
          />
        )}
        {filters.tags.map((tag) => (
          <TagBadge key={tag} tag={tag} onRemove={() => onRemoveTag(tag)} />
        ))}
        <button
          onClick={onClearAll}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-1"
        >
          Clear all
        </button>
      </div>
      {filteredCount !== totalCount && (
        <p className="text-xs text-muted-foreground mt-1.5">
          Showing {filteredCount} of {totalCount} idea
          {totalCount !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}

function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary">
      {label}
      <button
        onClick={onRemove}
        aria-label={`Remove filter ${label}`}
        className={cn(
          "inline-flex items-center justify-center rounded-full",
          "hover:bg-primary/20 transition-colors",
          "-mr-0.5 h-3.5 w-3.5"
        )}
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </span>
  );
}
