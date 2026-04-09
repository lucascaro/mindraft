"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { updateIdea, deleteIdea } from "@/lib/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Trash2, X } from "lucide-react";
import { Idea, IdeaStatus, IDEA_STATUSES } from "@/lib/types";

export default function IdeaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [idea, setIdea] = useState<Idea | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [status, setStatus] = useState<IdeaStatus>("raw");

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(getDb(), "ideas", id), (snap) => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() } as Idea;
        setIdea(data);
        setTitle(data.title);
        setBody(data.body);
        setTags(data.tags);
        setStatus(data.status);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [id]);

  const save = (updates: Partial<Omit<Idea, "id" | "createdAt" | "userId">>) => {
    updateIdea(id, updates).catch((err) => console.error("Failed to save:", err));
  };

  const handleBlurSave = () => {
    save({ title, body, tags, status });
  };

  const handleDelete = async () => {
    await deleteIdea(id);
    router.push("/ideas");
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

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      addTag();
    }
  };

  const removeTag = (tag: string) => {
    const updated = tags.filter((t) => t !== tag);
    setTags(updated);
    save({ tags: updated });
  };

  if (loading || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!idea) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Idea not found</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <header className="flex items-center justify-between mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.push("/ideas")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <Button variant="ghost" size="icon" onClick={handleDelete}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </header>

      <div className="flex gap-2 mb-4">
        {IDEA_STATUSES.map((s) => (
          <Button
            key={s.value}
            variant={status === s.value ? "default" : "outline"}
            size="sm"
            className="flex-1"
            onClick={() => {
              setStatus(s.value);
              save({ status: s.value });
            }}
          >
            {s.label}
          </Button>
        ))}
      </div>

      <div className="space-y-4">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleBlurSave}
          placeholder="Idea title"
          className="text-lg font-semibold border-none shadow-none px-0 focus-visible:ring-0"
        />

        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onBlur={handleBlurSave}
          placeholder="Expand on your idea... (supports markdown)"
          className="min-h-[200px] resize-y"
        />

        <div>
          <div className="flex flex-wrap gap-2 mb-2">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1 py-1 px-2.5 text-sm">
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
              onKeyDown={handleAddTag}
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
      </div>
    </div>
  );
}
