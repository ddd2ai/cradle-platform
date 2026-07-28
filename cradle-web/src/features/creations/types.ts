export type CreationStage = "seed" | "growing" | "mature" | "stable";

export type CreationStatus =
  | "healthy"
  | "growing"
  | "exploring"
  | "idle"
  | "failed";

export interface Creation {
  id: string;
  artifactId: string;
  title: string;
  originCellId: string;
  type: string;
  stage: CreationStage;
  status: CreationStatus;
  description?: string;
  planSummary?: string;
  summary?: string;
  goal?: string;
  provider?: string;
  model?: string;
  tags: string[];
  previewImageUrl?: string;
  previewUrl?: string;
  workspaceAvailable: boolean;
  createdAt?: string;
  updatedAt?: string;
}
