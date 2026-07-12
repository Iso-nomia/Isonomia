import React from "react";
import { Extension } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import tippy from "tippy.js";
import styles from "../article.module.scss";

const COMMANDS = [
  {
    title: "Image",
    command: (editor: any) => editor.chain().focus().setImage({ src: "" }).run(),
  },
  {
    title: "Quote",
    command: (editor: any) => editor.chain().focus().setNode("pullQuote").run(),
  },
  {
    title: "Callout",
    command: (editor: any) => editor.chain().focus().setNode("callout").run(),
  },
  {
    title: "Latex",
    command: (editor: any) => editor.chain().focus().setNode("mathBlock").run(),
  },
];

const SlashCommand = Extension.create({
  name: "slash-command",
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,      // ✅ pass the instance

        char: "/",
        items: ({ query }) =>
          COMMANDS.filter((item) =>
            item.title.toLowerCase().startsWith(query.toLowerCase()),
          ),
        command: ({ editor, range, props }) => {
          props.command(editor);
          editor.commands.deleteRange(range);
        },
        render: () => {
          let component: ReactRenderer | null = null;
          let popup: any = null;
          return {
            onStart: (props) => {
              component = new ReactRenderer(CommandList, {
                props,
                editor: props.editor,
              });
              if (!props.clientRect) return;
              popup = tippy("body", {
                getReferenceClientRect: props.clientRect as (() => DOMRect),
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
              });
            },
            onUpdate(props) {
              component?.updateProps(props);
              if (!props.clientRect) return;
              popup[0].setProps({
                getReferenceClientRect: props.clientRect,
              });
            },
            onKeyDown(props) {
              if (props.event.key === "Escape") {
                popup[0].hide();
                return true;
              }
              return false;
            },
            onExit() {
              popup[0].destroy();
              component?.destroy();
            },
          };
        },
      }),
    ];
  },
});

const CommandList = ({ items, command }: any) => {
  return (
    <div className={styles.slashMenu}>
      {items.map((item: any, index: number) => (
        <button key={index} onClick={() => command(item)}>
          {item.title}
        </button>
      ))}
    </div>
  );
};

export default SlashCommand;
