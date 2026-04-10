"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb, Zap, Sparkles, LayoutList } from "lucide-react";

const features = [
  { icon: Zap, text: "Works where you work — connect via MCP to Claude Code, Cursor, Windsurf, or any MCP-compatible client" },
  { icon: Sparkles, text: "Refine with AI — ask your AI to push ideas further, find gaps, and rank them by potential" },
  { icon: LayoutList, text: "Track what matters — raw → in-progress → developed" },
];

export default function LoginPage() {
  const { user, loading, signInWithGoogle } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push("/ideas");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-4 bg-gradient-to-b from-background via-background to-primary/5">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 transition-transform duration-300 hover:scale-105">
            <Lightbulb className="h-7 w-7 text-primary" />
          </div>
          <div className="text-sm font-medium text-muted-foreground mb-1.5">
            Mindraft
          </div>
          <CardTitle className="text-3xl font-semibold tracking-tight">
            Develop ideas inside your AI tools.
          </CardTitle>
          <CardDescription className="text-base mt-2">
            Mindraft connects to your AI environment via MCP. Capture, refine, and track ideas without switching context.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Button
            onClick={signInWithGoogle}
            className="w-full"
            size="lg"
          >
            Continue with Google
          </Button>
          <ul className="space-y-3">
            {features.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm text-foreground/80">{text}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground text-center">
            Free to start. No ads. Built for developers.{" "}
            <Link
              href="/privacy"
              className="underline underline-offset-4 hover:text-foreground"
            >
              Privacy Policy
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
