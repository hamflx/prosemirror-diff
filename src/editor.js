import StarterKit from '@tiptap/starter-kit'
import { Editor } from "@tiptap/vue-3"
import { Document } from '@tiptap/extension-document'
import { Heading } from '@tiptap/extension-heading'
import { Paragraph } from '@tiptap/extension-paragraph'
import { Underline } from '@tiptap/extension-underline'
import { Link } from '@tiptap/extension-link'
import { Color } from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import { TextAlign } from '@tiptap/extension-text-align'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { BulletList } from '@tiptap/extension-bullet-list'
import { OrderedList } from '@tiptap/extension-ordered-list'
import { TaskList } from '@tiptap/extension-task-list'
import { TaskItem } from '@tiptap/extension-task-item'
import { Blockquote } from '@tiptap/extension-blockquote'
import { CodeBlock } from '@tiptap/extension-code-block'
import { Table } from '@tiptap/extension-table'
import {DiffMarkExtension} from "../lib/index.js";

export const createEditor = () => {
  const extensions = [
    StarterKit.configure({
      document: false,
      heading: false,
      paragraph: false,
      bulletList: false,
      orderedList: false,
      blockquote: false,
      history: false,
      codeBlock: false
    }),

    Document.extend({
      content: 'heading block*'
    }),

    TextAlign.configure({
      types: ['heading', 'paragraph', 'image']
    }),

    Heading,
    Paragraph,
    BulletList,
    OrderedList,
    Blockquote,

    TaskList,
    TaskItem.configure({
      nested: true
    }),
    Underline,
    CodeBlock,

    Color,
    TextStyle,
    Link.configure({
      autolink: false
    }),

    Table.configure({
      resizable: true
    }),
    TableRow,
    TableHeader,
    TableCell,

    DiffMarkExtension
  ]
  const options = {
    extensions
  }
  return new Editor(options)
}
