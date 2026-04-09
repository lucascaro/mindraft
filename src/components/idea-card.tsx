"use client";

import { useRef, useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, X } from "lucide-react";
import { updateIdea, deleteIdea } from "@/lib/firestore";
import { Idea, IdeaStatus, IDEA_STATUSES } from "@/lib/types";

const statusColors: Record<string, string> = {
  raw: "bg-yellow-100 text-yellow-800 border-yellow-200",
  "in-progress": "bg-blue-100 text-blue-800 border-blue-200",
  developed: "bg-green-100 text-green-800 border-green-200",
};

export function IdeaCard({ idea }: { idea: Idea }) {
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState(idea.title);
  const [body, setBody] = useState(idea.body);
  const [tags, setTags] = useState(idea.tags);
  const [status, setStatus] = useState<IdeaStatus>(idea.status);
  const [tagInput, setTagInput] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | undefined>();

  // Sync from Firestore updates
  useEffect(() => {
    if (!expanded) {
      setTitle(idea.title);
      setBody(idea.body);
      setTags(idea.tags);
      setStatus(idea.status);
    }
  }, [idea, expanded]);

  // Measure and animate height
  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [expanded, tags]);

  const save = (updates: Partial<Omit<Idea, "id" | "createdAt" | "userId">>) => {
    updateIdea(idea.id, updates).catch((err) =>
      console.error("Failed to save:", err)
    );
  };

  const handleClose = () => {
    save({ title, body, tags, status });
    setExpanded(false);
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

  const handleDelete = async () => {
    await deleteIdea(idea.id);
  };

  if (!expanded) {
    return (
      <Card
        className="transition-shadow hover:shadow-md cursor-pointer"
        onClick={() => setExpanded(true)}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base leading-snug">
              {idea.title}
            </CardTitle>
            <Badge
              variant="outline"
              className={statusColors[idea.status] ?? ""}
            >
              {idea.status}
            </Badge>
          </div>
        </CardHeader>
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
      </Card>
    );
  }

  return (
    <Card className="shadow-md border-primary/30">
      <div
        ref={contentRef}
        style={{ height: contentHeight }}
        className="transition-[height] duration-300 ease-in-out overflow-hidden"
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => save({ title })}
              className="text-base font-semibold border-none shadow-none px-0 focus-visible:ring-0 h-auto py-0"
              autoFocus
            />
            <div className="flex gap-1 shrink-0">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDelete}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-1.5">
            {IDEA_STATUSES.map((s) => (
              <Button
                key={s.value}
                variant={status === s.value ? "default" : "outline"}
                size="sm"
                className="flex-1 h-8 text-xs"
                onClick={() => {
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
            onBlur={() => save({ body })}
            placeholder="Expand on your idea..."
            className="min-h-[100px] resize-y text-sm"
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
                  <button className="ml-1 p-0.5" onClick={() => removeTag(tag)}>
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
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={addTag}
                disabled={!tagInput.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}
