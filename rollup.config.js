import path from 'path'
import sourcemaps from 'rollup-plugin-sourcemaps'
import commonjs from '@rollup/plugin-commonjs'
import babel from '@rollup/plugin-babel'

const name = '@hamflx/prosemirror-diff'
const input = path.resolve(__dirname, 'src/index.js')

export default {
  input,
  external: id => /^(diff-match-patch|prosemirror-model)/.test(id),
  output: [
    {
      name,
      file: path.resolve(__dirname, 'lib/index.umd.js'),
      format: 'umd',
      sourcemap: true,
    },
    {
      name,
      file: path.resolve(__dirname, 'lib/index.cjs.js'),
      format: 'cjs',
      sourcemap: true,
      exports: 'auto',
    },
    {
      name,
      file: path.resolve(__dirname, 'lib/index.esm.js'),
      format: 'es',
      sourcemap: true,
    },
  ],
  plugins: [
    sourcemaps(),
    commonjs(),
    babel({
      babelHelpers: 'bundled',
      exclude: 'node_modules/**',
    }),
  ]
}
