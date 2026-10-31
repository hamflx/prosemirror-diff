import {mountStandaloneDemo} from './standalone-demo.js'
import {mountLegacyDemo} from './legacy-migration-demo.js'
document.body.classList.add('demo-surface','demo-legacy')
mountStandaloneDemo(mountLegacyDemo)
