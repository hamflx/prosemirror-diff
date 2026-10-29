import {eventDirectory} from '../headless/event-directory.mjs'
import {renderTableSource,locateTableRange} from './table-source-view.js'
import {tableInputLimits} from './table-json-input.js'

export function createTableReview(root, {workerFactory = () => new Worker(new URL('./table-review-worker.js',import.meta.url),{type:'module'}), metadataWorkerFactory = workerFactory} = {}) {
  const find = id => root.querySelector('#'+id)
  const previous = /** @type {HTMLButtonElement} */ (find('previous'))
  const next = /** @type {HTMLButtonElement} */ (find('next'))
  const list = find('changes'), status = find('status'), error = find('error')
  let worker, generation = 0, disposed = false, entries = [], selected = -1, views = {}, buttons = []
  let metadataWorker, metadataGeneration = 0, retained
  function clearMetadata() {
    ++metadataGeneration; metadataWorker?.terminate(); metadataWorker = undefined
    find('metadata-records').replaceChildren()
    find('text-records').textContent = ''
    find('text-records').hidden = true
    find('metadata-status').textContent = 'No event selected.'
  }
  function inspectMetadata(path) {
    clearMetadata()
    const id = metadataGeneration
    find('metadata-status').textContent = `Inspecting details for event ${path}…`
    const fail = () => {
      find('metadata-records').replaceChildren()
      find('metadata-status').textContent = 'Metadata unavailable; complete original event retained.'
    }
    try {
      const current = metadataWorker = metadataWorkerFactory()
      current.onmessage = ({data}) => {
        if (disposed || id !== metadataGeneration || current !== metadataWorker) return
        current.terminate(); metadataWorker = undefined
        if (!data.ok || !data.selected) {fail();return}
        const detail = data.selected
        find('metadata-status').textContent = `Event ${path}: ${detail.coverage}. ${detail.reason}`
        if (detail.coverage === 'text-only-partial') {
          find('metadata-status').append(` ${detail.precision}`)
          const records = detail.hunks.map(hunk => ({
            kind:hunk.kind,
            before:{from:hunk.oldFrom,to:hunk.oldTo,text:detail.oldText.slice(hunk.oldFrom-detail.oldStart,hunk.oldTo-detail.oldStart)},
            after:{from:hunk.newFrom,to:hunk.newTo,text:detail.newText.slice(hunk.newFrom-detail.newStart,hunk.newTo-detail.newStart)}
          }))
          find('text-records').textContent = JSON.stringify(records,null,2)
          find('text-records').hidden = false
          return
        }
        if (detail.coverage !== 'metadata') return
        for (const record of detail.records) {
          const item = document.createElement('li'), values = document.createElement('pre')
          item.append(`${record.kind} · ${record.nodeType} · Before [${record.oldFrom}, ${record.oldTo}) → After [${record.newFrom}, ${record.newTo})`)
          values.textContent = JSON.stringify({before:record.before,after:record.after},null,2)
          item.append(values);find('metadata-records').append(item)
        }
        if (!detail.records.length) find('metadata-status').append(' No metadata records in this selected event.')
      }
      current.onerror = () => {
        if (disposed || id !== metadataGeneration || current !== metadataWorker) return
        current.terminate();metadataWorker = undefined;fail()
      }
      current.postMessage({kind:'metadata',before:retained.snapshots.before,after:retained.snapshots.after,options:retained.options,eventPath:path})
    } catch {metadataWorker?.terminate();metadataWorker=undefined;fail()}
  }
  function clear() {
    clearMetadata();retained = undefined
    entries = []; selected = -1; views = {}; buttons = []
    list.replaceChildren(); previous.disabled = next.disabled = true
    for (const id of ['before','after','before-location','after-location','raw']) find(id).replaceChildren()
    error.textContent = ''; error.hidden = true
  }
  function activate(index, scroll = false) {
    if (disposed || index < 0 || index >= entries.length) return
    selected = index
    const entry = entries[index]
    inspectMetadata(entry.path)
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
    function load(sample, options = {maxDepth:4,maxCells:100000}, json = false) {
      if (disposed) return
      const id = ++generation
      worker?.terminate(); worker = undefined; clear()
      status.textContent = 'Comparing validated table snapshots…'
      const fail = message => {clear(); status.textContent='Comparison unavailable; no review result is claimed.';error.hidden=false;error.textContent=message}
      if (json && (typeof sample.beforeText !== 'string' || typeof sample.afterText !== 'string' ||
        sample.beforeText.length > tableInputLimits.bytesPerSide || sample.afterText.length > tableInputLimits.bytesPerSide)) {
        fail('JSON exceeds the per-side input limit; reduce the input before comparing.');return
      }
      try {
        const current = worker = workerFactory()
        current.onmessage = ({data}) => {
          if (disposed || id !== generation || current !== worker) return
          current.terminate(); worker = undefined
          if (!data.ok) {fail(data.error || 'Snapshot comparison failed');return}
          try {
            const report = data.report, directory = eventDirectory(report)
            retained = report
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
        current.postMessage(json ? {json:{before:sample.beforeText,after:sample.afterText},options} : {before:sample.before,after:sample.after,options})
      } catch { worker?.terminate();worker=undefined;fail('Comparison worker is unavailable.') }
    }
  return {
    load,
    loadJSON(beforeText,afterText,options) {load({beforeText,afterText},options,true)},
    cancel() {if(disposed)return;++generation;worker?.terminate();worker=undefined;clear();status.textContent='Inputs changed. Compare JSON to create a new result.'},
    dispose() {if(disposed)return;disposed=true;++generation;worker?.terminate();worker=undefined;clear();status.textContent='Review disposed.'}
  }
}
