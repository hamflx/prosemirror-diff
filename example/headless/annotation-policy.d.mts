import type {Node} from 'prosemirror-model'
import type {MetadataChange} from '../../index.js'
export type AnnotationReview = {
  ignoredMarks: string[]
  hiddenRecordIndices: number[]
  visibleRecordIndices: number[]
} & ({coverage: 'metadata'; records: MetadataChange[]; classification: 'unchanged' | 'annotation-only' | 'visible'} |
  {coverage: 'unavailable'; reason: string})
/** Example helper; not exported from the package. Names must belong to the shared schema. */
export declare function reviewAnnotations(before: Node, after: Node, ignoredMarks?: string[]): AnnotationReview
