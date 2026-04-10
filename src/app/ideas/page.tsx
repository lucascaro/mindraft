"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { subscribeToIdeas } from "@/lib/firestore";
import { useIdeaFilter } from "@/lib/use-idea-filter";
import { QuickCapture } from "@/components/quick-capture";
import { SortableIdeaList } from "@/components/sortable-idea-list";
import { IdeaFilterBar } from "@/components/idea-filter-bar";
import { ActiveFilterStrip } from "@/components/active-filter-strip";
import { IdeaStatsLine } from "@/components/idea-stats-line";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Archive, LogOut, Lightbulb, Settings, SlidersHorizontal, Search } from "lucide-react";
import { Idea } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function IdeasPage() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [ideas, setIdeas] = useState<Idea[] | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [spinCount, setSpinCount] = useState(0);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const {
    filters,
    setSearch,
    setStatus,
    toggleTag,
    clearAll,
    isActive,
    availableTags,
    filteredIdeas,
  } = useIdeaFilter(ideas ?? []);

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
    <main
      id="main-content"
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
            width: 176,
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
          <Link href="/settings">
            <Button variant="ghost" size="icon" aria-label="Settings">
              <Settings className="h-4 w-4" />
            </Button>
          </Link>
          <button
            onClick={() => setIsFilterOpen((o) => !o)}
            aria-label={isFilterOpen ? "Close filters" : "Open filters"}
            aria-expanded={isFilterOpen}
            className={cn(
              "relative inline-flex items-center justify-center h-9 w-9 rounded-md transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              isFilterOpen && "bg-accent text-accent-foreground"
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {isActive && !isFilterOpen && (
              <span
                className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary"
                aria-hidden="true"
              />
            )}
          </button>
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <IdeaFilterBar
        isOpen={isFilterOpen}
        filters={filters}
        availableTags={availableTags}
        onSearchChange={setSearch}
        onStatusChange={setStatus}
        onTagToggle={toggleTag}
      />

      {isActive && (
        <ActiveFilterStrip
          filters={filters}
          totalCount={(ideas ?? []).length}
          filteredCount={filteredIdeas.length}
          onRemoveSearch={() => setSearch("")}
          onRemoveStatus={() => setStatus("all")}
          onRemoveTag={(tag) => toggleTag(tag)}
          onClearAll={clearAll}
        />
      )}

      <div
        className="transition-opacity duration-200"
        style={{
          marginBottom: 8,
          height: 40,
          opacity: user ? 1 : 0,
          pointerEvents: user ? "auto" : "none",
        }}
      >
        <QuickCapture userId={user?.uid ?? ""} />
      </div>

      {!showSkeleton && <IdeaStatsLine ideas={filteredIdeas} />}

      <div style={{ minHeight: 200, marginTop: 8 }}>
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
            <Lightbulb aria-hidden="true" className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No ideas yet. Capture your first one above!</p>
          </div>
        ) : filteredIdeas.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Search aria-hidden="true" className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="mb-4">No ideas match your filters.</p>
            <button
              onClick={clearAll}
              className="text-sm text-primary hover:underline"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <SortableIdeaList
            ideas={filteredIdeas}
            expandedId={expandedId}
            onExpand={(id) => setExpandedId(id)}
            onCollapse={() => setExpandedId(null)}
            reorderEnabled={!isActive}
          />
        )}
      </div>
    </main>
  );
}
