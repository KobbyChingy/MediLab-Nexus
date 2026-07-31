import { Extension, mergeAttributes, Node as TiptapNode } from "@tiptap/core";
import { Color } from "@tiptap/extension-color";
import { Highlight } from "@tiptap/extension-highlight";
import { Image } from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableRow } from "@tiptap/extension-table-row";
import { TextAlign } from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { Underline } from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef, useState } from "react";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (fontSize: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
    pageBreak: {
      insertPageBreak: () => ReturnType;
    };
    reportImage: {
      setImageAlignment: (alignment: "left" | "center" | "right") => ReturnType;
      setImageWidth: (width: string) => ReturnType;
      insertImageCaption: () => ReturnType;
    };
  }
}

const fontSizeOptions = ["12px", "14px", "16px", "18px", "20px", "24px"];
const textColorOptions = ["#10233d", "#0f6bff", "#0a855f", "#b45309", "#9f1239", "#7c3aed"];
const highlightColorOptions = ["#fff59d", "#c8f7dc", "#bfdbfe", "#fed7aa", "#fbcfe8"];

const ReportImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: "70%",
        parseHTML: (element: HTMLElement) => element.getAttribute("data-width") || element.style.width || "70%",
        renderHTML: (attributes: { width?: string | null }) => ({
          "data-width": attributes.width || "70%",
        }),
      },
      align: {
        default: "center",
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-align") || "center",
        renderHTML: (attributes: { align?: string | null }) => ({
          "data-align": attributes.align || "center",
        }),
      },
    };
  },
  renderHTML({ HTMLAttributes }) {
    const align =
      HTMLAttributes["data-align"] === "left" ||
      HTMLAttributes["data-align"] === "right" ||
      HTMLAttributes["data-align"] === "center"
        ? HTMLAttributes["data-align"]
        : "center";
    const width = HTMLAttributes["data-width"] || "70%";
    const marginStyle =
      align === "left"
        ? "margin: 0.9rem auto 0.9rem 0;"
        : align === "right"
          ? "margin: 0.9rem 0 0.9rem auto;"
          : "margin: 0.9rem auto;";

    return [
      "img",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        style: `display:block; width:${width}; max-width:100%; height:auto; ${marginStyle}`,
      }),
    ];
  },
  addCommands() {
    return {
      ...this.parent?.(),
      setImageAlignment:
        (alignment: "left" | "center" | "right") =>
        ({ commands }) =>
          commands.updateAttributes("image", { align: alignment }),
      setImageWidth:
        (width: string) =>
        ({ commands }) =>
          commands.updateAttributes("image", { width }),
      insertImageCaption:
        () =>
        ({ chain }) =>
          chain()
            .focus()
            .insertContent(
              '<p style="text-align:center;"><em>Image caption</em></p>',
            )
            .run(),
    };
  },
});

const PageBreak = TiptapNode.create({
  name: "pageBreak",
  group: "block",
  atom: true,
  selectable: true,

  parseHTML() {
    return [{ tag: "div[data-page-break='true']" }];
  },

  renderHTML() {
    return [
      "div",
      {
        "data-page-break": "true",
        class: "editor-page-break",
      },
    ];
  },

  addCommands() {
    return {
      insertPageBreak:
        () =>
        ({ commands }) =>
          commands.insertContent([
            { type: this.name },
            { type: "paragraph" },
          ]),
    };
  },
});

const FontSize = Extension.create({
  name: "fontSize",
  addOptions() {
    return {
      types: ["textStyle"],
    };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.fontSize || null,
            renderHTML: (attributes: { fontSize?: string | null }) => {
              if (!attributes.fontSize) {
                return {};
              }

              return {
                style: `font-size: ${attributes.fontSize}`,
              };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontSize }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run(),
    };
  },
});

type RichTextEditorProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  documentMode?: boolean;
};

