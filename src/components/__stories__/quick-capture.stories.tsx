import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QuickCapture } from "../quick-capture";
import { ThemeProvider } from "@/lib/theme-context";
import { MockCryptoProvider } from "./mock-crypto-provider";

const meta: Meta<typeof QuickCapture> = {
  title: "Components/QuickCapture",
  component: QuickCapture,
  decorators: [
    (Story) => (
      <ThemeProvider>
        <MockCryptoProvider>
          <div style={{ maxWidth: 672, margin: "0 auto", padding: 16 }}>
            <Story />
          </div>
        </MockCryptoProvider>
      </ThemeProvider>
    ),
  ],
  args: {
    userId: "e2e-test-user",
  },
};

export default meta;
type Story = StoryObj<typeof QuickCapture>;

export const Default: Story = {};
