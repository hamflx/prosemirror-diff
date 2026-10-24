import {readFile} from 'node:fs/promises'
import {reviewSnapshots} from './review.mjs'

try {
  const args = process.argv.slice(2)
  if (args.length < 2 || args.length > 3) throw new Error('Usage: node example/headless/cli.mjs OLD.json NEW.json [EVENT_PATH]')
  const [before, after] = await Promise.all(args.slice(0, 2).map(async path => JSON.parse(await readFile(path, 'utf8'))))
  // Finish validation, comparison and serialization before emitting any stdout.
  const output = JSON.stringify(reviewSnapshots(before, after, args[2]), null, 2)
  process.stdout.write(output + '\n')
} catch (error) {
  process.stderr.write('Snapshot review failed: ' + error.message + '\n')
  process.exitCode = 1
}
