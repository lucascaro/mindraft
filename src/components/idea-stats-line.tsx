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

  return (
    <p className="text-xs text-muted-foreground mb-4">
      You have {total} idea{total !== 1 ? "s" : ""}
      {IDEA_STATUSES.map(({ value, label }) => (
        <span key={value}>
          {" · "}
          {counts[value] ?? 0} {label.toLowerCase()}
        </span>
      ))}
    </p>
  );
}
