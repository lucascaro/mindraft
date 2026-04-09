export type ColorKey =
  | "violet"
  | "indigo"
  | "blue"
  | "cyan"
  | "teal"
  | "emerald"
  | "amber"
  | "orange"
  | "rose"
  | "pink";

export type TagColor = {
  key: ColorKey;
  label: string;
  /** Tailwind classes for light mode */
  light: string;
  /** Tailwind classes for dark mode */
  dark: string;
  /** Hex value for swatch dot in light mode */
  swatchLight: string;
  /** Hex value for swatch dot in dark mode */
  swatchDark: string;
};

export const TAG_COLORS: TagColor[] = [
  {
    key: "violet",
    label: "Violet",
    light: "bg-violet-100 text-violet-800 border-violet-200",
    dark: "bg-violet-900/40 text-violet-300 border-violet-700",
    swatchLight: "#7c3aed",
    swatchDark: "#a78bfa",
  },
  {
    key: "indigo",
    label: "Indigo",
    light: "bg-indigo-100 text-indigo-800 border-indigo-200",
    dark: "bg-indigo-900/40 text-indigo-300 border-indigo-700",
    swatchLight: "#4338ca",
    swatchDark: "#a5b4fc",
  },
  {
    key: "blue",
    label: "Blue",
    light: "bg-blue-100 text-blue-800 border-blue-200",
    dark: "bg-blue-900/40 text-blue-300 border-blue-700",
    swatchLight: "#1d4ed8",
    swatchDark: "#93c5fd",
  },
  {
    key: "cyan",
    label: "Cyan",
    light: "bg-cyan-100 text-cyan-800 border-cyan-200",
    dark: "bg-cyan-900/40 text-cyan-300 border-cyan-700",
    swatchLight: "#0e7490",
    swatchDark: "#67e8f9",
  },
  {
    key: "teal",
    label: "Teal",
    light: "bg-teal-100 text-teal-800 border-teal-200",
    dark: "bg-teal-900/40 text-teal-300 border-teal-700",
    swatchLight: "#0f766e",
    swatchDark: "#5eead4",
  },
  {
    key: "emerald",
    label: "Emerald",
    light: "bg-emerald-100 text-emerald-800 border-emerald-200",
    dark: "bg-emerald-900/40 text-emerald-300 border-emerald-700",
    swatchLight: "#047857",
    swatchDark: "#6ee7b7",
  },
  {
    key: "amber",
    label: "Amber",
    light: "bg-amber-100 text-amber-800 border-amber-200",
    dark: "bg-amber-900/40 text-amber-300 border-amber-700",
    swatchLight: "#b45309",
    swatchDark: "#fcd34d",
  },
  {
    key: "orange",
    label: "Orange",
    light: "bg-orange-100 text-orange-800 border-orange-200",
    dark: "bg-orange-900/40 text-orange-300 border-orange-700",
    swatchLight: "#c2410c",
    swatchDark: "#fb923c",
  },
  {
    key: "rose",
    label: "Rose",
    light: "bg-rose-100 text-rose-800 border-rose-200",
    dark: "bg-rose-900/40 text-rose-300 border-rose-700",
    swatchLight: "#be123c",
    swatchDark: "#fb7185",
  },
  {
    key: "pink",
    label: "Pink",
    light: "bg-pink-100 text-pink-800 border-pink-200",
    dark: "bg-pink-900/40 text-pink-300 border-pink-700",
    swatchLight: "#9d174d",
    swatchDark: "#f472b6",
  },
];

/** Deterministically maps a tag name to a color index via string hash. */
function hashTag(tag: string): number {
  let h = 0;
  for (let i = 0; i < tag.length; i++) {
    h = (Math.imul(31, h) + tag.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % TAG_COLORS.length;
}

/** Returns the color key for a tag, using the override map or a hash default. */
export function getTagColorKey(
  tag: string,
  overrides: Record<string, string>
): ColorKey {
  return (overrides[tag] as ColorKey) ?? TAG_COLORS[hashTag(tag)].key;
}

/** Returns the Tailwind class string for a color key in the given theme. */
export function getTagColorClasses(
  colorKey: string,
  resolvedTheme: "light" | "dark"
): string {
  const color = TAG_COLORS.find((c) => c.key === colorKey) ?? TAG_COLORS[0];
  return resolvedTheme === "dark" ? color.dark : color.light;
}
