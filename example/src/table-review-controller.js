import {eventDirectory} from '../headless/event-directory.mjs'
import {renderTableSource,locateTableRange} from './table-source-view.js'

export function createTableReview(root, {workerFactory = () => new Worker(new URL('./table-review-worker.js',import.meta.url),{type:'module'})} = {}) {
  const find = id => root.querySelector('#'+id)
  const previous = /** @type {HTMLButtonElement} */ (find('previous'))
  const next = /** @type {HTMLButtonElement} */ (find('next'))
  const list = find('changes'), status = find('status'), error = find('error')
  let worker, generation = 0, disposed = false, entries = [], selected = -1, views = {}, buttons = []
  function clear() {
    entries = []; selected = -1; views = {}; buttons = []
    list.replaceChildren(); previous.disabled = next.disabled = true
    for (const id of ['before','after','before-location','after-location','raw']) find(id).replaceChildren()
    error.textContent = ''; error.hidden = true
  }
  function activate(index, scroll = false) {
    if (disposed || index < 0 || index >= entries.length) return
    selected = index
    const entry = entries[index]
    buttons.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===index)))
    const focused = document.activeElement
    previous.disabled = index === 0; next.disabled = index === entries.length-1
    if (focused === previous && previous.disabled && !next.disabled) next.focus()
    if (focused === next && next.disabled && !previous.disabled) previous.focus()
    const detail = entry.details.truncated ? ' Depth limit reached.' : entry.details.present ? ' Child events are informational, not additional edits.' : ''
    status.textContent = `Event ${entry.path}: ${entry.kind}. ${entry.layerFallback ? 'Coarse alignment fallback.' : 'No alignment fallback in this layer.'}${detail}`
    for (const [side,key] of [['before','old'],['after','new']]) {
      const range = entry[key], location = locateTableRange(views[side],range)
      find(side+'-location').textContent = `${side === 'before' ? 'Before':'After'} [${range.from}, ${range.to}) · ${range.count} original node(s)${location.boundary ? ' · empty boundary; no cell identity inferred' : location.located ? ' · selected original range' : ' · range not located; original retained'}`
      if (scroll) location.element?.scrollIntoView({block:'nearest',inline:'nearest'})
    }
  }
  previous.onclick = () => activate(selected-1,true)
  next.onclick = () => activate(selected+1,true)
  return {
    load(sample, options = {maxDepth:4,maxCells:100000}) {
      if (disposed) return
      const id = ++generation
      worker?.terminate(); worker = undefined; clear()
      status.textContent = 'Comparing validated table snapshots…'
      const fail = message => {clear(); status.textContent='Comparison unavailable; no review result is claimed.';error.hidden=false;error.textContent=message}
      try {
        const current = worker = workerFactory()
        current.onmessage = ({data}) => {
          if (disposed || id !== generation || current !== worker) return
          current.terminate(); worker = undefined
          if (!data.ok) {fail(data.error || 'Snapshot comparison failed');return}
          try {
            const report = data.report, directory = eventDirectory(report)
            views.before = renderTableSource(find('before'),report.snapshots.before,'Before')
            views.after = renderTableSource(find('after'),report.snapshots.after,'After')
            find('raw').textContent = JSON.stringify(report,null,2)
            entries = directory.entries
            for (const entry of entries) {
              const item = document.createElement('li'), button = document.createElement('button')
              button.type='button';button.textContent=`${entry.path} · ${entry.kind} · Before [${entry.old.from}, ${entry.old.to}) → After [${entry.new.from}, ${entry.new.to})`
              const index = buttons.length;button.onclick=()=>activate(index,true)
              buttons.push(button);item.append(button);list.append(item)
            }
            if (entries.length) activate(0)
            else status.textContent='No block changes. Both validated originals are shown.'
          } catch {fail('The comparison result could not be rendered; stale content was cleared.')}
        }
        current.onerror = () => {if (!disposed && id === generation && current === worker) {current.terminate();worker=undefined;fail('Comparison worker failed; try another example.')}}
        current.postMessage({before:sample.before,after:sample.after,options})
      } catch { worker?.terminate();worker=undefined;fail('Comparison worker is unavailable.') }
    },
    dispose() {if(disposed)return;disposed=true;++generation;worker?.terminate();worker=undefined;clear();status.textContent='Review disposed.'}
  }
}
