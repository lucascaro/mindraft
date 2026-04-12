"use client";

import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TagBadge } from "@/components/tag-badge";
import { Archive, ArchiveRestore, Crosshair, Lock, Pencil, Plus, Trash2, X } from "lucide-react";
import { updateIdea, deleteIdea, archiveIdea, restoreIdea } from "@/lib/firestore";
import { useCrypto } from "@/lib/crypto-context";
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
  const { mk, encryptionEnabled } = useCrypto();
  const [title, setTitle] = useState(idea.title);
  const [body, setBody] = useState(idea.body);
  const [tags, setTags] = useState(idea.tags);
  const [status, setStatus] = useState<IdeaStatus>(idea.status);
  const [tagInput, setTagInput] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingClose, setConfirmingClose] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [refineNext, setRefineNext] = useState(idea.refineNext ?? false);
  const editRef = useRef<HTMLDivElement>(null);
  const [editHeight, setEditHeight] = useState(0);
  const wasExpanded = useRef(expanded);

  const save = useCallback(
    (updates: Partial<Omit<Idea, "id" | "createdAt" | "userId">>) =>
      updateIdea(idea.id, updates, { mk, currentIdea: idea }).catch((err) => {
        console.error("Failed to save:", err);
      }),
    [idea, mk]
  );

  const tagsChanged = useCallback(
    (a: string[], b: string[]) => a.length !== b.length || a.some((t, i) => t !== b[i]),
    []
  );

  const collectChanges = useCallback((): Partial<Omit<Idea, "id" | "createdAt" | "userId">> => {
    const changes: Partial<Omit<Idea, "id" | "createdAt" | "userId">> = {};
    if (title !== idea.title) changes.title = title;
    if (body !== idea.body) changes.body = body;
    if (status !== idea.status) changes.status = status;
    if ((refineNext ?? false) !== (idea.refineNext ?? false)) {
      changes.refineNext = refineNext;
      if (refineNext) changes.sortOrder = -1;
    }
    if (tagsChanged(tags, idea.tags)) changes.tags = tags;
    return changes;
  }, [title, body, status, tags, refineNext, idea, tagsChanged]);

  const isDirty = useMemo(
    () => Object.keys(collectChanges()).length > 0,
    [collectChanges]
  );

  const resetLocalState = useCallback(() => {
    setTitle(idea.title);
    setBody(idea.body);
    setTags(idea.tags);
    setStatus(idea.status);
    setRefineNext(idea.refineNext ?? false);
  }, [idea]);

  const saveAllChanges = useCallback(() => {
    const changes = collectChanges();
    if (Object.keys(changes).length === 0) return Promise.resolve();
    return save(changes);
  }, [collectChanges, save]);

  // On external collapse (expanded → false), reset local state without saving.
  useEffect(() => {
    if (wasExpanded.current && !expanded) {
      resetLocalState();
      setConfirmingDelete(false);
      setConfirmingClose(false);
      setEditMode(false);
    }
    wasExpanded.current = expanded;
  }, [expanded, resetLocalState]);

  // When NOT expanded, keep local state in sync with the Firestore document.
  useEffect(() => {
    if (!expanded) {
      setTitle(idea.title);
      setBody(idea.body);
      setTags(idea.tags);
      setStatus(idea.status);
      setRefineNext(idea.refineNext ?? false);
    }
  }, [idea, expanded]);

  // Cmd+Enter (or Ctrl+Enter): save & exit edit mode if editing, else close.
  useEffect(() => {
    if (!expanded) return;
    const handler = async (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (editMode) {
          if (isDirty) await saveAllChanges();
          setEditMode(false);
        } else {
          onCollapse();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [expanded, editMode, isDirty, saveAllChanges, onCollapse]);

  const measure = useCallback(() => {
    if (editRef.current) {
      setEditHeight(editRef.current.scrollHeight);
    }
  }, []);

  useEffect(() => {
    measure();
  }, [expanded, editMode, tags, confirmingDelete, confirmingClose, measure]);

  const handleClose = () => {
    if (editMode && isDirty) {
      setConfirmingClose(true);
      setConfirmingDelete(false);
      return;
    }
    setEditMode(false);
    onCollapse();
  };

  const addTag = () => {
    const newTag = tagInput.trim().toLowerCase();
    if (newTag && !tags.includes(newTag)) {
      setTags([...tags, newTag]);
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
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
          <div className="flex-1 min-w-0 flex items-center gap-1.5">
            {encryptionEnabled && (
              <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" aria-hidden="true" />
            )}
            <Input
              value={expanded ? title : idea.title}
              onChange={(e) => setTitle(e.target.value)}
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
                    }, { mk, currentIdea: idea });
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
              {mode === "active" && (
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
              )}
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
                aria-label="Close idea"
                title="Close"
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
                  ) : confirmingDelete ? (
                    <div role="alertdialog" aria-label="Confirm delete" className="flex gap-2 items-center w-full justify-between">
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

            {/* Edit mode content — active ideas only */}
            {editMode && mode === "active" && (
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
                      }}
                    >
                      {s.label}
                    </Button>
                  ))}
                  <Button
                    variant={refineNext ? "default" : "outline"}
                    size="sm"
                    title={refineNext ? "Remove from refinement queue" : "Mark for refinement"}
                    className={`h-8 text-xs transition-colors duration-200 ${
                      refineNext ? "bg-orange-500 hover:bg-orange-600 text-white border-orange-500" : ""
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setRefineNext(!refineNext);
                    }}
                  >
                    <Crosshair className="h-3.5 w-3.5 mr-1" />
                    Refine
                  </Button>
                </div>

                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
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
                  {confirmingClose ? (
                    <div role="alertdialog" aria-label="Unsaved changes" className="flex gap-2 items-center w-full justify-between">
                      <span className="text-sm text-muted-foreground">
                        Unsaved changes
                      </span>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmingClose(false);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Collapse effect will reset local state on its own.
                            setConfirmingClose(false);
                            setEditMode(false);
                            onCollapse();
                          }}
                        >
                          Discard
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={async (e) => {
                            e.stopPropagation();
                            await saveAllChanges();
                            setConfirmingClose(false);
                            setEditMode(false);
                            onCollapse();
                          }}
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : confirmingDelete ? (
                    <div role="alertdialog" aria-label="Confirm delete" className="flex gap-2 items-center w-full justify-between">
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
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async (e) => {
                            e.stopPropagation();
                            // Persist pending edits before archiving to avoid a write race.
                            if (isDirty) await saveAllChanges();
                            await archiveIdea(idea.id);
                          }}
                        >
                          <Archive className="h-4 w-4 mr-1" /> Archive
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmingDelete(true);
                            setConfirmingClose(false);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-1" /> Delete
                        </Button>
                      </div>
                      <Button
                        variant="default"
                        size="sm"
                        disabled={!isDirty}
                        onClick={async (e) => {
                          e.stopPropagation();
                          await saveAllChanges();
                          setEditMode(false);
                        }}
                      >
                        Save
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
