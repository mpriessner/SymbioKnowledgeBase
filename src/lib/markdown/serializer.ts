import type { JSONContent } from "@tiptap/core";
import type { SerializerOptions, SerializationContext } from "./types";
import { generateFrontmatter } from "./frontmatter";

const DEFAULT_OPTIONS: SerializerOptions = {
  includeFrontmatter: true,
  escapeText: true,
};

/**
 * Converts TipTap JSON to Markdown.
 *
 * Handles all block types, marks, and special features (wikilinks, callouts).
 * Optionally includes YAML frontmatter with page metadata.
 */
export function tiptapToMarkdown(
  json: JSONContent,
  options: SerializerOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  let markdown = "";

  if (opts.includeFrontmatter && opts.metadata) {
    markdown += generateFrontmatter(opts.metadata);
  }

  const context: SerializationContext = {
    indent: 0,
    inList: false,
  };

  markdown += serializeNode(json, context, opts);

  // Normalize whitespace
  markdown = markdown.replace(/\n{3,}/g, "\n\n"); // Max 2 consecutive newlines
  markdown = markdown.replace(/[ \t]+\n/g, "\n"); // Remove trailing whitespace

  return markdown.trim() + "\n";
}

/**
 * Recursively serialize a TipTap node to markdown.
 */
function serializeNode(
  node: JSONContent,
  context: SerializationContext,
  options: SerializerOptions
): string {
  if (!node) return "";

  const { type, content, attrs, marks } = node;

  switch (type) {
    case "doc":
      return serializeChildren(content, context, options);

    case "paragraph": {
      const paragraphContent = serializeChildren(content, context, options);
      if (context.inList) {
        return paragraphContent;
      }
      return paragraphContent ? paragraphContent + "\n\n" : "";
    }

    case "heading": {
      const level = (attrs?.level as number) || 1;
      const headingText = serializeChildren(content, context, options);
      return "#".repeat(level) + " " + headingText + "\n\n";
    }

    case "bulletList":
      return serializeList(
        content,
        { ...context, listType: "bullet" },
        options
      );

    case "orderedList":
      return serializeList(
        content,
        { ...context, listType: "ordered", listIndex: 1 },
        options
      );

    case "taskList":
      return serializeList(
        content,
        { ...context, listType: "todo" },
        options
      );

    case "listItem":
      return serializeListItem(node, context, options);

    case "taskItem":
      return serializeTaskItem(node, context, options);

    case "codeBlock": {
      const language = (attrs?.language as string) || "";
      const code = getPlainText(content);
      return "```" + language + "\n" + code + "\n```\n\n";
    }

    case "blockquote": {
      const quoteLines = serializeChildren(content, context, options)
        .trim()
        .split("\n")
        .map((line) => "> " + line)
        .join("\n");
      return quoteLines + "\n\n";
    }

    case "callout": {
      const calloutType = (attrs?.type as string) || "info";
      const calloutTitle = (attrs?.title as string) || "";
      const calloutContent = serializeChildren(
        content,
        context,
        options
      ).trim();
      let callout = `> [!${calloutType}]`;
      if (calloutTitle) callout += " " + calloutTitle;
      callout += "\n";
      callout += calloutContent
        .split("\n")
        .map((line) => "> " + line)
        .join("\n");
      return callout + "\n\n";
    }

    case "toggle": {
      const toggleTitle = (attrs?.title as string) || "Toggle";
      const toggleContent = serializeChildren(
        content,
        context,
        options
      ).trim();
      return `<details>\n<summary>${toggleTitle}</summary>\n\n${toggleContent}\n</details>\n\n`;
    }

    case "horizontalRule":
      return "---\n\n";

    case "image": {
      const src = (attrs?.src as string) || "";
      const alt = (attrs?.alt as string) || "";
      return `![${alt}](${src})\n\n`;
    }

    case "wikilink": {
      const pageName = (attrs?.pageName as string) || "";
      const displayText = (attrs?.displayText as string) || null;
      return displayText
        ? `[[${pageName}|${displayText}]]`
        : `[[${pageName}]]`;
    }

    case "bookmark": {
      const url = (attrs?.url as string) || "";
      const title = (attrs?.title as string) || url;
      const description = (attrs?.description as string) || "";
      let bookmark = `[${title}](${url})`;
      if (description) {
        bookmark += `\n\n> ${description}`;
      }
      return bookmark + "\n\n";
    }

    case "table":
      return serializeTable(node, context, options);

    case "text": {
      let text = node.text || "";
      if (marks && marks.length > 0) {
        text = applyMarks(text, marks, options);
      } else if (options.escapeText && !context.inList) {
        // Only escape plain text (not code, not already marked)
      }
      return text;
    }

    case "hardBreak":
      return "\n";

    default:
      // Unknown node type — serialize children
      return serializeChildren(content, context, options);
  }
}

