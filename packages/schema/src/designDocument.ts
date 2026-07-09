import { z } from "zod";

const positiveNumber = z.number().finite().gt(0);
const nonNegativeNumber = z.number().finite().gte(0);

const unitSchema = z.enum(["in", "mm"]);

const faceSchema = z
  .object({
    width: positiveNumber,
    height: positiveNumber,
    depth: positiveNumber,
    shape: z.string().min(1),
    material: z.string().min(1),
    finish: z.string().min(1),
  })
  .strict();

const baseElementSchema = z
  .object({
    id: z.string().min(1),
    x_in: nonNegativeNumber,
    y_in: nonNegativeNumber,
    rotation_deg: z.number().finite().default(0),
  })
  .strict();

const textElementSchema = baseElementSchema
  .extend({
    type: z.literal("text"),
    field: z.string().min(1).optional(),
    content: z.string().min(1),
    font: z.string().min(1),
    size_in: positiveNumber,
    align: z.enum(["left", "center", "right"]),
    direction: z.enum(["ltr", "rtl", "auto"]).default("auto"),
  })
  .strict();

const symbolElementSchema = baseElementSchema
  .extend({
    type: z.literal("symbol"),
    asset_id: z.string().min(1),
    scale: positiveNumber,
  })
  .strict();

const photoEtchElementSchema = baseElementSchema
  .extend({
    type: z.literal("photo_etch"),
    asset_url: z.string().min(1),
    shape: z.enum(["oval", "rect"]),
    width_in: positiveNumber,
    height_in: positiveNumber,
  })
  .strict();

const borderElementSchema = baseElementSchema
  .extend({
    type: z.literal("border"),
    style_id: z.string().min(1),
    inset_in: nonNegativeNumber,
    stroke_in: positiveNumber,
  })
  .strict();

const customArtElementSchema = baseElementSchema
  .extend({
    type: z.literal("custom_art"),
    asset_url: z.string().min(1),
    format: z.enum(["svg", "png", "jpg", "jpeg", "pdf"]),
    width_in: positiveNumber,
    height_in: positiveNumber,
    manual_review_approved: z.boolean(),
  })
  .strict();

export const designElementSchema = z.discriminatedUnion("type", [
  textElementSchema,
  symbolElementSchema,
  photoEtchElementSchema,
  borderElementSchema,
  customArtElementSchema,
]);

const guidesSchema = z
  .object({
    safe_margin_in: positiveNumber,
    grid_step_in: positiveNumber.optional(),
  })
  .strict();

export const designDocumentSchema = z
  .object({
    units: unitSchema,
    face: faceSchema,
    elements: z.array(designElementSchema),
    guides: guidesSchema,
  })
  .strict();

export type DesignDocument = z.infer<typeof designDocumentSchema>;
export type DesignElement = z.infer<typeof designElementSchema>;

export function parseDesignDocument(input: unknown): DesignDocument {
  return designDocumentSchema.parse(input);
}
