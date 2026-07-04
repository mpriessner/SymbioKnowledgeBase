import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

/** Called by the editor to upload files; `pos` is the drop position or null. */
export type UploadFilesFn = (files: File[], pos: number | null) => void;

export interface AttachmentUploadStorage {
  uploadFiles: UploadFilesFn | null;
  openImageDialog: (() => void) | null;
  openFilePicker: (() => void) | null;
}

declare module "@tiptap/core" {
  interface Storage {
    attachmentUpload: AttachmentUploadStorage;
  }
}

/**
 * Bridges React upload orchestration into the TipTap editor.
 *
 * The React `useAttachmentUpload` hook assigns callbacks onto this extension's
 * storage once the editor is ready. Two things consume them:
 *  - drag-drop / paste-image are handled here via a ProseMirror plugin so no
 *    editorProps wiring is needed in the editor component;
 *  - the slash-menu "Image"/"File" entries read the dialog/picker openers off
 *    `editor.storage.attachmentUpload`.
 *
 * Upload-first flow (no placeholder nodes): the plugin only forwards the files;
 * the hook inserts a node solely on upload success.
 */
export const AttachmentUpload = Extension.create<
  Record<string, never>,
  AttachmentUploadStorage
>({
  name: "attachmentUpload",

  addStorage() {
    return {
      uploadFiles: null,
      openImageDialog: null,
      openFilePicker: null,
    };
  },

  addProseMirrorPlugins() {
    // Tiptap idiom: plugin prop methods have their own `this`, so the
    // extension instance must be captured for the closures below.
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const extension = this;

    return [
      new Plugin({
        key: new PluginKey("attachmentUpload"),
        props: {
          handleDrop(view, event, _slice, moved) {
            // Internal node moves are not uploads.
            if (moved) return false;
            const files = event.dataTransfer?.files;
            if (!files || files.length === 0) return false;

            const upload = extension.storage.uploadFiles;
            if (!upload) return false;

            event.preventDefault();
            const pos =
              view.posAtCoords({
                left: event.clientX,
                top: event.clientY,
              })?.pos ?? null;
            upload(Array.from(files), pos);
            return true;
          },

          handlePaste(_view, event) {
            const files = event.clipboardData?.files;
            if (!files || files.length === 0) return false;
            // Only intercept pasted images; text/HTML paste is left untouched.
            const images = Array.from(files).filter((f) =>
              f.type.startsWith("image/")
            );
            if (images.length === 0) return false;

            const upload = extension.storage.uploadFiles;
            if (!upload) return false;

            event.preventDefault();
            upload(images, null);
            return true;
          },
        },
      }),
    ];
  },
});
