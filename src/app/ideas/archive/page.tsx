"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useCrypto } from "@/lib/crypto-context";
import { subscribeToIdeas } from "@/lib/firestore";
import { IdeaCard } from "@/components/idea-card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Archive } from "lucide-react";
import { Idea } from "@/lib/types";

export default function ArchivePage() {
  const { user, loading } = useAuth();
  const { mk } = useCrypto();
  const router = useRouter();
  const [ideas, setIdeas] = useState<Idea[] | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToIdeas(user.uid, setIdeas, "archived", mk);
    return unsubscribe;
  }, [user, mk]);

  const showSkeleton = loading || !user || ideas === null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <header className="flex items-center justify-between mb-6 h-10">
        <Link href="/ideas">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Archive className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-bold">Archive</h1>
        </div>
        <div className="w-[80px]" />
      </header>

      <div className="min-h-[200px]">
        {showSkeleton ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="rounded-lg border bg-card h-24 animate-pulse"
                style={{ opacity: 0.4 - i * 0.1 }}
              />
            ))}
          </div>
        ) : ideas.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Archive className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No archived ideas</p>
          </div>
        ) : (
          <div className="space-y-3">
            {ideas.map((idea) => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                mode="archived"
                expanded={expandedId === idea.id}
                onExpand={() => setExpandedId(idea.id)}
                onCollapse={() => setExpandedId(null)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
