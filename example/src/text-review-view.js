import {prepareTextChange} from './text-review.js'
import {element} from './blocks-view.js'

// Only the selected block is compared. A fresh controller owns one result's cache.
export function createTextReview({workerFactory = () => new Worker(new URL('./text-review-worker.js', import.meta.url), {type: 'module'})} = {}) {
  const byId = id => document.getElementById(id)
  const list = byId('text-changes'), status = byId('text-status')
  const previous = byId('text-previous'), next = byId('text-next')
  const cache = new Map()
  let review, selected = -1, originals = [], buttons = []
  let worker, requestId = 0, disposed = false

  function stopWorker() {
    worker?.terminate()
    worker = undefined
  }

  function unavailable() {
    stopWorker()
    status.dataset.state = 'unavailable'
    status.textContent = 'Text details are unavailable. The complete block event remains available.'
  }

  function restore() {
    for (const {target, text} of originals) target.textContent = text
  }

  function activate(index, scroll = false) {
    restore()
    selected = index >= 0 && index < (review?.hunks.length ?? 0) ? index : -1
    buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === selected)))
    previous.disabled = selected <= 0
    next.disabled = selected < 0 || selected >= review.hunks.length - 1
    if (selected < 0) return
    const hunk = review.hunks[selected]
    for (const {target, text, side} of originals) {
      const start = review[`${side}Start`]
      const from = hunk[`${side}From`], to = hunk[`${side}To`]
      const highlight = element('span', text.slice(from - start, to - start))
      highlight.className = from === to ? 'text-position-marker' : 'selected-text-change'
      Object.assign(highlight.dataset, {from: String(from), to: String(to)})
      if (from === to) {
        highlight.setAttribute('role', 'img')
        highlight.setAttribute('aria-label', `${side === 'old' ? 'Insertion' : 'Deletion'} point at ${from}`)
      }
      target.replaceChildren(document.createTextNode(text.slice(0, from - start)), highlight,
        document.createTextNode(text.slice(to - start)))
      if (scroll) highlight.scrollIntoView({block: 'nearest', inline: 'nearest'})
    }
    status.textContent = `Text detail ${selected + 1} of ${review.hunks.length}: ${hunk.kind}. Before [${hunk.oldFrom}, ${hunk.oldTo}), After [${hunk.newFrom}, ${hunk.newTo}).`
  }

  previous.onclick = () => activate(selected - 1, true)
  next.onclick = () => activate(selected + 1, true)

  return {
    dispose() {
      disposed = true
      requestId++
      stopWorker()
      restore()
      originals = []
      buttons = []
      review = undefined
      list.replaceChildren()
      previous.disabled = next.disabled = true
      status.dataset.state = 'idle'
      status.textContent = 'No selected block event'
    },
    select(entry, views) {
      if (disposed) return
      const currentId = ++requestId
      stopWorker()
      restore()
      originals = []
      buttons = []
      review = undefined
      selected = -1
      list.replaceChildren()
      previous.disabled = next.disabled = true
      byId('text-owner').textContent = entry ? `Selected block event ${entry.label}` : 'No selected block event'
      const prepared = prepareTextChange(entry?.change)
      if (!prepared.supported) {
        status.dataset.state = 'unsupported'
        status.textContent = prepared.reason
        return
      }
      const display = result => {
        review = result
        for (const side of ['old', 'new']) {
          const target = views[side].targets.find(target => target.scope === entry.scopes[side] && target.from === entry.change[`${side}From`])
          originals.push({target: target.source, text: review[`${side}Text`], side})
        }
        review.hunks.forEach((hunk, index) => {
          const item = element('li')
          const button = element('button', `${index + 1}. ${hunk.kind}: Before [${hunk.oldFrom}, ${hunk.oldTo}), After [${hunk.newFrom}, ${hunk.newTo})`)
          button.type = 'button'
          button.addEventListener('click', () => activate(index, true))
          buttons.push(button)
          item.append(button)
          list.append(item)
        })
        status.textContent = 'No text changes in the selected block.'
        activate(review.hunks.length ? 0 : -1)
        status.dataset.state = 'ready'
      }
      if (cache.has(entry)) {
        display(cache.get(entry))
        return
      }
      status.dataset.state = 'pending'
      status.textContent = 'Preparing text details…'
      try {
        const currentWorker = workerFactory()
        worker = currentWorker
        const current = () => !disposed && requestId === currentId && worker === currentWorker
        currentWorker.onmessage = ({data}) => {
          if (!current() || data?.requestId !== currentId) return
          if (data.error || !Array.isArray(data.result?.hunks)) { unavailable(); return }
          stopWorker()
          cache.set(entry, data.result)
          display(data.result)
        }
        currentWorker.onerror = event => {
          if (!current()) return
          event.preventDefault?.()
          unavailable()
        }
        currentWorker.onmessageerror = () => { if (current()) unavailable() }
        const {oldText, newText, oldStart, newStart} = prepared
        currentWorker.postMessage({requestId: currentId, oldText, newText, oldStart, newStart})
      } catch {
        unavailable()
      }
    }
  }
}
