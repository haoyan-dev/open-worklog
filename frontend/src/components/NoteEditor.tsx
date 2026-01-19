import { useEffect, useMemo, type ReactNode } from "react";
import { Input } from "@mantine/core";
import { Link, RichTextEditor } from "@mantine/tiptap";
import { useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
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

export interface NoteEditorProps {
  label: string;
  value: string;
  onChange: (markdown: string) => void;
  required?: boolean;
  error?: ReactNode;
  placeholder?: string;
  minHeight?: number;
}

export default function NoteEditor({
  label,
  value,
  onChange,
  required,
  error,
  placeholder,
  minHeight = 120,
}: NoteEditorProps) {
  const extensions = useMemo(
    () => [
      StarterKit.configure({ link: false }),
      Link,
      Placeholder.configure({ placeholder: placeholder ?? "" }),
      Markdown.configure({
        markedOptions: { gfm: true, breaks: true },
      }) as any,
    ],
    [placeholder]
  );

  const editor = useEditor({
    shouldRerenderOnTransaction: true,
    extensions,
    content: value ?? "",
    // TipTap Markdown uses this to parse initial content as Markdown
    contentType: "markdown" as any,
    onUpdate: ({ editor }) => {
      onChange(getEditorMarkdown(editor));
    },
  });

  // Keep editor in sync when value changes externally (e.g. editing a different entry)
  useEffect(() => {
    if (!editor) return;
    const current = getEditorMarkdown(editor);
    const next = value ?? "";
    if (current === next) return;
    setEditorMarkdown(editor, next);
  }, [editor, value]);

  return (
    <Input.Wrapper label={label} required={required} error={error}>
      <RichTextEditor editor={editor} withTypographyStyles={false}>
        <RichTextEditor.Toolbar sticky stickyOffset={0}>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.Bold />
            <RichTextEditor.Italic />
            <RichTextEditor.Underline />
            <RichTextEditor.Strikethrough />
          </RichTextEditor.ControlsGroup>

          <RichTextEditor.ControlsGroup>
            <RichTextEditor.BulletList />
            <RichTextEditor.OrderedList />
          </RichTextEditor.ControlsGroup>

          <RichTextEditor.ControlsGroup>
            <RichTextEditor.Link />
            <RichTextEditor.Unlink />
          </RichTextEditor.ControlsGroup>

          <RichTextEditor.ControlsGroup>
            <RichTextEditor.Undo />
            <RichTextEditor.Redo />
          </RichTextEditor.ControlsGroup>
        </RichTextEditor.Toolbar>

        <RichTextEditor.Content style={{ minHeight }} />
      </RichTextEditor>
    </Input.Wrapper>
  );
}

