"use client";

import { useMemo, useState } from "react";
import { Idea, IdeaStatus } from "@/lib/types";

export type FilterState = {
  search: string;
  status: "all" | IdeaStatus;
  tags: string[];
};

const DEFAULT_FILTERS: FilterState = {
  search: "",
  status: "all",
  tags: [],
};

export function useIdeaFilter(ideas: Idea[]) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const idea of ideas) {
      for (const tag of idea.tags) {
        tagSet.add(tag);
      }
    }
    return Array.from(tagSet).sort();
  }, [ideas]);

  const filteredIdeas = useMemo(() => {
    return ideas.filter((idea) => {
      if (filters.status !== "all" && idea.status !== filters.status) {
        return false;
      }
      if (
        filters.tags.length > 0 &&
        !filters.tags.every((t) => idea.tags.includes(t))
      ) {
        return false;
      }
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (
          !idea.title.toLowerCase().includes(q) &&
          !idea.body.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [ideas, filters]);

  const isActive =
    filters.search !== "" ||
    filters.status !== "all" ||
    filters.tags.length > 0;

  function setSearch(search: string) {
    setFilters((f) => ({ ...f, search }));
  }

  function setStatus(status: FilterState["status"]) {
    setFilters((f) => ({ ...f, status }));
  }

  function toggleTag(tag: string) {
    setFilters((f) => ({
      ...f,
      tags: f.tags.includes(tag)
        ? f.tags.filter((t) => t !== tag)
        : [...f.tags, tag],
    }));
  }

  function clearAll() {
    setFilters(DEFAULT_FILTERS);
  }

  return {
    filters,
    setSearch,
    setStatus,
    toggleTag,
    clearAll,
    isActive,
    availableTags,
    filteredIdeas,
  };
}
