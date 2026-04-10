import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "@storybook/test";
import { SwipeToArchive } from "../swipe-to-archive";
import { ThemeProvider } from "@/lib/theme-context";
import { Card, CardContent, CardHeader } from "../ui/card";

const meta: Meta<typeof SwipeToArchive> = {
  title: "Components/SwipeToArchive",
  component: SwipeToArchive,
  decorators: [
    (Story) => (
      <ThemeProvider>
        <div style={{ maxWidth: 672, margin: "0 auto", padding: 16 }}>
          <p style={{ marginBottom: 8, fontSize: 14, color: "#888" }}>
            Swipe the card to the right to trigger the archive action.
          </p>
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
  args: {
    enabled: true,
    onArchive: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof SwipeToArchive>;

export const Enabled: Story = {
  args: {
    enabled: true,
    children: (
      <Card>
        <CardHeader>
          <span className="font-semibold">Swipeable Idea Card</span>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Try swiping this card to the right to see the archive gesture.
          </p>
        </CardContent>
      </Card>
    ),
  },
};

export const Disabled: Story = {
  args: {
    enabled: false,
    children: (
      <Card>
        <CardHeader>
          <span className="font-semibold">Non-swipeable Card</span>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Swipe is disabled on this card. Dragging has no effect.
          </p>
        </CardContent>
      </Card>
    ),
  },
};
