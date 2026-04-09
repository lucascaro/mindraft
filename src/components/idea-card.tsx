"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Idea } from "@/lib/types";

const statusColors: Record<string, string> = {
  raw: "bg-yellow-100 text-yellow-800 border-yellow-200",
  refining: "bg-blue-100 text-blue-800 border-blue-200",
  developed: "bg-green-100 text-green-800 border-green-200",
};

export function IdeaCard({ idea }: { idea: Idea }) {
  return (
    <Link href={`/ideas/${idea.id}`}>
      <Card className="transition-shadow hover:shadow-md cursor-pointer">
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
    </Link>
  );
}
