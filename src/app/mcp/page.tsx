import Link from "next/link";
import { ArrowLeft, Bot, Lightbulb } from "lucide-react";

export const metadata = {
  title: "AI Agent (MCP) — Mindraft",
  description:
    "Connect Claude or any MCP-compatible AI agent to your ideas and use it to capture, refine, and develop them.",
};

export default function McpPage() {
  return (
    <div className="min-h-dvh bg-gradient-to-b from-background via-background to-primary/5">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Settings
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Working with ideas via AI agent
            </h1>
            <p className="text-sm text-muted-foreground">
              Capture, refine, and develop your ideas with Claude or any
              MCP-compatible agent.
            </p>
          </div>
        </div>

        <div className="space-y-8 text-[15px] leading-relaxed text-foreground/90">

          {/* What the agent can do */}
          <section className="rounded-lg border bg-card p-5">
            <h2 className="font-semibold mb-2">What the agent can do</h2>
            <p className="text-muted-foreground mb-3">
              Once connected, an AI agent can work with your ideas the same way
              you do — except hands-free and in bulk. Use it to capture fleeting
              thoughts, flesh out rough notes, organise by theme, and track
              ideas from raw spark to developed concept.
            </p>
            <ul className="space-y-1 text-muted-foreground list-disc pl-5">
              <li>Browse and search all your active ideas</li>
              <li>Create new ideas from a conversation</li>
              <li>Read the full body of any idea to understand context</li>
              <li>Rewrite, expand, or restructure the body of an idea</li>
              <li>Update the title, tags, and status</li>
              <li>Archive ideas you no longer need and restore them later</li>
            </ul>
          </section>

          {/* Idea lifecycle */}
          <section>
            <h2 className="font-semibold mb-3">Idea lifecycle</h2>
            <p className="text-muted-foreground mb-4">
              Every idea moves through three statuses. You and the agent can
              update status at any time.
            </p>
            <div className="space-y-3">
              {[
                {
                  label: "raw",
                  description:
                    "A fresh capture — just a title, maybe a few words. No pressure to polish it yet.",
                },
                {
                  label: "in-progress",
                  description:
                    "You're actively developing this one. The body has been fleshed out but it isn't finished.",
                },
                {
                  label: "developed",
                  description:
                    "The idea is complete enough to act on, share, or implement.",
                },
              ].map(({ label, description }) => (
                <div
                  key={label}
                  className="flex gap-3 items-start rounded-lg border bg-muted/30 p-4"
                >
                  <code className="shrink-0 rounded bg-muted px-2 py-0.5 text-xs font-mono mt-0.5">
                    {label}
                  </code>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Example workflows */}
          <section>
            <h2 className="font-semibold mb-3">Example workflows</h2>
            <div className="space-y-5">

              <div className="rounded-lg border bg-card p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="h-4 w-4 text-primary shrink-0" />
                  <h3 className="font-medium text-sm">Quick capture</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  You have a half-formed idea. Ask the agent to save it so you
                  don&apos;t lose it.
                </p>
                <pre className="rounded bg-muted px-3 py-2 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
{`Save this idea: "Build a habit tracker that ties streaks to
calendar events, not just daily checks." Tag it as productivity.`}
                </pre>
              </div>

              <div className="rounded-lg border bg-card p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="h-4 w-4 text-primary shrink-0" />
                  <h3 className="font-medium text-sm">Refine a raw idea</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Pull up a rough note and ask the agent to expand it into a
                  proper write-up.
                </p>
                <pre className="rounded bg-muted px-3 py-2 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
{`Find my idea about the habit tracker. Expand the body into a
short product brief: problem, solution, and three key features.
Set status to in-progress.`}
                </pre>
              </div>

              <div className="rounded-lg border bg-card p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="h-4 w-4 text-primary shrink-0" />
                  <h3 className="font-medium text-sm">Weekly review</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Get a quick overview of everything in progress, then triage
                  stale raw ideas.
                </p>
                <pre className="rounded bg-muted px-3 py-2 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
{`List all my in-progress ideas. Then list raw ideas — summarise
each in one sentence and tell me which ones seem most promising.`}
                </pre>
              </div>

              <div className="rounded-lg border bg-card p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="h-4 w-4 text-primary shrink-0" />
                  <h3 className="font-medium text-sm">Theme discovery</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Search across your ideas to find related threads and spot
                  patterns you didn&apos;t notice.
                </p>
                <pre className="rounded bg-muted px-3 py-2 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
{`Search my ideas for anything related to "distribution" or
"audience". Group them by theme and suggest tags I could
apply to make them easier to find.`}
                </pre>
              </div>

              <div className="rounded-lg border bg-card p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="h-4 w-4 text-primary shrink-0" />
                  <h3 className="font-medium text-sm">Mark as developed</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Once you&apos;ve polished an idea, update its status and
                  optionally archive it to keep your active list clean.
                </p>
                <pre className="rounded bg-muted px-3 py-2 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
{`Find my habit tracker idea and set its status to developed.
Then archive it so it's out of my active list but still
recoverable.`}
                </pre>
              </div>

            </div>
          </section>

          {/* Available tools reference */}
          <section>
            <h2 className="font-semibold mb-3">Available tools</h2>
            <p className="text-sm text-muted-foreground mb-4">
              The agent has access to these tools automatically — you never
              call them by name.
            </p>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left font-medium px-4 py-2.5 text-xs text-muted-foreground uppercase tracking-wide w-2/5">
                      Tool
                    </th>
                    <th className="text-left font-medium px-4 py-2.5 text-xs text-muted-foreground uppercase tracking-wide">
                      What it does
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {[
                    ["list_ideas", "List active ideas; filter by status, tag, or keyword"],
                    ["search_ideas", "Full-text search across all titles and bodies"],
                    ["get_idea", "Fetch the full body of a single idea by ID"],
                    ["create_idea", "Create a new idea (title required; body and tags optional)"],
                    ["update_idea", "Update title, body, tags, and/or status"],
                    ["archive_idea", "Soft-delete an idea (recoverable via restore)"],
                    ["restore_idea", "Restore an archived idea back to active"],
                    ["list_archived_ideas", "Browse your archive"],
                  ].map(([tool, description]) => (
                    <tr key={tool}>
                      <td className="px-4 py-2.5 align-top">
                        <code className="text-xs font-mono">{tool}</code>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground text-sm">
                        {description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Permanent deletion is intentionally not available via the agent —
              use the web app to permanently delete ideas.
            </p>
          </section>

          {/* Privacy note */}
          <section className="rounded-lg border bg-card p-5">
            <h2 className="font-semibold mb-2">Privacy</h2>
            <p className="text-muted-foreground">
              The agent can only read and modify ideas that belong to you. It
              authenticates via your Google account using a short-lived token —
              no passwords or API keys are ever stored by the agent. Each
              token expires after one hour; the agent re-authenticates
              automatically when needed.
            </p>
          </section>

          {/* Connect CTA */}
          <section className="rounded-lg border bg-primary/5 border-primary/20 p-5">
            <h2 className="font-semibold mb-2">Ready to connect?</h2>
            <p className="text-muted-foreground mb-3">
              Copy your MCP endpoint URL and configuration snippet from
              Settings and add it to your AI agent.
            </p>
            <Link
              href="/settings#mcp"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline underline-offset-4"
            >
              <Bot className="h-4 w-4" />
              Go to Settings → AI Agent
            </Link>
          </section>

        </div>
      </div>
    </div>
  );
}
