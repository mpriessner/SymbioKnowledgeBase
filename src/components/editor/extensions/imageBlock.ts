import Image from "@tiptap/extension-image";

/**
 * Configured Image extension.
 *
 * For MVP, images are inserted via URL. File upload support can be
 * added in a future iteration by handling paste/drop events.
 *
 * The inline: false setting ensures images are block-level elements
 * rather than inline images within paragraphs.
 */
export const ConfiguredImage = Image.configure({
  inline: false,
  allowBase64: false,
  HTMLAttributes: {
    class: "editor-image rounded-lg max-w-full mx-auto my-4",
    loading: "lazy",
  },
});
