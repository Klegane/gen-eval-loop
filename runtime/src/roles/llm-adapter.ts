import { z, type ZodTypeAny } from "zod";

export interface GenerateObjectRequest<TSchema extends ZodTypeAny> {
  schemaName: string;
  schema: TSchema;
  systemPrompt: string;
  userPrompt: string;
  model?: string | undefined;
  metadata?: Record<string, unknown>;
}

export interface GenerateObjectResponse<TOutput> {
  adapterName: string;
  output: TOutput;
  rawText?: string | undefined;
}

export interface LlmAdapter {
  readonly name: string;
  generateObject<TSchema extends ZodTypeAny>(
    request: GenerateObjectRequest<TSchema>,
  ): Promise<GenerateObjectResponse<z.output<TSchema>>>;
}
