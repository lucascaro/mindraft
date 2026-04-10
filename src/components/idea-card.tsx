"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TagBadge } from "@/components/tag-badge";
import { Archive, ArchiveRestore, Crosshair, Pencil, Plus, Trash2, X } from "lucide-react";
import { updateIdea, deleteIdea, archiveIdea, restoreIdea } from "@/lib/firestore";
import { Idea, IdeaStatus, IDEA_STATUSES } from "@/lib/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
  const [editMode, setEditMode] = useState(false);
  const editRef = useRef<HTMLDivElement>(null);
  const [editHeight, setEditHeight] = useState(0);
  const wasExpanded = useRef(expanded);

  // Keep refs to the latest edit values so the save-on-collapse
  // effect sees fresh values without depending on them.
  const latestRef = useRef({ title, body, status });
  latestRef.current = { title, body, status };

  const save = (updates: Partial<Omit<Idea, "id" | "createdAt" | "userId">>) => {
    updateIdea(idea.id, updates).catch((err) =>
      console.error("Failed to save:", err)
    );
  };

  // Fire save ONLY on the transition from expanded → collapsed.
  useEffect(() => {
    if (wasExpanded.current && !expanded) {
      const { title: t, body: b, status: s } = latestRef.current;
      const changes: Partial<Omit<Idea, "id" | "createdAt" | "userId">> = {};
      if (t !== idea.title) changes.title = t;
      if (b !== idea.body) changes.body = b;
      if (s !== idea.status) changes.status = s;
      if (Object.keys(changes).length > 0) save(changes);
      setConfirmingDelete(false);
      setEditMode(false);
    }
    wasExpanded.current = expanded;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  // When NOT in edit mode, keep local state in sync with the
  // Firestore document. This runs whenever idea changes (from
  // subscription) or when the card first renders.
  useEffect(() => {
    if (!expanded) {
      setTitle(idea.title);
      setBody(idea.body);
      setTags(idea.tags);
      setStatus(idea.status);
    }
  }, [idea, expanded]);

  // Cmd+Enter (or Ctrl+Enter): exit edit mode if editing, else close the card.
  useEffect(() => {
    if (!expanded) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (editMode) {
          setEditMode(false);
        } else {
          onCollapse();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [expanded, editMode, onCollapse]);

  const measure = useCallback(() => {
    if (editRef.current) {
      setEditHeight(editRef.current.scrollHeight);
    }
  }, []);

  useEffect(() => {
    measure();
  }, [expanded, editMode, tags, confirmingDelete, measure]);

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
      role={expanded ? undefined : "button"}
      tabIndex={expanded ? undefined : 0}
      aria-expanded={expanded}
      aria-label={expanded ? undefined : idea.title}
      onKeyDown={
        expanded
          ? undefined
          : (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onExpand();
              }
            }
      }
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          {/* Title: always an input with stable width */}
          <div className="flex-1 min-w-0">
            <Input
              value={expanded ? title : idea.title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => {
                if (expanded && editMode && title !== idea.title) save({ title });
              }}
              readOnly={!expanded || !editMode}
              tabIndex={expanded && editMode ? 0 : -1}
              aria-label="Idea title"
              className="w-full text-base font-semibold border-none shadow-none px-0 focus-visible:ring-0 h-auto py-0 cursor-inherit bg-transparent"
              style={{ pointerEvents: expanded && editMode ? "auto" : "none" }}
              onClick={(e) => {
                if (expanded) e.stopPropagation();
              }}
            />
          </div>

          {/* Right side: fixed width so title has stable width across cards */}
          <div className="relative shrink-0 w-[120px] h-8 flex items-center justify-end">
            {/* Status badge + refine toggle — visible when collapsed */}
            <div
              className="absolute right-0 flex items-center gap-1 transition-opacity duration-200"
              style={{ opacity: expanded ? 0 : 1, pointerEvents: expanded ? "none" : "auto" }}
            >
              {mode === "active" && (
                <button
                  type="button"
                  aria-label={idea.refineNext ? "Remove from refinement queue" : "Mark for refinement"}
                  title={idea.refineNext ? "Remove from refinement queue" : "Mark for refinement"}
                  className={`p-0.5 rounded transition-colors cursor-pointer ${
                    idea.refineNext
                      ? "text-orange-500 dark:text-orange-400"
                      : "text-muted-foreground/30 hover:text-muted-foreground/60"
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    updateIdea(idea.id, {
                      refineNext: !idea.refineNext,
                      ...(!idea.refineNext && { sortOrder: -1 }),
                    });
                  }}
                >
                  <Crosshair className="h-4 w-4" />
                </button>
              )}
              <Badge
                variant="outline"
                className={statusColors[idea.status] ?? ""}
              >
                {idea.status}
              </Badge>
            </div>

            {/* View mode buttons: Edit + Close — visible when expanded and not editing */}
            <div
              className="absolute right-0 flex gap-1 transition-opacity duration-200"
              style={{ opacity: expanded && !editMode ? 1 : 0, pointerEvents: expanded && !editMode ? "auto" : "none" }}
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="Edit idea"
                title="Edit idea"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditMode(true);
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="Close idea"
                title="Close idea"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClose();
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Edit mode buttons: Close — visible when expanded and editing */}
            <div
              className="absolute right-0 flex gap-1 transition-opacity duration-200"
              style={{ opacity: expanded && editMode ? 1 : 0, pointerEvents: expanded && editMode ? "auto" : "none" }}
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="Done editing"
                title="Done editing"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditMode(false);
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
            <div className="text-sm text-muted-foreground line-clamp-2 mb-2 [&_strong]:font-semibold [&_em]:italic [&_code]:font-mono [&_code]:bg-muted [&_code]:px-1 [&_code]:rounded [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {idea.body}
              </ReactMarkdown>
            </div>
          )}
          {idea.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {idea.tags.map((tag) => (
                <TagBadge key={tag} tag={tag} />
              ))}
            </div>
          )}
        </CardContent>
      </div>

      {/* Expanded area — view or edit mode */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: expanded ? editHeight : 0,
          opacity: expanded ? 1 : 0,
        }}
      >
        <div ref={editRef}>
          <CardContent className="space-y-3 pt-0">
            {/* View mode content */}
            {!editMode && (
              <>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={statusColors[idea.status] ?? ""}
                  >
                    {idea.status}
                  </Badge>
                  {idea.refineNext && (
                    <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-800">
                      <Crosshair className="h-3 w-3 mr-1" />
                      refine next
                    </Badge>
                  )}
                </div>

                {idea.body ? (
                  <div className="markdown-body">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {idea.body}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No description yet.</p>
                )}

                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {tags.map((tag) => (
                      <TagBadge key={tag} tag={tag} />
                    ))}
                  </div>
                )}

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
                  ) : (
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
                  )}
                </div>
              </>
            )}

            {/* Edit mode content */}
            {editMode && (
              <>
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
                  <Button
                    variant={idea.refineNext ? "default" : "outline"}
                    size="sm"
                    title={idea.refineNext ? "Remove from refinement queue" : "Mark for refinement"}
                    className={`h-8 text-xs transition-colors duration-200 ${
                      idea.refineNext ? "bg-orange-500 hover:bg-orange-600 text-white border-orange-500" : ""
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      save({
                        refineNext: !idea.refineNext,
                        ...(!idea.refineNext && { sortOrder: -1 }),
                      });
                    }}
                  >
                    <Crosshair className="h-3.5 w-3.5 mr-1" />
                    Refine
                  </Button>
                </div>

                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onBlur={() => {
                    if (body !== idea.body) save({ body });
                  }}
                  placeholder="Expand on your idea..."
                  aria-label="Idea body"
                  className="min-h-[100px] resize-y text-sm"
                  onClick={(e) => e.stopPropagation()}
                />

                <div>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {tags.map((tag) => (
                      <TagBadge
                        key={tag}
                        tag={tag}
                        editable
                        onRemove={() => removeTag(tag)}
                      />
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
                      aria-label="New tag name"
                      className="text-sm flex-1"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      aria-label="Add tag"
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
              </>
            )}
          </CardContent>
        </div>
      </div>
    </Card>
  );
}
