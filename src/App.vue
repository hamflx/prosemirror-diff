<script setup>
import * as Y from 'yjs'
import { newDocState, oldDocState } from '@/data'
import { diffEditor } from '@hamflx/prosemirror-diff'
import { EditorContent } from '@tiptap/vue-3'
import { onMounted, ref } from 'vue'
import {createEditor} from "./editor.js";

const versionList = ref([])
const ready = ref(false)

const editor = ref(null)

onMounted(() => {
  editor.value = createEditor()

  const docNode = diffEditor(editor.value.schema, oldDocState, newDocState)
  console.log('==> docNode', docNode)

  editor.value.commands.setContent(docNode.toJSON())

  ready.value = true
  versionList.value = [
    { name: 'old', doc: oldDocState },
    { name: 'new', doc: newDocState },
    { name: 'diff', doc: docNode.toJSON() }
  ]
})

const handleSwitchVersion = () => {}
</script>

<template>
  <div>
    <div>
      <template v-for="ver of versionList" :key="ver.name">
        <button @click="handleSwitchVersion(ver)">{{ ver.name }}</button>
      </template>
    </div>
    <EditorContent v-if="ready" class="editor__content" :editor="editor" />
  </div>
</template>

<style scoped>

</style>
