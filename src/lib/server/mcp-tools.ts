/**
 * Registers all mindraft MCP tools onto the provided McpServer instance.
 *
 * The `userId` parameter is always sourced from the verified JWT in the MCP
 * route handler — it is captured in a closure and never accepted as a tool
 * input, so agents cannot access another user's data.
 */

import "server-only";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  listIdeas,
  listArchivedIdeas,
  getIdea,
  createIdea,
  updateIdea,
  archiveIdea,
  restoreIdea,
  deleteIdea,
  searchIdeas,
  type IdeaStatus,
} from "./firestore-admin";

const STATUS_VALUES = ["raw", "in-progress", "developed"] as const;

function ok(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

function err(message: string) {
  return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true as const };
}

export function registerMcpTools(server: McpServer, userId: string) {
  // ── list_ideas ────────────────────────────────────────────────────────────
  server.tool(
    "list_ideas",
    "List active (non-archived) ideas. Returns summaries without body text. Use get_idea to fetch the full body.",
    {
      status: z.enum(STATUS_VALUES).optional().describe("Filter by status: raw, in-progress, or developed"),
      tag: z.string().optional().describe("Filter by tag (exact match)"),
      search: z.string().optional().describe("Filter by keyword in title (case-insensitive)"),
      limit: z.number().int().min(1).max(200).optional().describe("Max results to return (default: 50)"),
    },
    async ({ status, tag, search, limit }) => {
      const ideas = await listIdeas(userId, {
        status: status as IdeaStatus | undefined,
        tag,
        search,
        limit,
      });
      return ok(ideas);
    }
  );

  // ── list_archived_ideas ───────────────────────────────────────────────────
  server.tool(
    "list_archived_ideas",
    "List archived ideas, sorted by most-recently-archived first. Returns summaries without body text.",
    {
      limit: z.number().int().min(1).max(200).optional().describe("Max results to return (default: 50)"),
    },
    async ({ limit }) => {
      const ideas = await listArchivedIdeas(userId, limit);
      return ok(ideas);
    }
  );

  // ── get_idea ──────────────────────────────────────────────────────────────
  server.tool(
    "get_idea",
    "Get a single idea by ID, including the full markdown body.",
    {
      id: z.string().min(1).describe("The idea ID (from list_ideas or create_idea)"),
    },
    async ({ id }) => {
      const idea = await getIdea(userId, id);
      if (!idea) return err(`Idea '${id}' not found`);
      return ok(idea);
    }
  );

  // ── create_idea ───────────────────────────────────────────────────────────
  server.tool(
    "create_idea",
    "Create a new idea. Status defaults to 'raw'. Returns the new idea's ID.",
    {
      title: z.string().min(1).max(500).describe("Idea title (required)"),
      body: z.string().max(50000).optional().describe("Body content in Markdown (optional)"),
      tags: z.array(z.string().max(100)).max(30).optional().describe("Tags to attach (optional)"),
    },
    async ({ title, body, tags }) => {
      const id = await createIdea(userId, title, body ?? "", tags ?? []);
      return ok({ id, message: "Idea created" });
    }
  );

  // ── update_idea ───────────────────────────────────────────────────────────
  server.tool(
    "update_idea",
    "Update one or more fields of an existing idea. At least one field must be provided.",
    {
      id: z.string().min(1).describe("The idea ID to update"),
      title: z.string().min(1).max(500).optional().describe("New title"),
      body: z.string().max(50000).optional().describe("New body (Markdown)"),
      tags: z.array(z.string().max(100)).max(30).optional().describe("Replace all tags with this array"),
      status: z.enum(STATUS_VALUES).optional().describe("New status: raw, in-progress, or developed"),
    },
    async ({ id, title, body, tags, status }) => {
      if (!title && body === undefined && !tags && !status) {
        return err("Provide at least one field to update: title, body, tags, or status");
      }
      const updated = await updateIdea(userId, id, {
        ...(title !== undefined ? { title } : {}),
        ...(body !== undefined ? { body } : {}),
        ...(tags !== undefined ? { tags } : {}),
        ...(status !== undefined ? { status: status as IdeaStatus } : {}),
      });
      if (!updated) return err(`Idea '${id}' not found`);
      return ok({ id, message: "Idea updated" });
    }
  );

  // ── archive_idea ──────────────────────────────────────────────────────────
  server.tool(
    "archive_idea",
    "Archive an idea (soft delete). It can be restored later with restore_idea. Requires confirm: true to prevent accidental archiving from prompt injection.",
    {
      id: z.string().min(1).describe("The idea ID to archive"),
      confirm: z.literal(true).describe("Must be exactly true to confirm archiving"),
    },
    async ({ id }) => {
      const ok_ = await archiveIdea(userId, id);
      if (!ok_) return err(`Idea '${id}' not found`);
      return ok({ id, message: "Idea archived" });
    }
  );

  // ── restore_idea ──────────────────────────────────────────────────────────
  server.tool(
    "restore_idea",
    "Restore an archived idea back to the active list.",
    {
      id: z.string().min(1).describe("The idea ID to restore"),
    },
    async ({ id }) => {
      const ok_ = await restoreIdea(userId, id);
      if (!ok_) return err(`Archived idea '${id}' not found`);
      return ok({ id, message: "Idea restored" });
    }
  );

  // NOTE: delete_idea is intentionally not exposed via MCP.
  //
  // Permanent deletion cannot be undone. An adversarial note body could instruct
  // the agent to call a delete tool — even one that requires confirm: true —
  // because the LLM would simply comply with the instruction and supply the flag.
  //
  // If you need to permanently delete an idea, archive it first via archive_idea
  // and then delete it through the Mindraft web app.
  void deleteIdea; // keep the import used; deletion only via the web UI

  // ── search_ideas ──────────────────────────────────────────────────────────
  server.tool(
    "search_ideas",
    "Search active ideas by keyword. Matches in the title rank above body-only matches.",
    {
      query: z.string().min(1).describe("Search keyword (case-insensitive)"),
    },
    async ({ query }) => {
      const ideas = await searchIdeas(userId, query);
      return ok(ideas);
    }
  );
}
