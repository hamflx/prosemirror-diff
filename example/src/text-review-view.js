import {prepareTextChange} from './text-review.js'
import {element} from './blocks-view.js'
import {renderTextSource} from './text-source-view.js'

// Only the selected block is compared. A fresh controller owns one result's cache.
export function createTextReview({workerFactory = () => new Worker(new URL('./text-review-worker.js', import.meta.url), {type: 'module'})} = {}) {
  const byId = id => document.getElementById(id)
  const list = byId('text-changes'), status = byId('text-status')
  const previous = byId('text-previous'), next = byId('text-next')
  const previousPage = byId('text-page-previous'), nextPage = byId('text-page-next')
  const pageStatus = byId('text-page-status'), pageSize = 50
  const cache = new Map()
  let review, selected = -1, originals = [], buttons = [], page = -1
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
    for (const {target, node} of originals) renderTextSource(target, node)
  }

  function activate(index, scroll = false) {
    restore()
    selected = index >= 0 && index < (review?.hunks.length ?? 0) ? index : -1
    if (selected >= 0) renderPage(selected)
    buttons.forEach(({button, index}) => button.setAttribute('aria-pressed', String(index === selected)))
    previous.disabled = selected <= 0
    next.disabled = selected < 0 || selected >= review.hunks.length - 1
    if (selected < 0) return
    const hunk = review.hunks[selected]
    for (const {target, node, side} of originals) {
      const start = review[`${side}Start`]
      const from = hunk[`${side}From`], to = hunk[`${side}To`]
      const highlight = renderTextSource(target, node, {from, to, start,
        label: `${side === 'old' ? 'Insertion' : 'Deletion'} point at ${from}`})
      if (scroll) highlight.scrollIntoView({block: 'nearest', inline: 'nearest'})
    }
    status.textContent = `Text detail ${selected + 1} of ${review.hunks.length}: ${hunk.kind}. Before [${hunk.oldFrom}, ${hunk.oldTo}), After [${hunk.newFrom}, ${hunk.newTo}).`
  }

  previous.onclick = () => activate(selected - 1, true)
  next.onclick = () => activate(selected + 1, true)
  previousPage.onclick = () => { if (page > 0) activate((page - 1) * pageSize, true) }
  nextPage.onclick = () => {
    if (review && (page + 1) * pageSize < review.hunks.length) activate((page + 1) * pageSize, true)
  }

  function resetList() {
    buttons = []
    page = -1
    list.replaceChildren()
    list.start = 1
    previousPage.disabled = nextPage.disabled = true
    pageStatus.textContent = 'No text detail page'
  }

  function renderPage(index) {
    const newPage = Math.floor(index / pageSize)
    if (newPage === page) return
    page = newPage
    buttons = []
    const start = page * pageSize, end = Math.min(start + pageSize, review.hunks.length)
    const fragment = document.createDocumentFragment()
    for (let i = start; i < end; i++) {
      const hunk = review.hunks[i]
      const item = element('li')
      item.value = i + 1
      const button = element('button', `${i + 1}. ${hunk.kind}: Before [${hunk.oldFrom}, ${hunk.oldTo}), After [${hunk.newFrom}, ${hunk.newTo})`)
      button.type = 'button'
      button.addEventListener('click', () => activate(i, true))
      buttons.push({button, index: i})
      item.append(button)
      fragment.append(item)
    }
    list.start = start + 1
    list.replaceChildren(fragment)
    previousPage.disabled = page === 0
    nextPage.disabled = end === review.hunks.length
    pageStatus.textContent = `Showing ${start + 1}-${end} of ${review.hunks.length} text details. Page ${page + 1} of ${Math.ceil(review.hunks.length / pageSize)}. All details are retained.`
  }

  return {
    dispose() {
      disposed = true
      requestId++
      stopWorker()
      restore()
      originals = []
      resetList()
      review = undefined
      selected = -1
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
      resetList()
      review = undefined
      selected = -1
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
          originals.push({target: target.source, node: entry.change[side === 'old' ? 'before' : 'after'][0], side})
        }
        status.textContent = entry.change.before[0].eq(entry.change.after[0])
          ? 'No text changes in the selected block. Formatting is not independently compared here.'
          : 'Text unchanged; formatting differs. Use metadata comparison for unchanged text and structure. The complete block event remains.'
        if (!review.hunks.length) pageStatus.textContent = 'Showing 0 of 0 text details. Page 0 of 0.'
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
