/**
 * 256-word list for encoding the recovery key.
 * Each word encodes 8 bits (one byte). 32 bytes = 32 words + 1 checksum word.
 *
 * Words chosen to be: short (3–7 chars), common, easy to spell, clearly
 * distinct from each other (no plurals/variants in the same list).
 */
export const WORDLIST: readonly string[] = [
  "able",   "acid",   "aged",   "also",   "arch",   "area",   "army",   "atom",
  "aunt",   "back",   "ball",   "band",   "barn",   "base",   "bath",   "bead",
  "beam",   "bean",   "bear",   "beat",   "beef",   "bell",   "belt",   "bend",
  "bias",   "bill",   "bird",   "bite",   "blot",   "blow",   "blue",   "blur",
  "boat",   "bold",   "bolt",   "bone",   "book",   "boom",   "boot",   "bore",
  "born",   "both",   "bowl",   "brow",   "bulk",   "bull",   "burn",   "burp",
  "cafe",   "cage",   "cake",   "calf",   "call",   "calm",   "camp",   "card",
  "care",   "cart",   "case",   "cash",   "cave",   "cell",   "chain",  "chair",
  "chalk",  "check",  "cheer",  "chest",  "chip",   "claim",  "clap",   "clay",
  "clip",   "clue",   "coal",   "coat",   "code",   "coil",   "cold",   "colt",
  "cone",   "cook",   "copy",   "cord",   "core",   "corn",   "cost",   "couch",
  "cove",   "crew",   "crop",   "crow",   "cube",   "curb",   "cure",   "curl",
  "cute",   "dale",   "dark",   "dart",   "dash",   "data",   "dawn",   "deal",
  "dear",   "deck",   "deed",   "deer",   "deft",   "deny",   "desk",   "dial",
  "dice",   "diet",   "dime",   "dip",    "dirt",   "disk",   "dock",   "dome",
  "door",   "dose",   "dove",   "down",   "draw",   "dray",   "drop",   "drum",
  "duck",   "dune",   "dusk",   "dust",   "duty",   "each",   "earn",   "ease",
  "east",   "echo",   "edge",   "edit",   "emit",   "envy",   "epic",   "exam",
  "exit",   "face",   "fact",   "fade",   "fail",   "fair",   "fame",   "farm",
  "fast",   "fate",   "fawn",   "fear",   "feat",   "feed",   "feel",   "fell",
  "felt",   "fern",   "file",   "fill",   "film",   "find",   "fire",   "fish",
  "fist",   "five",   "flag",   "flat",   "flaw",   "flax",   "flea",   "fled",
  "flew",   "flex",   "flip",   "flog",   "flow",   "foam",   "fold",   "folk",
  "fond",   "font",   "food",   "fool",   "foot",   "ford",   "fork",   "form",
  "fort",   "foul",   "free",   "frog",   "from",   "fuel",   "full",   "fund",
  "fuse",   "gain",   "gale",   "gaze",   "gear",   "gem",    "gill",   "gist",
  "give",   "glad",   "glow",   "glue",   "goal",   "goat",   "gold",   "golf",
  "gown",   "grab",   "grad",   "gram",   "grip",   "grit",   "grow",   "gulf",
  "gull",   "gust",   "hair",   "half",   "hall",   "halt",   "hand",   "hang",
  "hare",   "harm",   "harp",   "haze",   "head",   "heat",   "heel",   "heir",
  "helm",   "hemp",   "herb",   "hero",   "hide",   "hill",   "hint",   "hole",
  "home",   "hook",   "hope",   "horn",   "hose",   "hump",   "hunt",   "hurl",
];

// Verify at module load that the list has exactly 256 entries
if (WORDLIST.length !== 256) {
  throw new Error(`WORDLIST must have exactly 256 entries, got ${WORDLIST.length}`);
}

/**
 * Encodes 32 bytes as a 33-word recovery phrase.
 * Words 1-32 encode the key bytes. Word 33 is a checksum:
 * WORDLIST[sum_of_all_byte_values mod 256]
 */
export function encodeRecoveryKey(bytes: Uint8Array): string[] {
  if (bytes.length !== 32) throw new Error("Expected 32 bytes");
  const words: string[] = [];
  let checksum = 0;
  for (let i = 0; i < 32; i++) {
    words.push(WORDLIST[bytes[i]]);
    checksum = (checksum + bytes[i]) & 0xff;
  }
  words.push(WORDLIST[checksum]);
  return words;
}

/**
 * Decodes a 33-word recovery phrase back to 32 bytes.
 * Throws if any word is unrecognised or the checksum is invalid.
 */
export function decodeRecoveryKey(words: string[]): Uint8Array {
  if (words.length !== 33) throw new Error("Recovery phrase must be 33 words");
  const bytes = new Uint8Array(32);
  let checksum = 0;
  for (let i = 0; i < 32; i++) {
    const idx = WORDLIST.indexOf(words[i].toLowerCase().trim());
    if (idx === -1) throw new Error(`Unknown word: "${words[i]}"`);
    bytes[i] = idx;
    checksum = (checksum + idx) & 0xff;
  }
  const expectedChecksumWord = WORDLIST.indexOf(words[32].toLowerCase().trim());
  if (expectedChecksumWord === -1) throw new Error(`Unknown word: "${words[32]}"`);
  if (checksum !== expectedChecksumWord) {
    throw new Error("Checksum mismatch — check for transcription errors");
  }
  return bytes;
}
