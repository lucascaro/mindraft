"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { addIdea } from "@/lib/firestore";
import { useCrypto } from "@/lib/crypto-context";

export function QuickCapture({ userId }: { userId: string }) {
  const { mk } = useCrypto();
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;

    setSubmitting(true);
    try {
      await addIdea(userId, trimmed, "", mk);
      setTitle("");
    } catch (err) {
      console.error("Failed to add idea:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <div className="flex-1 min-w-0">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What's on your mind?"
          aria-label="Capture new idea"
          disabled={submitting}
        />
      </div>
      <Button type="submit" size="icon" aria-label="Save idea" disabled={submitting || !title.trim()}>
        <Plus className="h-4 w-4" />
      </Button>
    </form>
  );
}
