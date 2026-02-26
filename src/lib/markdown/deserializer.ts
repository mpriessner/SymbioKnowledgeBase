import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import type { JSONContent } from "@tiptap/core";
import type { DeserializeResult } from "./types";
import { parseFrontmatter } from "./frontmatter";

/**
 * Convert markdown to TipTap JSON document.
 *
 * Uses remark/unified to parse markdown to AST, then transforms
 * the AST into TipTap-compatible JSONContent.
 */
export function markdownToTiptap(markdown: string): DeserializeResult {
  // 1. Parse frontmatter
  const { metadata, content } = parseFrontmatter(markdown);

  // 2. Pre-process custom syntax: wikilinks [[...]] and highlights ==...==
  const processed = preprocessCustomSyntax(content);

  // 3. Parse markdown to AST
  const processor = unified().use(remarkParse).use(remarkGfm);
  const ast = processor.parse(processed);

  // 4. Convert AST to TipTap JSON
  const tiptapJson = astToTiptap(ast as unknown as MdastNode);

  return { content: tiptapJson, metadata };
}

// Remark AST node types
interface MdastNode {
  type: string;
  children?: MdastNode[];
  value?: string;
  depth?: number;
  ordered?: boolean;
  checked?: boolean | null;
  lang?: string | null;
  url?: string;
  title?: string | null;
  alt?: string | null;
  align?: (string | null)[];
}

/**
 * Pre-process wikilinks and highlight marks to formats remark can handle.
 * Wikilinks: [[Page Name]] → <wikilink> HTML placeholder
 * Highlights: ==text== → <mark> HTML placeholder
 */
function preprocessCustomSyntax(content: string): string {
  // 1. Wikilinks: [[Page Name]] or [[Page Name|Display Text]]
  let result = content.replace(
    /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g,
    (_match, pageName: string, displayText?: string) => {
      const encoded = encodeURIComponent(pageName);
      const display = displayText
        ? encodeURIComponent(displayText)
        : "";
      return `<wikilink data-page="${encoded}" data-display="${display}"></wikilink>`;
    }
  );

  // 2. Highlights: ==text== → self-closing HTML placeholder
  result = result.replace(
    /==((?:(?!==).)+)==/g,
    (_match, text: string) => {
      const encoded = encodeURIComponent(text);
      return `<highlight data-text="${encoded}"></highlight>`;
    }
  );

  return result;
}

/**
 * Convert remark AST to TipTap JSONContent.
 */
function astToTiptap(node: MdastNode): JSONContent {
  return {
    type: "doc",
    content: convertChildren(node),
  };
}

function convertChildren(node: MdastNode): JSONContent[] {
  if (!node.children) return [];

  const result: JSONContent[] = [];
  let i = 0;

  while (i < node.children.length) {
    const child = node.children[i];

    // Detect toggle pattern: <details>...<summary> HTML node,
    // followed by content nodes, followed by </details> HTML node.
    if (
      child.type === "html" &&
      child.value?.includes("<details>") &&
      !child.value?.includes("</details>")
    ) {
      const summaryMatch = child.value.match(
        /<summary>([\s\S]*?)<\/summary>/
      );
      const title = summaryMatch?.[1] || "Toggle";
      const toggleContent: JSONContent[] = [];
      i++;

      // Collect nodes until </details>
      while (i < node.children.length) {
        const inner = node.children[i];
        if (inner.type === "html" && inner.value?.includes("</details>")) {
          i++;
          break;
        }
        const converted = convertNode(inner);
        if (converted) toggleContent.push(converted);
        i++;
      }

      result.push({
        type: "toggle",
        attrs: { title },
        content:
          toggleContent.length > 0
            ? toggleContent
            : [{ type: "paragraph", content: [] }],
      });
      continue;
    }

    const converted = convertNode(child);
    if (converted) result.push(converted);
    i++;
  }

  return result;
}

