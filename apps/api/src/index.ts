import {
  createDraft,
  createDraftInputSchema,
  createVersion,
  createVersionInputSchema,
  type CreateDraftInput,
  type CreateVersionInput,
  type DesignDraft,
  type UpdateDraftInput,
  updateDraft,
  updateDraftInputSchema,
} from "@headstone/core";
import { designDocumentSchema, type DesignDocument } from "@headstone/schema";

export type DraftRouteName = "create" | "read" | "update" | "version";

export interface DraftCreateRouteRequest {
  body: CreateDraftInput;
}

export interface DraftReadRouteRequest {
  params: { draft_id: string };
}

export interface DraftUpdateRouteRequest {
  params: { draft_id: string };
  body: UpdateDraftInput;
}

export interface DraftVersionRouteRequest {
  params: { draft_id: string };
  body: CreateVersionInput;
}

export interface DraftStubResponse {
  ok: false;
  route: DraftRouteName;
  message: string;
  draft: DesignDraft | null;
  design_document: DesignDocument | null;
}

export function createDraftRoute(
  request: DraftCreateRouteRequest,
): DraftStubResponse {
  const body = createDraftInputSchema.parse(request.body);
  designDocumentSchema.parse(body.design_document);
  createDraft(body);

  return {
    ok: false,
    route: "create",
    message: "Draft persistence is not wired yet.",
    draft: null,
    design_document: body.design_document,
  };
}

export function readDraftRoute(
  request: DraftReadRouteRequest,
): DraftStubResponse {
  return {
    ok: false,
    route: "read",
    message: `Draft ${request.params.draft_id} is not loaded from storage yet.`,
    draft: null,
    design_document: null,
  };
}

export function updateDraftRoute(
  request: DraftUpdateRouteRequest,
): DraftStubResponse {
  const body = updateDraftInputSchema.parse(request.body);
  if (body.design_document) {
    designDocumentSchema.parse(body.design_document);
  }
  void updateDraft;

  return {
    ok: false,
    route: "update",
    message: `Draft ${request.params.draft_id} update is not persisted yet.`,
    draft: null,
    design_document: body.design_document ?? null,
  };
}

export function createVersionRoute(
  request: DraftVersionRouteRequest,
): DraftStubResponse {
  const body = createVersionInputSchema.parse(request.body);
  void createVersion;

  return {
    ok: false,
    route: "version",
    message: `Version ${body.id} for draft ${request.params.draft_id} is not persisted yet.`,
    draft: null,
    design_document: null,
  };
}

export const draftRoutes = {
  createDraftRoute,
  readDraftRoute,
  updateDraftRoute,
  createVersionRoute,
} as const;
