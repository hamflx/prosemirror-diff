import path from 'path'
import {fileURLToPath} from 'url'
import commonjs from '@rollup/plugin-commonjs'
import babel from '@rollup/plugin-babel'
import {nodeResolve} from '@rollup/plugin-node-resolve'

const name = '@hamflx/prosemirror-diff'
const configDirectory = path.dirname(fileURLToPath(import.meta.url))
const input = path.resolve(configDirectory, 'src/index.js')
const external = ['diff', 'diff-match-patch', 'prosemirror-model']

export default {
  input,
  external: id => external.includes(id),
  output: [
    {
      name,
      file: path.resolve(configDirectory, 'lib/index.umd.js'),
      format: 'umd',
      sourcemap: true,
      globals: {
        diff: 'Diff',
        'diff-match-patch': 'diffMatchPatch',
        'prosemirror-model': 'prosemirrorModel',
      },
    },
    {
      name,
      file: path.resolve(configDirectory, 'lib/index.cjs.js'),
      format: 'cjs',
      sourcemap: true,
      exports: 'auto',
    },
    {
      name,
      file: path.resolve(configDirectory, 'lib/index.esm.js'),
      format: 'es',
      sourcemap: true,
    },
  ],
  plugins: [
    nodeResolve(),
    commonjs(),
    babel({
      babelHelpers: 'bundled',
      exclude: 'node_modules/**',
    }),
  ]
}
