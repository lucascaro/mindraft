import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, within } from "@testing-library/react";
import { IdeaCard } from "../idea-card";
import * as firestore from "@/lib/firestore";
import type { Idea } from "@/lib/types";

function mockIdea(overrides: Partial<Idea> = {}): Idea {
  return {
    id: "test-1",
    title: "Test Idea",
    body: "Some body text",
    tags: ["tag1"],
    status: "raw",
    createdAt: { seconds: 1000, nanoseconds: 0, toDate: () => new Date() } as Idea["createdAt"],
    updatedAt: { seconds: 1000, nanoseconds: 0, toDate: () => new Date() } as Idea["updatedAt"],
    userId: "user-1",
    ...overrides,
  };
}

describe("IdeaCard", () => {
  it("calls onExpand when clicking a collapsed card", () => {
    const onExpand = vi.fn();
    const onCollapse = vi.fn();
    const { getByLabelText } = render(
      <IdeaCard
        idea={mockIdea()}
        expanded={false}
        onExpand={onExpand}
        onCollapse={onCollapse}
      />
    );

    // The card has aria-label="Test Idea" and role="button" when collapsed
    const card = getByLabelText("Test Idea");
    fireEvent.click(card);
    expect(onExpand).toHaveBeenCalledTimes(1);
  });

  it("does not call onExpand when clicking an expanded card", () => {
    const onExpand = vi.fn();
    const onCollapse = vi.fn();
    const { container } = render(
      <IdeaCard
        idea={mockIdea()}
        expanded={true}
        onExpand={onExpand}
        onCollapse={onCollapse}
      />
    );

    // Expanded card should not have role="button"
    const card = container.querySelector("[aria-expanded]") as HTMLElement;
    expect(card).not.toBeNull();
    expect(card.getAttribute("role")).toBeNull();

    fireEvent.click(card);
    expect(onExpand).not.toHaveBeenCalled();
  });

  it("expands via keyboard Enter on collapsed card", () => {
    const onExpand = vi.fn();
    const onCollapse = vi.fn();
    const { getByLabelText } = render(
      <IdeaCard
        idea={mockIdea()}
        expanded={false}
        onExpand={onExpand}
        onCollapse={onCollapse}
      />
    );

    const card = getByLabelText("Test Idea");
    fireEvent.keyDown(card, { key: "Enter" });
    expect(onExpand).toHaveBeenCalledTimes(1);
  });

  it("clicking 'No description yet' on an expanded idea with no body enters edit mode", () => {
    const { getByText, getByRole } = render(
      <IdeaCard
        idea={mockIdea({ body: "" })}
        expanded={true}
        onExpand={vi.fn()}
        onCollapse={vi.fn()}
      />
    );
    fireEvent.click(getByText(/No description yet/));
    expect(getByRole("textbox", { name: "Idea body" })).toBeTruthy();
  });

  describe("Save behavior (active)", () => {
    beforeEach(() => {
      vi.mocked(firestore.updateIdea).mockClear();
      vi.mocked(firestore.archiveIdea).mockClear();
      vi.mocked(firestore.deleteIdea).mockClear();
    });

    function renderEditing(idea = mockIdea()) {
      const onCollapse = vi.fn();
      const utils = render(
        <IdeaCard idea={idea} expanded={true} onExpand={vi.fn()} onCollapse={onCollapse} />
      );
      fireEvent.click(utils.getByLabelText("Edit idea"));
      return { ...utils, onCollapse };
    }

    it("Save button is disabled when not dirty, enabled after edit", () => {
      const { getByRole } = renderEditing();
      const saveBtn = getByRole("button", { name: "Save" }) as HTMLButtonElement;
      expect(saveBtn.disabled).toBe(true);

      fireEvent.change(getByRole("textbox", { name: "Idea body" }), {
        target: { value: "new body" },
      });
      expect(saveBtn.disabled).toBe(false);
    });

    it("clicking Save calls updateIdea with diff and exits edit mode", async () => {
      const { getByRole, queryByLabelText } = renderEditing();
      fireEvent.change(getByRole("textbox", { name: "Idea body" }), {
        target: { value: "new body" },
      });
      fireEvent.click(getByRole("button", { name: "Save" }));

      await Promise.resolve();
      expect(firestore.updateIdea).toHaveBeenCalledTimes(1);
      expect(vi.mocked(firestore.updateIdea).mock.calls[0][1]).toEqual({ body: "new body" });
      // Edit mode exited (Edit button visible again)
      expect(queryByLabelText("Edit idea")).not.toBeNull();
    });

    it("does NOT auto-save on close — does not call updateIdea when closing without changes", () => {
      const { getAllByLabelText, onCollapse } = renderEditing();
      fireEvent.click(getAllByLabelText("Close idea")[1]);
      expect(firestore.updateIdea).not.toHaveBeenCalled();
      expect(onCollapse).toHaveBeenCalledTimes(1);
    });

    it("shows Unsaved changes prompt when closing dirty", () => {
      const { getByRole, getByText, getAllByLabelText, onCollapse } = renderEditing();
      fireEvent.change(getByRole("textbox", { name: "Idea body" }), {
        target: { value: "dirty" },
      });
      fireEvent.click(getAllByLabelText("Close idea")[1]);
      expect(getByText("Unsaved changes")).toBeDefined();
      expect(onCollapse).not.toHaveBeenCalled();
    });

    it("Discard from unsaved-changes prompt collapses without saving", () => {
      const { getByRole, getAllByLabelText, onCollapse } = renderEditing();
      fireEvent.change(getByRole("textbox", { name: "Idea body" }), {
        target: { value: "dirty" },
      });
      fireEvent.click(getAllByLabelText("Close idea")[1]);
      fireEvent.click(getByRole("button", { name: "Discard" }));
      expect(firestore.updateIdea).not.toHaveBeenCalled();
      expect(onCollapse).toHaveBeenCalledTimes(1);
    });

    it("Cmd+Enter saves pending changes and exits edit mode", async () => {
      const { getByRole, queryByLabelText } = renderEditing();
      fireEvent.change(getByRole("textbox", { name: "Idea body" }), {
        target: { value: "cmd-enter save" },
      });
      fireEvent.keyDown(document, { key: "Enter", metaKey: true });
      await Promise.resolve();
      await Promise.resolve();
      expect(firestore.updateIdea).toHaveBeenCalledTimes(1);
      expect(vi.mocked(firestore.updateIdea).mock.calls[0][1]).toEqual({ body: "cmd-enter save" });
      expect(queryByLabelText("Edit idea")).not.toBeNull();
    });

    it("Archive while dirty saves pending changes first, then archives", async () => {
      const { getByRole, container } = renderEditing();
      fireEvent.change(getByRole("textbox", { name: "Idea body" }), {
        target: { value: "save-before-archive" },
      });
      const expanded = container.querySelector("[aria-expanded='true']") as HTMLElement;
      fireEvent.click(within(expanded).getByRole("button", { name: /Archive/i }));
      await Promise.resolve();
      await Promise.resolve();
      expect(firestore.updateIdea).toHaveBeenCalledTimes(1);
      expect(firestore.archiveIdea).toHaveBeenCalledWith("test-1");
      // updateIdea was called before archiveIdea
      const updateOrder = vi.mocked(firestore.updateIdea).mock.invocationCallOrder[0];
      const archiveOrder = vi.mocked(firestore.archiveIdea).mock.invocationCallOrder[0];
      expect(updateOrder).toBeLessThan(archiveOrder);
    });

    it("Save from unsaved-changes prompt persists then collapses", async () => {
      const { getByRole, getAllByLabelText, onCollapse } = renderEditing();
      fireEvent.change(getByRole("textbox", { name: "Idea body" }), {
        target: { value: "dirty" },
      });
      fireEvent.click(getAllByLabelText("Close idea")[1]);
      // The Save inside the prompt is the only enabled "Save" button at this point
      fireEvent.click(getByRole("button", { name: "Save" }));
      // Flush microtasks for awaited save then the synchronous follow-ups
      await Promise.resolve();
      await Promise.resolve();
      expect(firestore.updateIdea).toHaveBeenCalledTimes(1);
      expect(onCollapse).toHaveBeenCalledTimes(1);
    });
  });

  describe("Delete behavior", () => {
    beforeEach(() => {
      vi.mocked(firestore.deleteIdea).mockClear();
    });

    it("active edit mode: Delete requires confirmation", async () => {
      const { getByLabelText, getByRole } = render(
        <IdeaCard idea={mockIdea()} expanded={true} onExpand={vi.fn()} onCollapse={vi.fn()} />
      );
      fireEvent.click(getByLabelText("Edit idea"));
      fireEvent.click(getByRole("button", { name: /Delete/i }));
      // Now confirmation visible — first click did NOT delete
      expect(firestore.deleteIdea).not.toHaveBeenCalled();
      // Confirm
      fireEvent.click(getByRole("button", { name: "Delete" }));
      await Promise.resolve();
      expect(firestore.deleteIdea).toHaveBeenCalledWith("test-1");
    });
  });

  describe("Archive mode", () => {
    beforeEach(() => {
      vi.mocked(firestore.deleteIdea).mockClear();
      vi.mocked(firestore.restoreIdea).mockClear();
    });

    it("does not show Edit button when expanded", () => {
      const { queryByLabelText } = render(
        <IdeaCard
          idea={mockIdea()}
          mode="archived"
          expanded={true}
          onExpand={vi.fn()}
          onCollapse={vi.fn()}
        />
      );
      expect(queryByLabelText("Edit idea")).toBeNull();
    });

    it("view mode footer shows Restore and Delete (with confirmation)", async () => {
      const { container, getByRole } = render(
        <IdeaCard
          idea={mockIdea()}
          mode="archived"
          expanded={true}
          onExpand={vi.fn()}
          onCollapse={vi.fn()}
        />
      );
      const expanded = container.querySelector("[aria-expanded='true']") as HTMLElement;
      const scoped = within(expanded);

      fireEvent.click(scoped.getByRole("button", { name: /Restore/i }));
      expect(firestore.restoreIdea).toHaveBeenCalledWith("test-1");

      // Trigger delete confirmation
      fireEvent.click(scoped.getByRole("button", { name: /Delete/i }));
      expect(firestore.deleteIdea).not.toHaveBeenCalled();
      fireEvent.click(getByRole("button", { name: "Delete" }));
      await Promise.resolve();
      expect(firestore.deleteIdea).toHaveBeenCalledWith("test-1");
    });
  });
});