/**
 * Serialize child nodes.
 */
function serializeChildren(
  content: JSONContent[] | undefined,
  context: SerializationContext,
  options: SerializerOptions
): string {
  if (!content || content.length === 0) return "";
  return content
    .map((child) => serializeNode(child, context, options))
    .join("");
}

/**
 * Get plain text from content nodes (for code blocks where marks shouldn't apply).
 */
function getPlainText(content: JSONContent[] | undefined): string {
  if (!content) return "";
  return content
    .map((node) => {
      if (node.type === "text") return node.text || "";
      if (node.type === "hardBreak") return "\n";
      return getPlainText(node.content);
    })
    .join("");
}

/**
 * Serialize a list (bullet, ordered, or todo).
 */
function serializeList(
  items: JSONContent[] | undefined,
  context: SerializationContext,
  options: SerializerOptions
): string {
  if (!items || items.length === 0) return "";

  const listContext = {
    ...context,
    inList: true,
    indent: context.indent + 1,
  };
  let listIndex = context.listIndex || 1;

  return (
    items
      .map((item) => {
        const itemMarkdown = serializeNode(
          item,
          { ...listContext, listIndex },
          options
        );
        listIndex++;
        return itemMarkdown;
      })
      .join("") + "\n"
  );
}

/**
 * Serialize a list item.
 */
function serializeListItem(
  node: JSONContent,
  context: SerializationContext,
  options: SerializerOptions
): string {
  const indent = "  ".repeat(Math.max(0, context.indent - 1));
  const bullet =
    context.listType === "ordered" ? `${context.listIndex}.` : "-";
  const itemContent = serializeChildren(
    node.content,
    context,
    options
  ).trim();

  return `${indent}${bullet} ${itemContent}\n`;
}

/**
 * Serialize a task item (todo list).
 */
function serializeTaskItem(
  node: JSONContent,
  context: SerializationContext,
  options: SerializerOptions
): string {
  const indent = "  ".repeat(Math.max(0, context.indent - 1));
  const checked = node.attrs?.checked === true;
  const checkbox = checked ? "[x]" : "[ ]";
  const itemContent = serializeChildren(
    node.content,
    context,
    options
  ).trim();

  return `${indent}- ${checkbox} ${itemContent}\n`;
}

/**
 * Serialize a table.
 */
function serializeTable(
  node: JSONContent,
  context: SerializationContext,
  options: SerializerOptions
): string {
  const rows = node.content || [];
  if (rows.length === 0) return "";

  const headerRow = rows[0];
  const headerCells = (headerRow.content || [])
    .map((cell) =>
      serializeChildren(cell.content, context, options).trim()
    )
    .join(" | ");

  const colCount = headerRow.content?.length || 0;
  const separator =
    "| " + Array(colCount).fill("---").join(" | ") + " |";

  const dataRows = rows.slice(1).map((row) => {
    const cells = (row.content || [])
      .map((cell) =>
        serializeChildren(cell.content, context, options).trim()
      )
      .join(" | ");
    return "| " + cells + " |";
  });

  return (
    ["| " + headerCells + " |", separator, ...dataRows].join("\n") +
    "\n\n"
  );
}

/**
 * Apply marks (bold, italic, etc.) to text.
 */
function applyMarks(
  text: string,
  marks: NonNullable<JSONContent["marks"]>,
  _options: SerializerOptions
): string {
  for (const mark of [...marks].reverse()) {
    switch (mark.type) {
      case "bold":
        text = `**${text}**`;
        break;
      case "italic":
        text = `*${text}*`;
        break;
      case "strike":
        text = `~~${text}~~`;
        break;
      case "code":
        text = `\`${text}\``;
        break;
      case "link": {
        const href = (mark.attrs?.href as string) || "";
        text = `[${text}](${href})`;
        break;
      }
      case "highlight":
        text = `==${text}==`;
        break;
    }
  }

  return text;
}
