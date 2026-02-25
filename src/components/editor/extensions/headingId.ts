import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { slugifyHeading } from "@/lib/utils/slugify";

/**
 * TipTap extension that decorates heading DOM nodes with stable `id` attributes
 * based on slugified heading text. Enables anchor navigation and IntersectionObserver tracking.
 */
export const HeadingIdExtension = Extension.create({
  name: "headingId",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("headingId"),
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            const slugCounts = new Map<string, number>();

            state.doc.descendants((node, pos) => {
              if (node.type.name === "heading" && node.textContent.trim()) {
                const baseSlug = slugifyHeading(node.textContent.trim());
                const count = slugCounts.get(baseSlug) || 0;
                slugCounts.set(baseSlug, count + 1);
                const id = count === 0 ? baseSlug : `${baseSlug}-${count + 1}`;

                decorations.push(
                  Decoration.node(pos, pos + node.nodeSize, { id })
                );
              }
            });

            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});