function ToolbarButton({
  label,
  onClick,
  active = false,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`editor-tool-button${active ? " is-active" : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
}

export function RichTextEditor({
  label,
  value,
  onChange,
  disabled = false,
  placeholder,
  className = "",
  documentMode = false,
}: RichTextEditorProps) {
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const contentClassName = documentMode
    ? "rich-text-editor__content rich-text-editor__content--document ProseMirror"
    : "rich-text-editor__content ProseMirror";
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      Highlight.configure({
        multicolor: true,
      }),
      ReportImage.configure({
        allowBase64: true,
        resize: {
          enabled: true,
          minWidth: 120,
          minHeight: 80,
          alwaysPreserveAspectRatio: true,
        },
      }),
      FontSize,
      PageBreak,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value || "<p></p>",
    editable: !disabled,
    editorProps: {
      attributes: {
        class: contentClassName,
        "data-placeholder": placeholder || "",
      },
    },
    onUpdate: ({ editor: nextEditor }) => {
      onChange(nextEditor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    editor.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const currentHtml = editor.getHTML();
    const nextValue = value || "<p></p>";
    if (currentHtml !== nextValue) {
      editor.commands.setContent(nextValue, { emitUpdate: false });
    }
  }, [editor, value]);

  const activeFontSize =
    (editor?.getAttributes("textStyle").fontSize as string | undefined) || "16px";
  const activeTextColor =
    (editor?.getAttributes("textStyle").color as string | undefined) || "#10233d";
  const activeHighlightColor =
    (editor?.getAttributes("highlight").color as string | undefined) || "#fff59d";

  async function handleImageSelection(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const [file] = Array.from(event.target.files ?? []);
    if (!file || !editor) {
      return;
    }

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === "string") {
            resolve(reader.result);
            return;
          }
          reject(new Error("Image could not be loaded."));
        };
        reader.onerror = () => reject(new Error("Image could not be loaded."));
        reader.readAsDataURL(file);
      });

      editor
        .chain()
        .focus()
        .setImage({
          src: dataUrl,
          alt: file.name,
          title: file.name,
        })
        .run();
    } finally {
      event.target.value = "";
    }
  }

  function handleHeadingChange(value: string) {
    if (!editor) {
      return;
    }

    const chain = editor.chain().focus();
    if (value === "paragraph") {
      chain.setParagraph().run();
      return;
    }

    const level = Number(value.replace("h", ""));
    if (level >= 1 && level <= 3) {
      chain.toggleHeading({ level: level as 1 | 2 | 3 }).run();
    }
  }

  const activeHeading = editor?.isActive("heading", { level: 1 })
    ? "h1"
    : editor?.isActive("heading", { level: 2 })
      ? "h2"
      : editor?.isActive("heading", { level: 3 })
        ? "h3"
        : "paragraph";

  return (
    <div
      className={`full-width rich-text-field ${documentMode ? "rich-text-field--document" : ""} ${className}`.trim()}
    >
      <span>{label}</span>
      <div className={`rich-text-editor${disabled ? " is-disabled" : ""}`}>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => void handleImageSelection(event)}
          disabled={disabled}
        />
        <div className="rich-text-editor__toolbar-header">
          <span className="rich-text-editor__toolbar-title">Formatting tools</span>
          <button
            type="button"
            className="ghost-action small rich-text-editor__toolbar-toggle"
            onClick={() => setToolbarVisible((current) => !current)}
            aria-expanded={toolbarVisible}
            aria-controls={`${label}-toolbar`}
          >
            {toolbarVisible ? "Hide tools" : "Show tools"}
          </button>
        </div>
        <div
          id={`${label}-toolbar`}
          className={`rich-text-editor__toolbar${toolbarVisible ? "" : " is-hidden"}`}
          hidden={!toolbarVisible}
        >
          <select
            value={activeHeading}
            onChange={(event) => handleHeadingChange(event.target.value)}
            disabled={disabled || !editor}
            aria-label={`${label} heading level`}
          >
            <option value="paragraph">Paragraph</option>
            <option value="h1">Heading 1</option>
            <option value="h2">Heading 2</option>
            <option value="h3">Heading 3</option>
          </select>
          <select
            value={activeFontSize}
            onChange={(event) => editor?.chain().focus().setFontSize(event.target.value).run()}
            disabled={disabled || !editor}
            aria-label={`${label} font size`}
          >
            {fontSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <label className="editor-color-control">
            <span>Text</span>
            <input
              type="color"
              value={activeTextColor}
              list="editor-text-colors"
              onChange={(event) => editor?.chain().focus().setColor(event.target.value).run()}
              disabled={disabled || !editor}
              aria-label={`${label} text color`}
            />
          </label>
          <label className="editor-color-control">
            <span>Highlight</span>
            <input
              type="color"
              value={activeHighlightColor}
              list="editor-highlight-colors"
              onChange={(event) =>
                editor?.chain().focus().setHighlight({ color: event.target.value }).run()
              }
              disabled={disabled || !editor}
              aria-label={`${label} highlight color`}
            />
          </label>
          <datalist id="editor-text-colors">
            {textColorOptions.map((color) => (
              <option key={color} value={color} />
            ))}
          </datalist>
          <datalist id="editor-highlight-colors">
            {highlightColorOptions.map((color) => (
              <option key={color} value={color} />
            ))}
          </datalist>
          <ToolbarButton
            label="B"
            active={editor?.isActive("bold")}
            onClick={() => editor?.chain().focus().toggleBold().run()}
            disabled={disabled || !editor}
          />
          <ToolbarButton
            label="I"
            active={editor?.isActive("italic")}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            disabled={disabled || !editor}
          />
          <ToolbarButton
            label="U"
            active={editor?.isActive("underline")}
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
            disabled={disabled || !editor}
          />
          <ToolbarButton
            label="Left"
            active={editor?.isActive({ textAlign: "left" })}
            onClick={() => editor?.chain().focus().setTextAlign("left").run()}
            disabled={disabled || !editor}
          />
          <ToolbarButton
            label="Center"
            active={editor?.isActive({ textAlign: "center" })}
            onClick={() => editor?.chain().focus().setTextAlign("center").run()}
            disabled={disabled || !editor}
          />
          <ToolbarButton
            label="Right"
            active={editor?.isActive({ textAlign: "right" })}
            onClick={() => editor?.chain().focus().setTextAlign("right").run()}
            disabled={disabled || !editor}
          />
          <ToolbarButton
            label="Bullets"
            active={editor?.isActive("bulletList")}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            disabled={disabled || !editor}
          />
          <ToolbarButton
            label="Numbered"
            active={editor?.isActive("orderedList")}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            disabled={disabled || !editor}
          />
          <ToolbarButton
            label="Undo"
            onClick={() => editor?.chain().focus().undo().run()}
            disabled={disabled || !editor}
          />
          <ToolbarButton
            label="Redo"
            onClick={() => editor?.chain().focus().redo().run()}
            disabled={disabled || !editor}
          />
          <ToolbarButton
            label="Table"
            active={editor?.isActive("table")}
            onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
            disabled={disabled || !editor}
          />
          <ToolbarButton
            label="+ Row"
            onClick={() => editor?.chain().focus().addRowAfter().run()}
            disabled={disabled || !editor}
          />
          <ToolbarButton
            label="+ Col"
            onClick={() => editor?.chain().focus().addColumnAfter().run()}
            disabled={disabled || !editor}
          />
          <ToolbarButton
            label="Del table"
            onClick={() => editor?.chain().focus().deleteTable().run()}
            disabled={disabled || !editor}
          />
          <ToolbarButton
            label="Image"
            onClick={() => imageInputRef.current?.click()}
            disabled={disabled || !editor}
          />
          <ToolbarButton
            label="Img L"
            onClick={() => editor?.chain().focus().setImageAlignment("left").run()}
            disabled={disabled || !editor || !editor.isActive("image")}
          />
          <ToolbarButton
            label="Img C"
            onClick={() => editor?.chain().focus().setImageAlignment("center").run()}
            disabled={disabled || !editor || !editor.isActive("image")}
          />
          <ToolbarButton
            label="Img R"
            onClick={() => editor?.chain().focus().setImageAlignment("right").run()}
            disabled={disabled || !editor || !editor.isActive("image")}
          />
          <ToolbarButton
            label="50%"
            onClick={() => editor?.chain().focus().setImageWidth("50%").run()}
            disabled={disabled || !editor || !editor.isActive("image")}
          />
          <ToolbarButton
            label="75%"
            onClick={() => editor?.chain().focus().setImageWidth("75%").run()}
            disabled={disabled || !editor || !editor.isActive("image")}
          />
          <ToolbarButton
            label="100%"
            onClick={() => editor?.chain().focus().setImageWidth("100%").run()}
            disabled={disabled || !editor || !editor.isActive("image")}
          />
          <ToolbarButton
            label="Caption"
            onClick={() => editor?.chain().focus().insertImageCaption().run()}
            disabled={disabled || !editor}
          />
          <ToolbarButton
            label="Page break"
            onClick={() => editor?.chain().focus().insertPageBreak().run()}
            disabled={disabled || !editor}
          />
        </div>
        <div className="rich-text-editor__viewport">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}