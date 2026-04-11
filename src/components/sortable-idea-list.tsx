"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { IdeaCard } from "./idea-card";
import { SortableIdeaCard } from "./sortable-idea-card";
import { SwipeToArchive } from "./swipe-to-archive";
import { reorderIdeas, archiveIdea } from "@/lib/firestore";
import { Idea } from "@/lib/types";

export function SortableIdeaList({
  ideas,
  expandedId,
  onExpand,
  onCollapse,
  reorderEnabled,
}: {
  ideas: Idea[];
  expandedId: string | null;
  onExpand: (id: string) => void;
  onCollapse: () => void;
  reorderEnabled: boolean;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = ideas.findIndex((i) => i.id === active.id);
    const newIndex = ideas.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...ideas];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    // Only assign sortOrder to non-refineNext items so we don't
    // destroy their -1 sortOrder when the user reorders.
    const nonRefine = reordered.filter((i) => !i.refineNext);
    const updates = nonRefine.map((idea, index) => ({
      id: idea.id,
      sortOrder: index + 1,
    }));

    await reorderIdeas(updates);
  }

  if (!reorderEnabled) {
    return (
      <ul
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          listStyle: "none",
          padding: 0,
          margin: 0,
        }}
      >
        {ideas.map((idea) => (
          <li key={idea.id}>
            <SwipeToArchive
              enabled={expandedId !== idea.id}
              onArchive={() => archiveIdea(idea.id)}
            >
              <IdeaCard
                idea={idea}
                expanded={expandedId === idea.id}
                onExpand={() => onExpand(idea.id)}
                onCollapse={onCollapse}
              />
            </SwipeToArchive>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={ideas.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            listStyle: "none",
            padding: 0,
            margin: 0,
          }}
        >
          {ideas.map((idea) => (
            <SortableIdeaCard
              key={idea.id}
              idea={idea}
              expanded={expandedId === idea.id}
              onExpand={() => onExpand(idea.id)}
              onCollapse={onCollapse}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
