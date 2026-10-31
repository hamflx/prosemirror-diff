import {mountStandaloneDemo} from './standalone-demo.js'
import {mountBlocksDemo} from './blocks-demo.js'
document.body.classList.add('demo-surface','demo-blocks')
mountStandaloneDemo(mountBlocksDemo)
