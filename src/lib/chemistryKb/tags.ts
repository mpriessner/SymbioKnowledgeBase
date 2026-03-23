import { TAG_NAMESPACES, type TagNamespace } from "./types";

export { TAG_NAMESPACES };

export interface ParsedTag {
  namespace: string;
  value: string;
}

const VALID_NAMESPACE_PREFIXES = Object.values(TAG_NAMESPACES);

export function createTag(namespace: TagNamespace, value: string): string {
  if (!value || value.trim().length === 0) {
    throw new Error("Tag value must not be empty");
  }
  return `${namespace}${value}`;
}

export function parseTag(tag: string): ParsedTag {
  const matchedNamespace = VALID_NAMESPACE_PREFIXES.find((ns) =>
    tag.startsWith(ns)
  );

  if (!matchedNamespace) {
    return { namespace: "", value: tag };
  }

  return {
    namespace: matchedNamespace,
    value: tag.slice(matchedNamespace.length),
  };
}

export function isNamespacedTag(tag: string): boolean {
  return VALID_NAMESPACE_PREFIXES.some((ns) => tag.startsWith(ns));
}

export function isValidTagFormat(tag: string): boolean {
  if (!tag || tag.trim().length === 0) return false;
  if (!isNamespacedTag(tag)) return true; // bare tags like "chemical" are valid

  const parsed = parseTag(tag);
  return parsed.value.length > 0;
}

export function getTagsByNamespace(
  tags: string[],
  namespace: TagNamespace
): string[] {
  return tags
    .filter((tag) => tag.startsWith(namespace))
    .map((tag) => tag.slice(namespace.length));
}
