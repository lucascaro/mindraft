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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Sparkles, Trash2, X } from "lucide-react";
import { Idea, IdeaStatus } from "@/lib/types";

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
  const [refining, setRefining] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

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
        setAiSuggestions(data.aiSuggestions);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateIdea(id, { title, body, tags, status });
    } catch (err) {
      console.error("Failed to save:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleRefine = async () => {
    setRefining(true);
    try {
      await updateIdea(id, { status: "refining" });
      setStatus("refining");

      const res = await fetch("/api/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body }),
      });

      if (!res.ok) throw new Error("Refinement failed");

      const data = await res.json();
      setAiSuggestions(data.suggestions);
      await updateIdea(id, {
        aiSuggestions: data.suggestions,
        status: "developed",
      });
      setStatus("developed");
    } catch (err) {
      console.error("Refinement failed:", err);
      await updateIdea(id, { status: "raw" });
      setStatus("raw");
    } finally {
      setRefining(false);
    }
  };

  const handleDelete = async () => {
    await deleteIdea(id);
    router.push("/ideas");
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim().toLowerCase();
      if (!tags.includes(newTag)) {
        setTags([...tags, newTag]);
      }
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
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
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefine}
            disabled={refining}
          >
            <Sparkles className="h-4 w-4 mr-1" />
            {refining ? "Refining..." : "AI Refine"}
          </Button>
          <Button variant="ghost" size="icon" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </header>

      <div className="space-y-4">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Idea title"
          className="text-lg font-semibold border-none shadow-none px-0 focus-visible:ring-0"
        />

        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Expand on your idea... (supports markdown)"
          className="min-h-[200px] resize-y"
        />

        <div>
          <div className="flex flex-wrap gap-1 mb-2">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1">
                {tag}
                <button onClick={() => removeTag(tag)}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleAddTag}
            placeholder="Add a tag and press Enter"
            className="text-sm"
          />
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? "Saving..." : "Save Changes"}
        </Button>

        {aiSuggestions && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> AI Suggestions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none text-muted-foreground whitespace-pre-wrap">
                {aiSuggestions}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
