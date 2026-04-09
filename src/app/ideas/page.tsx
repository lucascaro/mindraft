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
  const [spinCount, setSpinCount] = useState(0);

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
    <div
      className="mx-auto max-w-2xl"
      style={{
        width: "100%",
        maxWidth: 672,
        marginInline: "auto",
        paddingInline: 16,
        paddingBlock: 24,
        boxSizing: "border-box",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
          height: 40,
        }}
      >
        <button
          type="button"
          className="cursor-pointer select-none"
          onClick={() => setSpinCount((c) => c + 1)}
          aria-label="Spin the lightbulb"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "transparent",
            border: 0,
            padding: 0,
            margin: 0,
            textAlign: "left",
            perspective: 600,
          }}
        >
          <Lightbulb
            className="text-primary transition-transform duration-700 ease-in-out"
            style={{
              width: 24,
              height: 24,
              flexShrink: 0,
              transform: `rotateY(${spinCount * 360}deg)`,
            }}
          />
          <h1
            className="font-bold"
            style={{ margin: 0, fontSize: "1.25rem", lineHeight: 1 }}
          >
            Mindraft
          </h1>
        </button>
        <div
          className="transition-opacity duration-200"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            width: 140,
            justifyContent: "flex-end",
            flexShrink: 0,
            opacity: user ? 1 : 0,
            pointerEvents: user ? "auto" : "none",
          }}
        >
          <Link href="/ideas/archive">
            <Button variant="ghost" size="icon" aria-label="Archive">
              <Archive className="h-4 w-4" />
            </Button>
          </Link>
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div
        className="transition-opacity duration-200"
        style={{
          marginBottom: 24,
          height: 40,
          opacity: user ? 1 : 0,
          pointerEvents: user ? "auto" : "none",
        }}
      >
        <QuickCapture userId={user?.uid ?? ""} />
      </div>

      <div style={{ minHeight: 200 }}>
        {showSkeleton ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="rounded-lg border bg-card animate-pulse"
                style={{ height: 96, opacity: 0.4 - i * 0.1 }}
              />
            ))}
          </div>
        ) : ideas.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Lightbulb className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No ideas yet. Capture your first one above!</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
