"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { IdeaCard } from "./idea-card";
import { SwipeToArchive } from "./swipe-to-archive";
import { archiveIdea } from "@/lib/firestore";
import { Idea } from "@/lib/types";

export function SortableIdeaCard({
  idea,
  expanded,
  onExpand,
  onCollapse,
}: {
  idea: Idea;
  expanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: idea.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li ref={setNodeRef} style={style}>
      <div className="relative">
        {!expanded && (
          <button
            type="button"
            className="absolute left-1.5 top-0 bottom-0 z-10 flex items-center text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing touch-none"
            aria-label="Drag to reorder"
            title="Drag to reorder"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <SwipeToArchive
          enabled={!expanded}
          onArchive={() => archiveIdea(idea.id)}
        >
          <IdeaCard
            idea={idea}
            expanded={expanded}
            onExpand={onExpand}
            onCollapse={onCollapse}
          />
        </SwipeToArchive>
      </div>
    </li>
  );
}
