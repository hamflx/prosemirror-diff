import assert from 'node:assert/strict';

// Actual official table models; no editor DOM, grid repair or identity inference.
export function runTableContracts(api, model, tables, stateModule) {
  const {
    Schema,
    Node
  } = model;
  const {
    tableNodes,
    TableMap
  } = tables;
  const {
    compareDocumentBlocks,
    compareNodeMetadata,
    diffEditor
  } = api;
  const schema = new Schema({
    nodes: {
      doc: {
        content: 'block+'
      },
      paragraph: {
        group: 'block',
        content: 'text*'
      },
      text: {},
      ...tableNodes({
        tableGroup: 'block',
        cellContent: 'paragraph+'
      })
    },
    marks: {
      diffMark: {
        attrs: {
          type: {
            default: 0
          }
        }
      },
      strong: {},
      link: {
        attrs: {
          href: {}
        }
      }
    }
  });
  const p = (value, marks = []) => schema.node('paragraph', null, value ? schema.text(value, marks) : null);
  const cell = (value, attrs = {}, marks = []) => schema.node('table_cell', attrs, p(value, marks));
  const table = rows => schema.node('table', null, rows.map(cells => schema.node('table_row', null, cells)));
  const doc = table => schema.node('doc', null, [p('Before'), table, p('After')]);
  const basic = () => table([[cell('A'), cell('B')], [cell('C'), cell('D')]]);
  function mergeSnapshot(axis) {
    const original = doc(basic());
    // Before paragraph occupies 8 positions; table content starts at 9.
    // First cell starts at 10; the right cell at 15 and lower cell at 22.
    const selection = tables.CellSelection.create(original, 10, axis === 'horizontal' ? 15 : 22);
    const state = stateModule.EditorState.create({
      schema,
      doc: original,
      selection
    });
    assert.ok(state.doc instanceof Node);
    /** @type {import('prosemirror-state').Transaction | undefined} */
    let transaction;
    let dispatches = 0;
    assert.equal(tables.mergeCells(state, tr => {
      transaction = tr;
      dispatches++;
    }), true);
    assert.equal(dispatches, 1);
    assert.ok(transaction, 'mergeCells must dispatch a transaction');
    const merged = transaction.doc.child(1);
    const first = merged.firstChild.firstChild;
    assert.deepEqual(Array.from({
      length: first.childCount
    }, (_, i) => first.child(i).textContent), axis === 'horizontal' ? ['A', 'B'] : ['A', 'C']);
    assert.equal(first.attrs.colspan, axis === 'horizontal' ? 2 : 1);
    assert.equal(first.attrs.rowspan, axis === 'vertical' ? 2 : 1);
    original.check();
    transaction.doc.check();
    assert.ok(original.eq(doc(basic())), 'merge command must preserve the original document');
    return merged;
  }
  const examples = [['cell-text', basic(), table([[cell('A'), cell('Updated B')], [cell('C'), cell('D')]])], ['cell-strong', basic(), table([[cell('A'), cell('B', {}, [schema.mark('strong')])], [cell('C'), cell('D')]])], ['cell-href', table([[cell('A', {}, [schema.mark('link', {
    href: '/old'
  })]), cell('B')]]), table([[cell('A', {}, [schema.mark('link', {
    href: '/new'
  })]), cell('B')]])], ['middle-row', basic(), table([[cell('A'), cell('B')], [cell('Inserted'), cell('Row')], [cell('C'), cell('D')]])], ['colspan-layout-change', basic(), table([[cell('A', {
    colspan: 2
  })], [cell('C'), cell('D')]])], ['rowspan-layout-change', basic(), table([[cell('A', {
    rowspan: 2
  }), cell('B')], [cell('D')]])], ['colspan-merge', basic(), mergeSnapshot('horizontal')], ['rowspan-merge', basic(), mergeSnapshot('vertical')], ['repeated-rows', table([[cell('A'), cell('A')], [cell('B'), cell('B')], [cell('A'), cell('A')]]), table([[cell('B'), cell('B')], [cell('A'), cell('A')], [cell('B'), cell('B')]])], ['unequal-width', basic(), table([[cell('A'), cell('B')], [cell('C')]])], ['overlong-rowspan', basic(), table([[cell('A', {
    rowspan: 2
  }), cell('B')]])]];
  function grid(node) {
    let model;
    try {
      node.check();
      model = {
        valid: true
      };
    } catch (e) {
      model = {
        valid: false,
        error: e.message
      };
    }
    const map = TableMap.get(node);
    return {
      model,
      width: map.width,
      height: map.height,
      occupancy: map.map,
      problems: map.problems
    };
  }
  const children = node => Array.from({
    length: node.childCount
  }, (_, i) => node.child(i));
  let layers = 0,
    nested = 0;
  function verify(layer, oldParent, newParent, oldStart, newStart, depth = 0) {
    layers++;
    if (depth) nested++;
    const a = children(oldParent),
      b = children(newParent);
    const bounds = (nodes, start) => nodes.reduce((out, n) => [...out, out.at(-1) + n.nodeSize], [start]);
    const ap = bounds(a, oldStart),
      bp = bounds(b, newStart);
    let ai = 0,
      bi = 0;
    const restored = [];
    for (const event of layer.changes) {
      const af = ap.indexOf(event.oldFrom),
        at = ap.indexOf(event.oldTo),
        bf = bp.indexOf(event.newFrom),
        bt = bp.indexOf(event.newTo);
      assert.ok(af >= ai && at >= af && bf >= bi && bt >= bf);
      assert.equal(af - ai, bf - bi);
      for (let i = 0; i < af - ai; i++) {
        assert.ok(a[ai + i].eq(b[bi + i]));
        restored.push(a[ai + i]);
      }
      assert.equal(event.before.length, at - af);
      assert.equal(event.after.length, bt - bf);
      event.before.forEach((n, i) => assert.equal(n, a[af + i]));
      event.after.forEach((n, i) => assert.equal(n, b[bf + i]));
      restored.push(...event.after);
      ai = at;
      bi = bt;
      if (event.details && !event.details.truncated) verify(event.details, event.before[0], event.after[0], event.oldFrom + 1, event.newFrom + 1, depth + 1);
    }
    assert.equal(a.length - ai, b.length - bi);
    for (let i = 0; i < a.length - ai; i++) {
      assert.ok(a[ai + i].eq(b[bi + i]));
      restored.push(a[ai + i]);
    }
    assert.equal(restored.length, b.length);
    restored.forEach((n, i) => assert.ok(n.eq(b[i])));
  }
  function selections(layer, path = []) {
    const out = [];
    layer.changes.forEach((event, i) => {
      const at = [...path, i];
      if (event.kind === 'replace' && event.before.length === 1 && event.after.length === 1) {
        try {
          const records = compareNodeMetadata(event.before[0], event.after[0], {
            oldFrom: event.oldFrom,
            newFrom: event.newFrom
          });
          for (const record of records) assert.ok(record.oldFrom >= event.oldFrom && record.oldTo <= event.oldTo && record.newFrom >= event.newFrom && record.newTo <= event.newTo);
          out.push({
            path: at,
            coverage: 'metadata',
            records
          });
        } catch (error) {
          assert.equal(error.message, 'Metadata comparison requires identical node structure and text');
          out.push({
            path: at,
            coverage: 'outside-metadata',
            reason: error.message
          });
        }
      }
      if (event.details) out.push(...selections(event.details, at));
    });
    return out;
  }
  const cases = [];
  for (const [name, oldTable, newTable] of examples) {
    const validation = {
        old: grid(oldTable),
        new: grid(newTable)
      },
      oldDoc = doc(oldTable);
    const newDoc = name === 'cell-strong' ? schema.node('doc', null, [p('Inserted'), ...children(doc(newTable))]) : doc(newTable);
    assert.ok(oldDoc instanceof Node);
    assert.ok(newDoc instanceof Node);
    oldDoc.check();
    newDoc.check();
    const before = JSON.stringify([oldDoc.toJSON(), newDoc.toJSON()]);
    if (validation.old.problems || validation.new.problems) {
      cases.push({
        name,
        validation,
        comparison: 'skipped-invalid-grid'
      });
      continue;
    }
    const oldHeight = name === 'cell-href' ? 1 : name === 'repeated-rows' ? 3 : 2;
    const newHeight = name === 'middle-row' ? 3 : oldHeight;
    assert.deepEqual([validation.old.width, validation.old.height], [2, oldHeight]);
    assert.deepEqual([validation.new.width, validation.new.height], [2, newHeight]);
    if (name.startsWith('colspan-') || name.startsWith('rowspan-')) {
      assert.deepEqual(validation.old.occupancy, [1, 6, 13, 18]);
      assert.deepEqual(validation.new.occupancy, {
        'colspan-merge': [1, 1, 11, 16],
        'rowspan-merge': [1, 9, 1, 16],
        'colspan-layout-change': [1, 1, 8, 13],
        'rowspan-layout-change': [1, 6, 1, 13]
      }[name]);
    }
    const result = compareDocumentBlocks(oldDoc, newDoc, {
      maxDepth: 4,
      maxCells: 100000
    });
    verify(result, oldDoc, newDoc, 0, 0);
    const reverse = compareDocumentBlocks(newDoc, oldDoc, {
      maxDepth: 4,
      maxCells: 100000
    });
    verify(reverse, newDoc, oldDoc, 0, 0);
    const coarse = compareDocumentBlocks(oldDoc, newDoc, {
      maxDepth: 4,
      maxCells: 0
    });
    verify(coarse, oldDoc, newDoc, 0, 0);
    const shallow = compareDocumentBlocks(oldDoc, newDoc, {
      maxDepth: 1,
      maxCells: 100000
    });
    verify(shallow, oldDoc, newDoc, 0, 0);
    if (name === 'cell-text') {
      const rowEvent = shallow.changes[0].details.changes[0];
      assert.deepEqual(rowEvent.details, {
        changes: [],
        fallback: false,
        truncated: true
      });
      assert.equal(rowEvent.before[0], oldTable.firstChild);
      assert.equal(rowEvent.after[0], newTable.firstChild);
      assert.ok(!rowEvent.before[0].eq(rowEvent.after[0]));
    }
    const selected = selections(result);
    if (name === 'cell-strong' || name === 'cell-href') {
      const oldFrom = name === 'cell-strong' ? 17 : 12,
        newFrom = name === 'cell-strong' ? 27 : 12;
      const before = name === 'cell-strong' ? [] : [{
        type: 'link',
        attrs: {
          href: '/old'
        }
      }];
      const after = name === 'cell-strong' ? [{
        type: 'strong'
      }] : [{
        type: 'link',
        attrs: {
          href: '/new'
        }
      }];
      const metadataSelections = selected.filter(s => s.coverage === 'metadata');
      assert.equal(metadataSelections.length, 4);
      assert.deepEqual(metadataSelections.at(-1).path, name === 'cell-strong' ? [1, 0, 0, 0] : [0, 0, 0, 0]);
      for (const selection of metadataSelections) assert.deepEqual(selection.records, [{
        kind: 'marks',
        nodeType: 'text',
        oldFrom,
        oldTo: oldFrom + 1,
        newFrom,
        newTo: newFrom + 1,
        before,
        after
      }]);
    }
    assert.equal(JSON.stringify([oldDoc.toJSON(), newDoc.toJSON()]), before);
    let callerSelectedCell, legacy;
    if (name.startsWith('colspan-') || name.startsWith('rowspan-')) {
      const first = doc => {
        /** @type {{node: import('prosemirror-model').Node, pos: number} | undefined} */
        let found;
        doc.descendants((node, pos) => {
          if (!found && node.type.name === 'table_cell') found = {
            node,
            pos
          };
        });
        return found;
      };
      const a = first(oldDoc),
        b = first(newDoc);
      assert.ok(a, 'Old fixture must contain a first cell');
      assert.ok(b, 'New fixture must contain a first cell');
      if (name.endsWith('layout-change')) {
        const records = compareNodeMetadata(a.node, b.node, {
          oldFrom: a.pos,
          newFrom: b.pos
        });
        assert.deepEqual(records, [{
          kind: 'attrs',
          nodeType: 'table_cell',
          oldFrom: 10,
          oldTo: 15,
          newFrom: 10,
          newTo: 15,
          before: {
            colspan: 1,
            rowspan: 1,
            colwidth: null
          },
          after: {
            colspan: name.startsWith('colspan-') ? 2 : 1,
            rowspan: name.startsWith('rowspan-') ? 2 : 1,
            colwidth: null
          }
        }]);
        callerSelectedCell = {
          scope: 'Explicit fixture correspondence for a span-layout edit that deletes another cell content; not an official mergeCells result.',
          coverage: 'metadata',
          records
        };
      } else {
        assert.throws(() => compareNodeMetadata(a.node, b.node, {
          oldFrom: a.pos,
          newFrom: b.pos
        }), {
          name: 'RangeError',
          message: 'Metadata comparison requires identical node structure and text'
        });
        callerSelectedCell = {
          scope: 'Explicit fixture correspondence; official mergeCells retained both paragraphs, so metadata rejects changed content.',
          coverage: 'outside-metadata',
          oldFrom: a.pos,
          oldTo: a.pos + a.node.nodeSize,
          newFrom: b.pos,
          newTo: b.pos + b.node.nodeSize,
          before: a.node.toJSON(),
          after: b.node.toJSON()
        };
      }
      try {
        const output = diffEditor(schema, oldDoc.toJSON(), newDoc.toJSON());
        output.check();
        const grids = [];
        output.descendants(node => {
          if (node.type.name === 'table') grids.push(grid(node));
        });
        legacy = {
          modelValid: true,
          grids,
          output: output.toJSON()
        };
      } catch (error) {
        legacy = {
          error: error.message
        };
      }
    }
    assert.equal(JSON.stringify([oldDoc.toJSON(), newDoc.toJSON()]), before);
    cases.push({
      name,
      validation,
      comparison: 'pass',
      selected,
      callerSelectedCell,
      legacy,
      fixtureOrigin: name.endsWith('layout-change') ? 'Synthetic layout edit deletes B/C content; not mergeCells.' : name.endsWith('-merge') ? 'Official mergeCells with CellSelection and matching EditorState; both original paragraphs retained.' : 'Synthetic official-schema snapshot pair.',
      refinementScope: name.startsWith('rowspan-') ? 'Automatic row layer is 2:2, so it does not refine individual cells. Explicit fixture-selected cells are a separate comparison.' : 'Nested events retain complete parents; overlapping ancestor metadata selections are alternatives, not cumulative edits.',
      blocks: result,
      coarse,
      shallow
    });
  }
  assert.equal(cases.filter(c => c.comparison === 'pass').length, 9);
  const uneven = cases.find(c => c.name === 'unequal-width').validation.new;
  assert.deepEqual([uneven.width, uneven.height], [2, 2]);
  assert.deepEqual(uneven.occupancy, [1, 6, 13, 0]);
  assert.equal(uneven.problems[0].type, 'missing');
  const overlong = cases.find(c => c.name === 'overlong-rowspan').validation.new;
  assert.deepEqual([overlong.width, overlong.height], [2, 1]);
  assert.deepEqual(overlong.occupancy, [1, 6]);
  assert.ok(cases.find(c => c.name === 'overlong-rowspan').validation.new.problems.some(p => p.type === 'overlong_rowspan'));
  assert.ok(cases.find(c => c.name === 'cell-strong').selected.some(s => s.records?.some(r => r.kind === 'marks')));
  return JSON.parse(JSON.stringify({
    layers,
    nested,
    cases
  }));
}
