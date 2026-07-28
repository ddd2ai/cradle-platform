import { fetchCreations } from "../../api/cradleClient";
import type { Creation, CreationStage, CreationStatus } from "./types";

interface CreationDto {
  id?: string;
  artifactId?: string;
  name?: string;
  title?: string;
  originCellId?: string;
  cellId?: string;
  type?: string;
  status?: string;
  stage?: string;
  description?: string | null;
  plan?: {
    summary?: string | null;
  } | null;
  planSummary?: string | null;
  summary?: string | null;
  goal?: string | null;
  provider?: string | null;
  model?: string | null;
  outputPaths?: string[];
  languages?: string[];
  previewImageUrl?: string | null;
  previewUrl?: string | null;
  workspaceAvailable?: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export async function getCreations(): Promise<Creation[]> {
  const items = await fetchCreations();

  return items
    .map((item) => mapCreationDtoToCreation(item))
    .filter((creation): creation is Creation => creation !== null);
}

export function getArtifactDownloadUrl(creation: Pick<Creation, "originCellId" | "artifactId">): string {
  return `/api/v1/cells/${encodeURIComponent(
    creation.originCellId,
  )}/artifacts/${encodeURIComponent(creation.artifactId)}/export`;
}

export function mapCreationDtoToCreation(item: CreationDto): Creation | null {
  const artifactId = item.artifactId ?? item.id;
  const originCellId = item.originCellId ?? item.cellId;

  if (!artifactId || !originCellId) {
    return null;
  }

  return {
    id: item.id ?? artifactId,
    artifactId,
    title: item.title?.trim() || item.name?.trim() || artifactId,
    originCellId,
    type: item.type ?? "unknown",
    stage: normalizeStage(item.stage),
    status: normalizeStatus(item.status),
    description: normalizeDescription(item),
    planSummary: normalizeText(item.planSummary ?? item.plan?.summary),
    summary: normalizeText(item.planSummary ?? item.plan?.summary ?? item.summary),
    goal: item.goal ?? undefined,
    provider: item.provider ?? undefined,
    model: item.model ?? undefined,
    tags: mapCreationTags(item),
    previewImageUrl: item.previewImageUrl ?? undefined,
    previewUrl: item.previewUrl ?? undefined,
    workspaceAvailable: item.workspaceAvailable !== false,
    createdAt: item.createdAt ?? undefined,
    updatedAt: item.updatedAt ?? undefined,
  };
}

function normalizeDescription(item: CreationDto): string | undefined {
  return normalizeText(item.description ?? item.planSummary ?? item.plan?.summary);
}

function normalizeText(value: string | null | undefined): string | undefined {
  const text = String(value ?? "").trim();
  return text || undefined;
}

function normalizeStage(value: string | undefined): CreationStage {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (normalized === "stable" || normalized === "mature" || normalized === "growing") {
    return normalized;
  }

  return "seed";
}

function normalizeStatus(value: string | undefined): CreationStatus {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (normalized.includes("failed") || normalized.includes("error")) {
    return "failed";
  }

  if (normalized.includes("explor")) {
    return "exploring";
  }

  if (normalized.includes("grow") || normalized.includes("repair") || normalized.includes("running")) {
    return "growing";
  }

  if (
    normalized.includes("healthy") ||
    normalized.includes("stable") ||
    normalized.includes("completed") ||
    normalized.includes("published")
  ) {
    return "healthy";
  }

  return "idle";
}

function mapCreationTags(item: CreationDto): string[] {
  return [
    item.type,
    ...(Array.isArray(item.languages) ? item.languages : []),
  ].filter((tag): tag is string => Boolean(tag));
}
