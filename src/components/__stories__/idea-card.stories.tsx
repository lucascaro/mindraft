import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { IdeaCard } from "../idea-card";
import { ThemeProvider } from "@/lib/theme-context";
import { TagColorProvider } from "@/lib/tag-color-context";
import type { Idea } from "@/lib/types";

function mockTimestamp(date = new Date()) {
  return {
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
    toDate: () => date,
    toMillis: () => date.getTime(),
  } as Idea["createdAt"];
}

const baseIdea: Idea = {
  id: "idea-1",
  title: "A creative idea worth exploring",
  body: "This idea could **revolutionize** the way we think about problem solving.\n\n- First insight\n- Second insight\n- Third insight",
  tags: ["design", "ux", "mobile"],
  status: "raw",
  createdAt: mockTimestamp(new Date("2025-01-15")),
  updatedAt: mockTimestamp(new Date("2025-01-16")),
  userId: "e2e-test-user",
  archived: false,
  sortOrder: 0,
  refineNext: false,
};

const meta: Meta<typeof IdeaCard> = {
  title: "Components/IdeaCard",
  component: IdeaCard,
  decorators: [
    (Story) => (
      <ThemeProvider>
        <TagColorProvider>
          <div style={{ maxWidth: 672, margin: "0 auto", padding: 16 }}>
            <Story />
          </div>
        </TagColorProvider>
      </ThemeProvider>
    ),
  ],
  args: {
    idea: baseIdea,
    expanded: false,
    onExpand: fn(),
    onCollapse: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof IdeaCard>;

export const Collapsed: Story = {
  args: {
    expanded: false,
  },
};

export const CollapsedNoBody: Story = {
  args: {
    expanded: false,
    idea: { ...baseIdea, body: "", tags: [] },
  },
};

export const ExpandedView: Story = {
  args: {
    expanded: true,
  },
};

export const ExpandedNoBody: Story = {
  args: {
    expanded: true,
    idea: { ...baseIdea, body: "" },
  },
};

export const StatusRaw: Story = {
  args: {
    expanded: true,
    idea: { ...baseIdea, status: "raw" },
  },
};

export const StatusInProgress: Story = {
  args: {
    expanded: true,
    idea: { ...baseIdea, status: "in-progress" },
  },
};

export const StatusDeveloped: Story = {
  args: {
    expanded: true,
    idea: { ...baseIdea, status: "developed" },
  },
};

export const RefineNext: Story = {
  args: {
    expanded: true,
    idea: { ...baseIdea, refineNext: true },
  },
};

export const ArchivedMode: Story = {
  args: {
    expanded: true,
    idea: {
      ...baseIdea,
      archived: true,
      archivedAt: mockTimestamp(new Date("2025-01-20")),
    },
    mode: "archived",
  },
};

export const ManyTags: Story = {
  args: {
    expanded: true,
    idea: {
      ...baseIdea,
      tags: ["design", "ux", "mobile", "research", "mvp", "prototype", "feedback"],
    },
  },
};

export const LongTitle: Story = {
  args: {
    idea: {
      ...baseIdea,
      title: "This is a really long idea title that should demonstrate how the card handles overflow and wrapping of text content",
    },
  },
};