function convertNode(node: MdastNode): JSONContent | null {
  switch (node.type) {
    case "heading":
      return {
        type: "heading",
        attrs: { level: node.depth || 1 },
        content: convertInlineChildren(node),
      };

    case "paragraph": {
      const inlineContent = convertInlineChildren(node);
      if (inlineContent.length === 0) return null;
      return {
        type: "paragraph",
        content: inlineContent,
      };
    }

    case "list": {
      if (node.ordered) {
        return {
          type: "orderedList",
          content: convertChildren(node),
        };
      }
      // Check if it's a task list by looking at children
      const isTaskList = node.children?.some(
        (child) => child.checked !== undefined && child.checked !== null
      );
      if (isTaskList) {
        return {
          type: "taskList",
          content: convertChildren(node),
        };
      }
      return {
        type: "bulletList",
        content: convertChildren(node),
      };
    }

    case "listItem": {
      if (node.checked !== undefined && node.checked !== null) {
        return {
          type: "taskItem",
          attrs: { checked: node.checked },
          content: convertChildren(node),
        };
      }
      return {
        type: "listItem",
        content: convertChildren(node),
      };
    }

    case "code":
      return {
        type: "codeBlock",
        attrs: { language: node.lang || "" },
        content: node.value
          ? [{ type: "text", text: node.value }]
          : [],
      };

    case "blockquote": {
      // Check for callout syntax: > [!type] Title
      const firstChild = node.children?.[0];
      if (firstChild?.type === "paragraph" && firstChild.children?.[0]) {
        const firstText = firstChild.children[0];
        if (firstText.type === "text" && firstText.value) {
          const calloutMatch = firstText.value.match(
            /^\[!(\w+)\]\s*(.*)/
          );
          if (calloutMatch) {
            const calloutType = calloutMatch[1];
            const calloutTitle = calloutMatch[2] || "";
            // Remove the callout marker from content
            const remainingChildren = [...(node.children || [])];
            if (
              firstChild.children &&
              firstChild.children.length === 1
            ) {
              remainingChildren.shift();
            }
            return {
              type: "callout",
              attrs: { type: calloutType, title: calloutTitle },
              content:
                remainingChildren.length > 0
                  ? remainingChildren
                      .map((c) => convertNode(c))
                      .filter(
                        (n): n is JSONContent => n !== null
                      )
                  : [
                      {
                        type: "paragraph",
                        content: [],
                      },
                    ],
            };
          }
        }
      }
      return {
        type: "blockquote",
        content: convertChildren(node),
      };
    }

    case "thematicBreak":
      return { type: "horizontalRule" };

    case "image":
      return {
        type: "image",
        attrs: {
          src: node.url || "",
          alt: node.alt || "",
          title: node.title || null,
        },
      };

    case "table":
      return convertTable(node);

    case "html": {
      // Handle our wikilink placeholders
      const wikilinkMatch = node.value?.match(
        /<wikilink data-page="([^"]*)" data-display="([^"]*)">/
      );
      if (wikilinkMatch) {
        const pageName = decodeURIComponent(wikilinkMatch[1]);
        const displayText = wikilinkMatch[2]
          ? decodeURIComponent(wikilinkMatch[2])
          : null;
        return {
          type: "wikilink",
          attrs: { pageName, displayText },
        };
      }
      // Handle <details> (toggle) — remark splits the HTML block
      // into: <details>\n<summary>Title</summary> as one HTML node,
      // then content as regular nodes, then </details> as another HTML node.
      // We handle the opening tag here; content is collected by the parent
      // converter via collectToggleContent().
      if (node.value?.includes("<details>")) {
        const summaryMatch = node.value.match(
          /<summary>([\s\S]*?)<\/summary>/
        );
        // Check if this is a self-contained toggle (all in one HTML block)
        const fullMatch = node.value.match(
          /<details>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/
        );
        if (fullMatch) {
          const title = fullMatch[1] || "Toggle";
          const innerMd = fullMatch[2].trim();
          if (innerMd) {
            const innerResult = markdownToTiptap(innerMd);
            return {
              type: "toggle",
              attrs: { title },
              content: innerResult.content.content || [
                { type: "paragraph", content: [] },
              ],
            };
          }
          return {
            type: "toggle",
            attrs: { title },
            content: [{ type: "paragraph", content: [] }],
          };
        }
        return {
          type: "toggle",
          attrs: {
            title: summaryMatch?.[1] || "Toggle",
          },
          content: [], // Will be filled by collectToggleContent
        };
      }
      return null;
    }

    default:
      return null;
  }
}

