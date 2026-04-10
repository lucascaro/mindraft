import type { StorybookConfig } from "@storybook/nextjs-vite";
import path from "path";
import { fileURLToPath } from "url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: [
    "@chromatic-com/storybook",
    "@storybook/addon-vitest",
    "@storybook/addon-a11y",
    "@storybook/addon-docs",
  ],
  framework: "@storybook/nextjs-vite",
  staticDirs: ["../public"],

  async viteFinal(config) {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias as Record<string, string>),
      "@/lib/firestore": path.resolve(dirname, "../src/lib/__e2e__/firestore.ts"),
      "@/lib/auth-context": path.resolve(
        dirname,
        "../src/lib/__e2e__/auth-context.tsx"
      ),
      "@/lib/firebase": path.resolve(dirname, "../src/lib/__e2e__/firebase.ts"),
    };
    return config;
  },
};

export default config;
