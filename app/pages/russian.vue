<script setup lang="ts">
// the Russian link lands on Languages → Russian
await navigateTo({ path: '/languages', query: { l: 'ru' } }, { replace: true })
</script>

<template>
  <div />
</template>