/**
 * Convert inline children (text, emphasis, strong, code, links, etc.)
 */
function convertInlineChildren(node: MdastNode): JSONContent[] {
  if (!node.children) return [];
  const result: JSONContent[] = [];

  for (const child of node.children) {
    const inline = convertInlineNode(child);
    if (inline) result.push(...inline);
  }

  return result;
}

function convertInlineNode(
  node: MdastNode,
  parentMarks: JSONContent["marks"] = []
): JSONContent[] | null {
  switch (node.type) {
    case "text":
      return [
        {
          type: "text",
          text: node.value || "",
          ...(parentMarks && parentMarks.length > 0
            ? { marks: parentMarks }
            : {}),
        },
      ];

    case "strong": {
      const marks = [...(parentMarks || []), { type: "bold" }];
      return flatMapChildren(node, marks);
    }

    case "emphasis": {
      const marks = [...(parentMarks || []), { type: "italic" }];
      return flatMapChildren(node, marks);
    }

    case "delete": {
      const marks = [...(parentMarks || []), { type: "strike" }];
      return flatMapChildren(node, marks);
    }

    case "inlineCode":
      return [
        {
          type: "text",
          text: node.value || "",
          marks: [
            ...(parentMarks || []),
            { type: "code" },
          ],
        },
      ];

    case "link": {
      const marks = [
        ...(parentMarks || []),
        {
          type: "link",
          attrs: { href: node.url || "", target: null },
        },
      ];
      return flatMapChildren(node, marks);
    }

    case "html": {
      // Handle wikilink placeholders inline
      const wikilinkMatch = node.value?.match(
        /<wikilink data-page="([^"]*)" data-display="([^"]*)">/
      );
      if (wikilinkMatch) {
        const pageName = decodeURIComponent(wikilinkMatch[1]);
        const displayText = wikilinkMatch[2]
          ? decodeURIComponent(wikilinkMatch[2])
          : null;
        return [
          {
            type: "wikilink",
            attrs: { pageName, displayText },
          },
        ];
      }
      // Handle <highlight> placeholder for ==text==
      const highlightMatch = node.value?.match(
        /<highlight data-text="([^"]*)">/
      );
      if (highlightMatch) {
        return [
          {
            type: "text",
            text: decodeURIComponent(highlightMatch[1]),
            marks: [
              ...(parentMarks || []),
              { type: "highlight" },
            ],
          },
        ];
      }
      return null;
    }

    case "break":
      return [{ type: "hardBreak" }];

    case "image":
      return [
        {
          type: "image",
          attrs: {
            src: node.url || "",
            alt: node.alt || "",
          },
        },
      ];

    default:
      return null;
  }
}

function flatMapChildren(
  node: MdastNode,
  marks: JSONContent["marks"]
): JSONContent[] {
  if (!node.children) return [];
  const result: JSONContent[] = [];
  for (const child of node.children) {
    const inline = convertInlineNode(child, marks);
    if (inline) result.push(...inline);
  }
  return result;
}

/**
 * Convert a table AST node.
 */
function convertTable(node: MdastNode): JSONContent {
  const rows = (node.children || []).map((row, rowIndex) => {
    const cells = (row.children || []).map((cell) => ({
      type: rowIndex === 0 ? "tableHeader" : "tableCell",
      content: [
        {
          type: "paragraph" as const,
          content: convertInlineChildren(cell),
        },
      ],
    }));
    return { type: "tableRow", content: cells };
  });

  return { type: "table", content: rows };
}
