"use client";

import type { Column, PropertyValue } from "@/types/database";
import { TextEditor } from "./editors/TextEditor";
import { NumberEditor } from "./editors/NumberEditor";
import { SelectEditor } from "./editors/SelectEditor";
import { MultiSelectEditor } from "./editors/MultiSelectEditor";
import { DateEditor } from "./editors/DateEditor";
import { CheckboxEditor } from "./editors/CheckboxEditor";
import { URLEditor } from "./editors/URLEditor";

interface PropertyEditorProps {
  column: Column;
  value: PropertyValue | undefined;
  onSave: (value: PropertyValue) => void;
  onCancel: () => void;
}

export function PropertyEditor({
  column,
  value,
  onSave,
  onCancel,
}: PropertyEditorProps) {
  switch (column.type) {
    case "TITLE":
      return (
        <TextEditor
          value={value?.type === "TITLE" ? value.value : ""}
          onSave={(v) => onSave({ type: "TITLE", value: v })}
          onCancel={onCancel}
        />
      );

    case "TEXT":
      return (
        <TextEditor
          value={value?.type === "TEXT" ? value.value : ""}
          onSave={(v) => onSave({ type: "TEXT", value: v })}
          onCancel={onCancel}
        />
      );

    case "NUMBER":
      return (
        <NumberEditor
          value={value?.type === "NUMBER" ? value.value : 0}
          onSave={(v) => onSave({ type: "NUMBER", value: v })}
          onCancel={onCancel}
        />
      );

    case "SELECT":
      return (
        <SelectEditor
          value={value?.type === "SELECT" ? value.value : ""}
          options={column.options || []}
          onSave={(v) => onSave({ type: "SELECT", value: v })}
          onCancel={onCancel}
        />
      );

    case "MULTI_SELECT":
      return (
        <MultiSelectEditor
          value={value?.type === "MULTI_SELECT" ? value.value : []}
          options={column.options || []}
          onSave={(v) => onSave({ type: "MULTI_SELECT", value: v })}
          onCancel={onCancel}
        />
      );

    case "DATE":
      return (
        <DateEditor
          value={value?.type === "DATE" ? value.value : ""}
          onSave={(v) => onSave({ type: "DATE", value: v })}
          onCancel={onCancel}
        />
      );

    case "CHECKBOX":
      return (
        <CheckboxEditor
          value={value?.type === "CHECKBOX" ? value.value : false}
          onSave={(v) => onSave({ type: "CHECKBOX", value: v })}
        />
      );

    case "URL":
      return (
        <URLEditor
          value={value?.type === "URL" ? value.value : ""}
          onSave={(v) => onSave({ type: "URL", value: v })}
          onCancel={onCancel}
        />
      );

    default:
      return null;
  }
}
