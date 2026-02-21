import { z } from "zod";

/**
 * Supported property types for database columns.
 */
export const PropertyType = {
  TITLE: "TITLE",
  TEXT: "TEXT",
  NUMBER: "NUMBER",
  SELECT: "SELECT",
  MULTI_SELECT: "MULTI_SELECT",
  DATE: "DATE",
  CHECKBOX: "CHECKBOX",
  URL: "URL",
} as const;

export type PropertyType = (typeof PropertyType)[keyof typeof PropertyType];

/**
 * A single column definition in the database schema.
 */
export const ColumnSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  type: z.enum([
    "TITLE",
    "TEXT",
    "NUMBER",
    "SELECT",
    "MULTI_SELECT",
    "DATE",
    "CHECKBOX",
    "URL",
  ]),
  options: z.array(z.string()).optional(), // For SELECT and MULTI_SELECT
});

export type Column = z.infer<typeof ColumnSchema>;

/**
 * The database schema stored in the JSONB column.
 * Must have exactly one TITLE column.
 */
export const DatabaseSchemaDefinition = z
  .object({
    columns: z.array(ColumnSchema).min(1),
  })
  .refine(
    (schema) =>
      schema.columns.filter((c) => c.type === "TITLE").length === 1,
    { message: "Database schema must have exactly one TITLE column" }
  );

export type DatabaseSchema = z.infer<typeof DatabaseSchemaDefinition>;

/**
 * A single property value stored in db_rows.properties.
 */
export const PropertyValueSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("TITLE"), value: z.string() }),
  z.object({ type: z.literal("TEXT"), value: z.string() }),
  z.object({ type: z.literal("NUMBER"), value: z.number() }),
  z.object({ type: z.literal("SELECT"), value: z.string() }),
  z.object({
    type: z.literal("MULTI_SELECT"),
    value: z.array(z.string()),
  }),
  z.object({ type: z.literal("DATE"), value: z.string() }), // ISO date string
  z.object({ type: z.literal("CHECKBOX"), value: z.boolean() }),
  z.object({ type: z.literal("URL"), value: z.string().url() }),
]);

export type PropertyValue = z.infer<typeof PropertyValueSchema>;

/**
 * The properties JSONB stored on a db_row.
 * Keys are column IDs, values are typed property values.
 */
export const RowPropertiesSchema = z.record(z.string(), PropertyValueSchema);

export type RowProperties = z.infer<typeof RowPropertiesSchema>;

/**
 * API request for creating a new database.
 */
export const CreateDatabaseSchema = z.object({
  pageId: z.string().uuid(),
  schema: DatabaseSchemaDefinition,
});

/**
 * API request for updating a database schema.
 */
export const UpdateDatabaseSchema = z.object({
  schema: DatabaseSchemaDefinition,
});

/**
 * API request for creating a new row.
 */
export const CreateRowSchema = z.object({
  properties: RowPropertiesSchema,
});

/**
 * API request for updating a row.
 */
export const UpdateRowSchema = z.object({
  properties: RowPropertiesSchema,
});
