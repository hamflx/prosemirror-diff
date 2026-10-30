import {mountStandaloneDemo} from './standalone-demo.js'
import {mountMetadataDemo} from './metadata-demo.js'
document.body.classList.add('demo-surface','demo-metadata')
mountStandaloneDemo(mountMetadataDemo)
