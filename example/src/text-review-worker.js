import {calculateTextReview} from './text-review.js'

self.onmessage = ({data}) => {
  const {requestId, ...input} = data
  try {
    self.postMessage({requestId, result: calculateTextReview(input)})
  } catch {
    self.postMessage({requestId, error: true})
  }
}
