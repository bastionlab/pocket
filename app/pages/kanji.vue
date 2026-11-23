<script setup lang="ts">
// the Kanji tab became Languages → Kanji (old links and bookmarks land here)
await navigateTo({ path: '/languages', query: { s: 'kanji' } }, { replace: true })
</script>

<template>
  <div />
</template>
