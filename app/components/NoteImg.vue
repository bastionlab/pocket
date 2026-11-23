<script setup lang="ts">
/** a note image from local storage; link = open it full size in a new tab */
const props = defineProps<{ name: string, link?: boolean }>()
const url = useNoteImg(() => props.name)
</script>

<template>
  <a v-if="link && url" :href="url" target="_blank" rel="noopener"><img :src="url" alt="" loading="lazy"></a>
  <img v-else-if="url" :src="url" alt="" loading="lazy">
  <span v-else class="ph" />
</template>

<style scoped>
.ph { display: block; width: 100%; height: 100%; min-height: 40px; background: var(--panel-2); }
</style>
