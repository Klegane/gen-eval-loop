import { formatRunTimestamp } from "./timestamps";

const NON_ALPHANUMERIC = /[^a-z0-9]+/g;
const MULTI_HYPHEN = /-+/g;
const EDGE_HYPHEN = /^-|-$/g;

export function slugify(value: string, maxLength: number = 48): string {
  const normalized = value
    .toLowerCase()
    .replace(NON_ALPHANUMERIC, "-")
    .replace(MULTI_HYPHEN, "-")
    .replace(EDGE_HYPHEN, "");

  const trimmed = normalized.slice(0, maxLength).replace(EDGE_HYPHEN, "");
  return trimmed.length > 0 ? trimmed : "run";
}

export function createRunIdFromPrompt(prompt: string, date: Date = new Date()): string {
  return `${slugify(prompt)}-${formatRunTimestamp(date)}`;
}
