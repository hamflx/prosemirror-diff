import {compareNodeMetadata} from '../../src/metadata.js'
import {element} from './blocks-view.js'
import {renderTextSource} from './text-source-view.js'

// Example-only routing. This exact message is an internal implementation dependency,
// not a public error code. Other RangeErrors (positions/schema validation) are errors.
export function selectedMetadata(change) {
  if (!change || change.kind !== 'replace' || change.before.length !== 1 || change.after.length !== 1) {
    return {state: 'outside', reason: 'Select a single-block replacement for metadata details.'}
  }
  try {
    return {state: 'ready', records: compareNodeMetadata(change.before[0], change.after[0], {
      oldFrom: change.oldFrom, newFrom: change.newFrom
    })}
  } catch (error) {
    if (error instanceof RangeError && error.message === 'Metadata comparison requires identical node structure and text') {
      return {state: 'outside', reason: 'Metadata requires identical text and structure. Any available text details are partial: formatting is not independently compared.'}
    }
    return {state: 'unavailable', reason: 'Metadata comparison unavailable: input validation or snapshot failed. The complete parent event remains.'}
  }
}

// One coordinator owns source decorations: stop/restore text before metadata,
// restore metadata before text, and dispose both before replacing document DOM.
export function createSelectedReview(textReview) {
  const byId = id => document.getElementById(id)
  const status = byId('metadata-status'), pageStatus = byId('metadata-page-status')
  const list = /** @type {HTMLOListElement} */ (byId('metadata-changes'))
  const previous = /** @type {HTMLButtonElement} */ (byId('metadata-previous'))
  const next = /** @type {HTMLButtonElement} */ (byId('metadata-next'))
  const previousPage = /** @type {HTMLButtonElement} */ (byId('metadata-page-previous'))
  const nextPage = /** @type {HTMLButtonElement} */ (byId('metadata-page-next'))
  let records = [], locations = [], restored = [], decorated = [], index = -1, page = -1, disposed = false
  const controls = [previous, next, previousPage, nextPage]
  function restore() {
    for (const {source, node} of restored) renderTextSource(source, node)
    for (const target of decorated) target.classList.remove('selected-metadata-change')
    restored = []; decorated = []
  }
  function clear() {
    restore(); records = []; locations = []; index = page = -1
    list.replaceChildren(); pageStatus.textContent = 'No metadata detail page'
    controls.forEach(button => { button.disabled = true })
  }
  function activate(value, scroll = false) {
    if (disposed || value < 0 || value >= records.length) return
    restore(); index = value
    const record = records[index], nextPageIndex = Math.floor(index / 50)
    if (page !== nextPageIndex) {
      page = nextPageIndex
      list.replaceChildren(); list.start = page * 50 + 1
      for (let i = page * 50; i < Math.min(records.length, (page + 1) * 50); i++) {
        const item = element('li'), r = records[i]
        const button = element('button', `${i + 1}. ${r.kind}: ${r.nodeType} Before [${r.oldFrom}, ${r.oldTo}), After [${r.newFrom}, ${r.newTo})`)
        button.type = 'button'; button.dataset.index = String(i)
        button.onclick = () => activate(i, true)
        item.append(button, element('pre', 'Before: ' + JSON.stringify(r.before, null, 2) + '\nAfter: ' + JSON.stringify(r.after, null, 2)))
        list.append(item)
      }
    }
    for (const button of list.querySelectorAll('button')) button.setAttribute('aria-pressed', String(Number(button.dataset.index) === index))
    previous.disabled = index === 0; next.disabled = index === records.length - 1
    previousPage.disabled = page === 0; nextPage.disabled = (page + 1) * 50 >= records.length
    // Keep keyboard focus on a live enabled control when arriving at an edge.
    const peers = [[previous, next], [next, previous], [previousPage, nextPage], [nextPage, previousPage]]
    for (const [button, peer] of peers) if (document.activeElement === button && button.disabled && !peer.disabled) peer.focus()
    pageStatus.textContent = `Showing ${page * 50 + 1}-${Math.min(records.length, (page + 1) * 50)} of ${records.length} metadata details. All records are retained.`
    status.textContent = `Metadata detail ${index + 1} of ${records.length}: ${record.kind}. Parent block event remains complete.`
    for (const side of ['old', 'new']) {
      const target = locations[index][side]
      let highlight
      if (record.nodeType === 'text') {
        restored.push(target)
        highlight = renderTextSource(target.source, target.node, {from: record[side + 'From'], to: record[side + 'To'], start: target.from + 1})
      } else {
        highlight = target.element
        highlight.classList.add('selected-metadata-change'); decorated.push(highlight)
      }
      if (scroll) highlight?.scrollIntoView({block: 'nearest', inline: 'nearest'})
    }
  }
  previous.onclick = () => activate(index - 1, true)
  next.onclick = () => activate(index + 1, true)
  previousPage.onclick = () => activate((page - 1) * 50, true)
  nextPage.onclick = () => activate((page + 1) * 50, true)
  return {
    select(entry, views) {
      if (disposed) return
      clear()
      textReview.select(undefined, views) // terminates pending work and invalidates every late callback
      const result = selectedMetadata(entry?.change)
      status.dataset.state = result.state
      status.textContent = result.reason || 'No metadata changes in the selected node. This does not describe the rest of the document.'
      if (result.state === 'outside') { textReview.select(entry, views); return }
      byId('text-owner').textContent = entry ? `Selected block event ${entry.label}` : 'No selected block event'
      byId('text-status').dataset.state = 'idle'
      byId('text-status').textContent = result.state === 'ready' ? 'Same-text metadata review is active above; no text worker is needed.' : 'Text refinement paused because metadata validation failed. The complete parent event remains.'
      if (result.state !== 'ready') return
      records = result.records
      const targets = Object.fromEntries(['old', 'new'].map(side => [side,
        [...views[side].targets, ...(views[side].inlineTargets || [])]]))
      locations = records.map(record => Object.fromEntries(['old', 'new'].map(side => {
        const from = record[side + 'From'], to = record[side + 'To']
        const target = targets[side].find(target => record.nodeType === 'text'
          ? target.source && target.from + 1 <= from && to <= target.to - 1
          : target.node.type.name === record.nodeType && target.from === from && target.to === to)
        return [side, target]
      })))
      if (locations.some(location => !location.old || !location.new)) {
        clear(); status.dataset.state = 'unsupported'
        status.textContent = 'This fixed-schema renderer cannot locate these metadata records. The complete parent event remains.'
        return
      }
      if (records.length) activate(0)
      else pageStatus.textContent = 'Showing 0 of 0 metadata details.'
    },
    dispose() {
      if (disposed) return
      clear(); disposed = true; textReview.dispose()
      status.dataset.state = 'idle'; status.textContent = 'No selected block event'
    }
  }
}
