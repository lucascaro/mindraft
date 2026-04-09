"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb, Zap, PencilLine, Smartphone } from "lucide-react";

const features = [
  { icon: Zap, text: "Capture in a tap" },
  { icon: PencilLine, text: "Refine when ready" },
  { icon: Smartphone, text: "Works offline, anywhere" },
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
            Ideas, before they escape.
          </CardTitle>
          <CardDescription className="text-base mt-2">
            Quick-capture now, refine when you&apos;re back at your desk.
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
            Free. No ads. Yours alone.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
