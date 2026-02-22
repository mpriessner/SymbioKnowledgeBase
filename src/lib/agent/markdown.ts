import type { JsonValue } from "@/generated/prisma/client/runtime/library";

/**
 * Convert TipTap JSON document to Markdown string.
 * Placeholder — full implementation in EPIC-14 (SKB-14.1).
 */
export function tiptapToMarkdown(doc: JsonValue): string {
  if (!doc || typeof doc !== "object") return "";

  const root = doc as Record<string, unknown>;
  const content = root.content as Array<Record<string, unknown>> | undefined;
  if (!content || !Array.isArray(content)) return "";

  return content
    .map((node) => nodeToMarkdown(node))
    .filter(Boolean)
    .join("\n\n");
}

function nodeToMarkdown(node: Record<string, unknown>): string {
  const type = node.type as string;
  const children = node.content as Array<Record<string, unknown>> | undefined;

  switch (type) {
    case "heading": {
      const level = (node.attrs as Record<string, unknown>)?.level as number;
      const prefix = "#".repeat(level || 1);
      return `${prefix} ${getTextContent(children)}`;
    }
    case "paragraph":
      return getTextContent(children);
    case "bulletList":
      return (children || [])
        .map((item) => {
          const itemContent = item.content as
            | Array<Record<string, unknown>>
            | undefined;
          return `- ${getTextContent(itemContent?.[0]?.content as Array<Record<string, unknown>> | undefined)}`;
        })
        .join("\n");
    case "orderedList":
      return (children || [])
        .map((item, i) => {
          const itemContent = item.content as
            | Array<Record<string, unknown>>
            | undefined;
          return `${i + 1}. ${getTextContent(itemContent?.[0]?.content as Array<Record<string, unknown>> | undefined)}`;
        })
        .join("\n");
    case "codeBlock": {
      const lang =
        ((node.attrs as Record<string, unknown>)?.language as string) || "";
      return `\`\`\`${lang}\n${getTextContent(children)}\n\`\`\``;
    }
    case "blockquote":
      return (children || [])
        .map((child) => `> ${nodeToMarkdown(child)}`)
        .join("\n");
    case "horizontalRule":
      return "---";
    default:
      return getTextContent(children);
  }
}

function getTextContent(
  nodes: Array<Record<string, unknown>> | undefined
): string {
  if (!nodes) return "";
  return nodes
    .map((node) => {
      if (node.type === "text") {
        let text = (node.text as string) || "";
        const marks = node.marks as Array<Record<string, unknown>> | undefined;
        if (marks) {
          for (const mark of marks) {
            switch (mark.type) {
              case "bold":
                text = `**${text}**`;
                break;
              case "italic":
                text = `*${text}*`;
                break;
              case "code":
                text = `\`${text}\``;
                break;
              case "strike":
                text = `~~${text}~~`;
                break;
              case "link": {
                const href = (mark.attrs as Record<string, unknown>)
                  ?.href as string;
                text = `[${text}](${href})`;
                break;
              }
            }
          }
        }
        return text;
      }
      if (node.type === "hardBreak") return "\n";
      return "";
    })
    .join("");
}

/**
 * Convert Markdown string to TipTap JSON document.
 * Placeholder — full implementation in EPIC-14 (SKB-14.2).
 */
export function markdownToTiptap(markdown: string): JsonValue {
  const lines = markdown.split("\n");
  const content: Array<Record<string, unknown>> = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Headings
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      content.push({
        type: "heading",
        attrs: { level: headingMatch[1].length },
        content: [{ type: "text", text: headingMatch[2] }],
      });
      continue;
    }

    // Paragraphs
    content.push({
      type: "paragraph",
      content: [{ type: "text", text: trimmed }],
    });
  }

  return {
    type: "doc",
    content:
      content.length > 0
        ? content
        : [{ type: "paragraph", content: [{ type: "text", text: "" }] }],
  };
}
