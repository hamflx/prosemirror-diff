import {open} from 'node:fs/promises'
import {eventDirectory, directoryLimits} from './event-directory.mjs'
try {
  const args = process.argv.slice(2)
  if (args.length !== 1) throw new Error('Usage: node example/headless/list-events.mjs REPORT.json')
  const handle = await open(args[0], 'r')
  let report
  try {
    if ((await handle.stat()).size > directoryLimits.fileBytes) throw new Error('Report exceeds the 8 MiB file limit')
    const bytes = Buffer.alloc(directoryLimits.fileBytes + 1)
    let count = 0
    while (count < bytes.length) {
      const {bytesRead} = await handle.read(bytes, count, bytes.length - count, null)
      if (!bytesRead) break
      count += bytesRead
    }
    if (count > directoryLimits.fileBytes) throw new Error('Report exceeds the 8 MiB file limit')
    report = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes.subarray(0, count)))
  } finally { await handle.close() }
  const output = JSON.stringify(eventDirectory(report), null, 2)
  process.stdout.write(output + '\n')
} catch (error) {
  process.stderr.write('Event directory failed: ' + error.message + '\n')
  process.exitCode = 1
}
