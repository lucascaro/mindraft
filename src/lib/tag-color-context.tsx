"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import {
  subscribeToTagColors,
  setTagColor as persistTagColor,
} from "@/lib/firestore";
import {
  getTagColorKey,
  getTagColorClasses,
  TAG_COLORS,
  type ColorKey,
} from "@/lib/tag-colors";

type TagColorContextType = {
  /** CSS classes (bg + text + border) for a tag in the current theme. */
  getColorClasses: (tag: string) => string;
  /** The ColorKey assigned to a tag (override or hash default). */
  getColorKey: (tag: string) => ColorKey;
  /** Persist a color choice for a tag. */
  setTagColor: (tag: string, colorKey: ColorKey) => void;
  /** Swatch hex for a tag in the current theme (for inline style use). */
  getSwatchColor: (tag: string) => string;
  /** The raw override map — useful for downstream hooks that derive state. */
  overrides: Record<string, string>;
};

const TagColorContext = createContext<TagColorContextType | undefined>(
  undefined
);

export function TagColorProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { resolvedTheme } = useTheme();
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) {
      setOverrides({});
      return;
    }
    return subscribeToTagColors(user.uid, setOverrides);
  }, [user]);

  const getColorKey = (tag: string): ColorKey =>
    getTagColorKey(tag, overrides);

  const getColorClasses = (tag: string): string =>
    getTagColorClasses(getColorKey(tag), resolvedTheme);

  const getSwatchColor = (tag: string): string => {
    const key = getColorKey(tag);
    const color = TAG_COLORS.find((c) => c.key === key) ?? TAG_COLORS[0];
    return resolvedTheme === "dark" ? color.swatchDark : color.swatchLight;
  };

  const setTagColor = (tag: string, colorKey: ColorKey) => {
    if (!user) return;
    persistTagColor(user.uid, tag, colorKey);
  };

  return (
    <TagColorContext.Provider
      value={{ getColorClasses, getColorKey, setTagColor, getSwatchColor, overrides }}
    >
      {children}
    </TagColorContext.Provider>
  );
}

export function useTagColors() {
  const ctx = useContext(TagColorContext);
  if (!ctx) throw new Error("useTagColors must be used within TagColorProvider");
  return ctx;
}
