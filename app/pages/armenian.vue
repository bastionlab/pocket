<script setup lang="ts">
// the Armenian tab became Languages → Armenian (old links and bookmarks land here)
await navigateTo({ path: '/languages', query: { l: 'hy' } }, { replace: true })
</script>

<template>
  <div />
</template>
