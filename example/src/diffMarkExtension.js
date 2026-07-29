import { Mark, mergeAttributes } from '@tiptap/core'
import { DiffType } from '@hamflx/prosemirror-diff'

export const DiffMarkExtension = Mark.create({
    name: 'diffMark',

    addAttributes () {
        return {
            type: {
                renderHTML: ({ type }) => {
                    const color = {
                        [DiffType.Inserted]: '#bcf5bc',
                        [DiffType.Deleted]: '#ff8989'
                    }[type]
                    return {
                        style: 'background-color: ' + color
                    }
                }
            },
            level: {
                default: 'char',
                renderHTML: ({ level }) => ({
                    'data-diff-level': level
                })
            }
        }
    },

    renderHTML ({ HTMLAttributes }) {
        return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
    }
})
