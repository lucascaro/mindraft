import { Timestamp } from "firebase/firestore";

export type IdeaStatus = "raw" | "in-progress" | "developed";

export const IDEA_STATUSES: { value: IdeaStatus; label: string }[] = [
  { value: "raw", label: "Raw" },
  { value: "in-progress", label: "In Progress" },
  { value: "developed", label: "Developed" },
];

export type Idea = {
  id: string;
  title: string;
  body: string; // markdown
  tags: string[];
  status: IdeaStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  userId: string;
  archived?: boolean;
  archivedAt?: Timestamp;
  sortOrder?: number;
};
