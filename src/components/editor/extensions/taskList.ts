import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import type { Extensions } from "@tiptap/react";

/**
 * Configures the TaskList and TaskItem extensions for to-do list blocks.
 *
 * TaskItem is configured with nested: true to allow sub-tasks.
 * The checkbox toggle is handled by TipTap's built-in click handler.
 */
export function getTaskListExtensions(): Extensions {
  return [
    TaskList.configure({
      HTMLAttributes: {
        class: "task-list",
      },
    }),
    TaskItem.configure({
      nested: true,
      HTMLAttributes: {
        class: "task-item",
      },
    }),
  ];
}
