# Strict consumer fixtures

Run each with TypeScript 5.9.3, for example:

```sh
npm exec --package=typescript@5.9.3 -- tsc -p test/types/tsconfig.package.json
npm exec --package=typescript@5.9.3 -- tsc -p test/types/tsconfig.package-nodenext.json
npm exec --package=typescript@5.9.3 -- tsc -p test/types/tsconfig.source.json
npm exec --package=typescript@5.9.3 -- tsc -p test/types/tsconfig.source-nodenext.json
node test/smoke-type-exports.mjs
```

The package fixtures resolve the repository's package entry and declarations.
They check real positive uses and negative field/option/JSON/mark-operation
contracts. An unused `@ts-expect-error` fails compilation, catching `any` leaks.
Library checking is enabled. JavaScript-source consumer checking is separate
from the existing full-source `--checkJs` command; no sibling source declaration
replaces the JavaScript implementation.

The source NodeNext fixture deliberately checks metadata record shapes only.
ProseMirror 1.18.1's CommonJS export path lacks its declaration, so source Node
parameters and preserved block nodes can remain `any` in that mode. The additional
`source-nodes.ts` negative cases run only with Bundler resolution. Package types
explicitly select the dependency's ESM type resolution and retain these Node
contracts in both tested modes. This does not fix applications' own direct
CommonJS imports from that dependency.
