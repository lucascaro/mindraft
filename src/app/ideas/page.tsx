"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { subscribeToIdeas } from "@/lib/firestore";
import { QuickCapture } from "@/components/quick-capture";
import { IdeaCard } from "@/components/idea-card";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Archive, LogOut, Lightbulb } from "lucide-react";
import { Idea } from "@/lib/types";

export default function IdeasPage() {
  const { user, loading, signOut } = useAuth();
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
    const unsubscribe = subscribeToIdeas(user.uid, setIdeas);
    return unsubscribe;
  }, [user]);

  const showSkeleton = loading || !user || ideas === null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <header className="flex items-center justify-between mb-6 h-10">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">Mindraft</h1>
        </div>
        <div className="flex items-center gap-1 w-[120px] justify-end">
          {user && (
            <>
              <Link href="/ideas/archive">
                <Button variant="ghost" size="icon" aria-label="Archive">
                  <Archive className="h-4 w-4" />
                </Button>
              </Link>
              <ThemeToggle />
              <Button variant="ghost" size="icon" onClick={signOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </header>

      <div className="mb-6 h-10">
        {user && <QuickCapture userId={user.uid} />}
      </div>

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
            <Lightbulb className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No ideas yet. Capture your first one above!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {ideas.map((idea) => (
              <IdeaCard
                key={idea.id}
                idea={idea}
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
