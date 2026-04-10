"use client";

import { Idea, IDEA_STATUSES } from "@/lib/types";

type Props = {
  ideas: Idea[];
};

export function IdeaStatsLine({ ideas }: Props) {
  const total = ideas.length;
  if (total === 0) return null;

  const counts = ideas.reduce<Record<string, number>>((acc, idea) => {
    acc[idea.status] = (acc[idea.status] ?? 0) + 1;
    return acc;
  }, {});

  const refineCount = ideas.filter((i) => i.refineNext).length;

  return (
    <p className="text-xs text-muted-foreground my-1">
      {total} idea{total !== 1 ? "s" : ""}
      {IDEA_STATUSES.map(({ value, label }) => (
        <span key={value}>
          {" · "}
          {counts[value] ?? 0} {label.toLowerCase()}
        </span>
      ))}
      {refineCount > 0 && (
        <span className="text-orange-500 dark:text-orange-400">
          {" · "}
          {refineCount} queued
        </span>
      )}
    </p>
  );
}
