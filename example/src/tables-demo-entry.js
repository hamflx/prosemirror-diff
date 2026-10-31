import {mountStandaloneDemo} from './standalone-demo.js'
import {mountTablesDemo} from './tables-demo.js'
document.body.classList.add('demo-surface','demo-tables')
mountStandaloneDemo(mountTablesDemo)
