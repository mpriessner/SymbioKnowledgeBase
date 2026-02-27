import type { PageMetadata } from "./types";

/**
 * Generates YAML frontmatter from page metadata.
 */
export function generateFrontmatter(metadata: PageMetadata): string {
  const lines: string[] = ["---"];

  if (metadata.id) {
    lines.push(`id: ${escapeYamlString(metadata.id)}`);
  }

  lines.push(`title: ${escapeYamlString(metadata.title)}`);

  if (metadata.icon) {
    lines.push(`icon: ${metadata.icon}`);
  }

  if (metadata.oneLiner) {
    lines.push(`oneLiner: ${escapeYamlString(metadata.oneLiner)}`);
  }

  if (metadata.summary) {
    lines.push(`summary: ${escapeYamlString(metadata.summary)}`);
  }

  if (metadata.summary && metadata.summaryUpdatedAt) {
    lines.push(`summaryUpdatedAt: ${metadata.summaryUpdatedAt}`);
  }

  if (metadata.parent) {
    lines.push(`parent: ${metadata.parent}`);
  }

  if (metadata.position !== undefined) {
    lines.push(`position: ${metadata.position}`);
  }

  if (metadata.spaceType) {
    lines.push(`spaceType: ${metadata.spaceType}`);
  }

  lines.push(`created: ${metadata.created}`);
  lines.push(`updated: ${metadata.updated}`);

  if (metadata.tags && metadata.tags.length > 0) {
    lines.push(
      `tags: [${metadata.tags.map(escapeYamlString).join(", ")}]`
    );
  }

  lines.push("---");
  return lines.join("\n") + "\n\n";
}

/**
 * Parses YAML frontmatter from markdown string.
 * Returns the metadata object and the content without frontmatter.
 */
export function parseFrontmatter(markdown: string): {
  metadata: Partial<PageMetadata>;
  content: string;
} {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n/;
  const match = markdown.match(frontmatterRegex);

  if (!match) {
    return { metadata: {}, content: markdown };
  }

  const yamlContent = match[1];
  const content = markdown.slice(match[0].length);

  const metadata: Partial<PageMetadata> = {};
  const lines = yamlContent.split("\n");

  for (const line of lines) {
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();

    switch (key) {
      case "id":
        metadata.id = unescapeYamlString(value);
        break;
      case "title":
        metadata.title = unescapeYamlString(value);
        break;
      case "icon":
        metadata.icon = value;
        break;
      case "oneLiner": {
        const parsed = unescapeYamlString(value);
        metadata.oneLiner = parsed || null;
        break;
      }
      case "summary": {
        const parsed = unescapeYamlString(value);
        metadata.summary = parsed || null;
        break;
      }
      case "summaryUpdatedAt":
        metadata.summaryUpdatedAt = value || null;
        break;
      case "parent":
        metadata.parent = value;
        break;
      case "position":
        metadata.position = parseInt(value, 10);
        break;
      case "spaceType":
        metadata.spaceType = value;
        break;
      case "created":
        metadata.created = value;
        break;
      case "updated":
        metadata.updated = value;
        break;
      case "tags": {
        const tagsMatch = value.match(/\[(.*?)\]/);
        if (tagsMatch) {
          metadata.tags = tagsMatch[1]
            .split(",")
            .map((t) => unescapeYamlString(t.trim()));
        }
        break;
      }
    }
  }

  return { metadata, content };
}

function escapeYamlString(str: string): string {
  if (/[:\[\]{}#&*!|>'"%@`]/.test(str)) {
    return `"${str.replace(/"/g, '\\"')}"`;
  }
  return str;
}

function unescapeYamlString(str: string): string {
  if (str.startsWith('"') && str.endsWith('"')) {
    return str.slice(1, -1).replace(/\\"/g, '"');
  }
  return str;
}
