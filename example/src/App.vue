<script setup>
import { newDocState, oldDocState } from '@/data'
import { diffEditor } from '@hamflx/prosemirror-diff'
import { EditorContent } from '@tiptap/vue-3'
import {onMounted, ref, shallowRef, watchEffect} from 'vue'
import {createEditor} from "./editor.js";

const versionList = ref([])
const ready = ref(false)
const currentTabName = ref('diff')
const editor = shallowRef(null)

onMounted(() => {
  editor.value = createEditor()
  window.editor = editor.value

  editor.value.on('update', ({editor})=>{
    localStorage.setItem('editor-data-' + currentTabName.value, JSON.stringify(editor.getJSON()))
  })

  reloadDiff()
})

watchEffect(() => {
  const doc = versionList.value.find(v => v.name === currentTabName.value)?.doc
  if (doc && ready.value) {
    setTimeout(() => {
      editor.value.commands.setContent(JSON.parse(JSON.stringify(doc)))
    })
  }
})

const reloadDiff = () => {
  const oldSavedState = getSavedJson('editor-data-old') || oldDocState
  const newSavedState = getSavedJson('editor-data-new') || newDocState

  const docNode = diffEditor(editor.value.schema, oldSavedState, newSavedState)
  window.oldDoc = oldSavedState
  window.newDoc = newSavedState
  console.log('==> oldSavedState', oldSavedState)
  console.log('==> newSavedState', newSavedState)
  console.log('==> docNode', docNode)

  ready.value = true
  versionList.value = [
    { name: 'old', doc: oldSavedState },
    { name: 'new', doc: newSavedState },
    { name: 'diff', doc: docNode.toJSON() }
  ]
}

const handleSwitchVersion = ver => {
  if (ver.name === 'diff') {
    reloadDiff()
  }
  currentTabName.value = ver.name
}

const getSavedJson = key => {
  const value = localStorage.getItem(key)
  if (value) {
    return JSON.parse(value)
  }
  return undefined
}
</script>

<template>
  <div>
    <div>
      <template v-for="ver of versionList" :key="ver.name">
        <button :class="{ isActive: currentTabName === ver.name }" @click="handleSwitchVersion(ver)">{{ ver.name }}</button>
      </template>
    </div>
    <EditorContent v-if="ready" class="editor__content" :editor="editor" />
  </div>
</template>

<style scoped>
.isActive {
  background-color: rgb(234, 0, 94);
  color: #fff;
}
</style>
