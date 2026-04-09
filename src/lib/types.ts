import { Timestamp } from "firebase/firestore";

export type IdeaStatus = "raw" | "refining" | "developed";

export type Idea = {
  id: string;
  title: string;
  body: string; // markdown
  tags: string[];
  status: IdeaStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  aiSuggestions?: string;
  userId: string;
};
