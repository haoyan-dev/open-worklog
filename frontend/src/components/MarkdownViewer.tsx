import { useEffect, useMemo } from "react";
import { Link, RichTextEditor, getTaskListExtension } from "@mantine/tiptap";
import { useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskItem from "@tiptap/extension-task-item";
import TipTapTaskList from "@tiptap/extension-task-list";
import { Markdown } from "@tiptap/markdown";

function getEditorMarkdown(editor: Editor): string {
  // TipTap Markdown exposes either `editor.getMarkdown()` or `editor.storage.markdown.getMarkdown()`
  const anyEditor = editor as any;
  if (typeof anyEditor.getMarkdown === "function") {
    return anyEditor.getMarkdown();
  }
  const fromStorage = anyEditor?.storage?.markdown?.getMarkdown;
  if (typeof fromStorage === "function") {
    return fromStorage.call(anyEditor.storage.markdown);
  }
  // Fallback (shouldn't happen when Markdown extension is configured)
  return editor.getText();
}

function setEditorMarkdown(editor: Editor, markdown: string) {
  const anyEditor = editor as any;
  // Newer API
  try {
    anyEditor.commands?.setContent?.(markdown, { contentType: "markdown" });
    return;
  } catch {
    // ignore
  }
  // Older API signature (emitUpdate, parseOptions)
  try {
    anyEditor.commands?.setContent?.(markdown, false, { contentType: "markdown" });
  } catch {
    anyEditor.commands?.setContent?.(markdown);
  }
}

export interface MarkdownViewerProps {
  value: string;
  /**
   * When true, task-list checkboxes can be toggled (no toolbar, no typing).
   * When false, the content is fully read-only.
   */
  enableTaskToggle?: boolean;
  /**
   * Only used when enableTaskToggle is true.
   * Called with the updated Markdown after a checkbox toggle.
   */
  onChange?: (markdown: string) => void;
}

export default function MarkdownViewer({
  value,
  enableTaskToggle = false,
  onChange,
}: MarkdownViewerProps) {
  const extensions = useMemo(() => {
    const base = [
      StarterKit.configure({ link: false }),
      Link,
      Markdown.configure({
        markedOptions: { gfm: true, breaks: true },
      }) as any,
    ];

    if (!enableTaskToggle) return base;

    return [
      ...base,
      getTaskListExtension(TipTapTaskList),
      TaskItem.configure({ nested: true }),
    ];
  }, [enableTaskToggle]);

  const editor = useEditor({
    shouldRerenderOnTransaction: true,
    extensions,
    content: value ?? "",
    contentType: "markdown" as any,
    editable: enableTaskToggle,
    // TipTap v3 expects editorProps to always be an object
    editorProps: enableTaskToggle
      ? {
          // Allow mouse interactions (checkbox toggle), but block editing via keyboard/paste/drop.
          handleDOMEvents: {
            keydown: () => true,
            paste: () => true,
            drop: () => true,
          },
        }
      : {},
    onUpdate: enableTaskToggle
      ? ({ editor }) => {
          if (!onChange) return;
          const next = getEditorMarkdown(editor);
          // Avoid spurious updates if nothing changed.
          if (next === (value ?? "")) return;
          onChange(next);
        }
      : undefined,
  });

  // Keep editor in sync when value changes externally (e.g. refetch after autosave).
  useEffect(() => {
    if (!editor) return;
    const current = getEditorMarkdown(editor);
    const next = value ?? "";
    if (current === next) return;
    setEditorMarkdown(editor, next);
  }, [editor, value]);

  return (
    <RichTextEditor
      editor={editor}
      withTypographyStyles={false}
      styles={{
        root: { border: 0 },
        content: { padding: 0 },
      }}
    >
      <RichTextEditor.Content style={{ minHeight: 0 }} />
    </RichTextEditor>
  );
}

