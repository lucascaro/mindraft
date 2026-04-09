"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Archive, ArchiveRestore, Plus, Trash2, X } from "lucide-react";
import { updateIdea, deleteIdea, archiveIdea, restoreIdea } from "@/lib/firestore";
import { Idea, IdeaStatus, IDEA_STATUSES } from "@/lib/types";

const statusColors: Record<string, string> = {
  raw: "bg-yellow-100 text-yellow-800 border-yellow-200",
  "in-progress": "bg-blue-100 text-blue-800 border-blue-200",
  developed: "bg-green-100 text-green-800 border-green-200",
};

export function IdeaCard({
  idea,
  mode = "active",
  expanded,
  onExpand,
  onCollapse,
}: {
  idea: Idea;
  mode?: "active" | "archived";
  expanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
}) {
  const [title, setTitle] = useState(idea.title);
  const [body, setBody] = useState(idea.body);
  const [tags, setTags] = useState(idea.tags);
  const [status, setStatus] = useState<IdeaStatus>(idea.status);
  const [tagInput, setTagInput] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const editRef = useRef<HTMLDivElement>(null);
  const [editHeight, setEditHeight] = useState(0);

  // When this card collapses (either by user or by another card opening),
  // flush pending edits to Firestore and reset to the server state.
  useEffect(() => {
    if (!expanded) {
      const changes: Partial<Omit<Idea, "id" | "createdAt" | "userId">> = {};
      if (title !== idea.title) changes.title = title;
      if (body !== idea.body) changes.body = body;
      if (status !== idea.status) changes.status = status;
      if (Object.keys(changes).length > 0) save(changes);

      setTitle(idea.title);
      setBody(idea.body);
      setTags(idea.tags);
      setStatus(idea.status);
      setConfirmingDelete(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, idea]);

  const measure = useCallback(() => {
    if (editRef.current) {
      setEditHeight(editRef.current.scrollHeight);
    }
  }, []);

  useEffect(() => {
    measure();
  }, [expanded, tags, confirmingDelete, measure]);

  const save = (updates: Partial<Omit<Idea, "id" | "createdAt" | "userId">>) => {
    updateIdea(idea.id, updates).catch((err) =>
      console.error("Failed to save:", err)
    );
  };

  const handleClose = () => {
    onCollapse();
  };

  const addTag = () => {
    const newTag = tagInput.trim().toLowerCase();
    if (newTag && !tags.includes(newTag)) {
      const updated = [...tags, newTag];
      setTags(updated);
      save({ tags: updated });
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    const updated = tags.filter((t) => t !== tag);
    setTags(updated);
    save({ tags: updated });
  };

  return (
    <Card
      className={`transition-all duration-300 ease-in-out ${
        expanded
          ? "shadow-md border-primary/30"
          : "hover:shadow-md cursor-pointer"
      }`}
      onClick={expanded ? undefined : onExpand}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          {/* Title: always an input with stable width */}
          <div className="flex-1 min-w-0">
            <Input
              value={expanded ? title : idea.title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => {
                if (expanded && title !== idea.title) save({ title });
              }}
              readOnly={!expanded}
              tabIndex={expanded ? 0 : -1}
              className="w-full text-base font-semibold border-none shadow-none px-0 focus-visible:ring-0 h-auto py-0 cursor-inherit bg-transparent"
              style={{ pointerEvents: expanded ? "auto" : "none" }}
              onClick={(e) => {
                if (expanded) e.stopPropagation();
              }}
            />
          </div>

          {/* Right side: fixed width so title has stable width across cards */}
          <div className="relative shrink-0 w-[96px] h-8 flex items-center justify-end">
            {/* Status badge — visible when collapsed */}
            <div
              className="absolute right-0 transition-opacity duration-200"
              style={{ opacity: expanded ? 0 : 1, pointerEvents: expanded ? "none" : "auto" }}
            >
              <Badge
                variant="outline"
                className={statusColors[idea.status] ?? ""}
              >
                {idea.status}
              </Badge>
            </div>

            {/* Close button — visible when expanded */}
            <div
              className="absolute right-0 flex gap-1 transition-opacity duration-200"
              style={{ opacity: expanded ? 1 : 0, pointerEvents: expanded ? "auto" : "none" }}
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClose();
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>

      {/* Preview: body + tags — collapses when editing */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: expanded ? 0 : 200,
          opacity: expanded ? 0 : 1,
        }}
      >
        <CardContent>
          {idea.body && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
              {idea.body}
            </p>
          )}
          {idea.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {idea.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </div>

      {/* Edit area — expands when editing */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: expanded ? editHeight : 0,
          opacity: expanded ? 1 : 0,
        }}
      >
        <div ref={editRef}>
          <CardContent className="space-y-3 pt-0">
            <div className="flex gap-1.5">
              {IDEA_STATUSES.map((s) => (
                <Button
                  key={s.value}
                  variant={status === s.value ? "default" : "outline"}
                  size="sm"
                  className="flex-1 h-8 text-xs transition-colors duration-200"
                  onClick={(e) => {
                    e.stopPropagation();
                    setStatus(s.value);
                    save({ status: s.value });
                  }}
                >
                  {s.label}
                </Button>
              ))}
            </div>

            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onBlur={() => {
                if (body !== idea.body) save({ body });
              }}
              placeholder="Expand on your idea..."
              className="min-h-[100px] resize-y text-sm"
              onClick={(e) => e.stopPropagation()}
            />

            <div>
              <div className="flex flex-wrap gap-2 mb-2">
                {tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="gap-1 py-1 px-2.5 text-sm"
                  >
                    {tag}
                    <button
                      className="ml-1 p-0.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeTag(tag);
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && tagInput.trim()) {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  placeholder="Add a tag"
                  className="text-sm flex-1"
                  onClick={(e) => e.stopPropagation()}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    addTag();
                  }}
                  disabled={!tagInput.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="pt-2 border-t flex justify-between items-center gap-2">
              {mode === "active" ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async (e) => {
                    e.stopPropagation();
                    await archiveIdea(idea.id);
                  }}
                >
                  <Archive className="h-4 w-4 mr-1" /> Archive
                </Button>
              ) : confirmingDelete ? (
                <div className="flex gap-2 items-center w-full justify-between">
                  <span className="text-sm text-muted-foreground">
                    Delete permanently?
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmingDelete(false);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={async (e) => {
                        e.stopPropagation();
                        await deleteIdea(idea.id);
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 w-full justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async (e) => {
                      e.stopPropagation();
                      await restoreIdea(idea.id);
                    }}
                  >
                    <ArchiveRestore className="h-4 w-4 mr-1" /> Restore
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmingDelete(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Delete
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </div>
      </div>
    </Card>
  );
}
