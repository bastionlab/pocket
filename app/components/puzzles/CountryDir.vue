<script setup lang="ts">
/** an arrow that points along a compass bearing (0 = up/north, 90 = right/east) */
defineProps<{ deg: number, size?: number }>()
</script>

<template>
  <svg class="cdir" :width="size ?? 20" :height="size ?? 20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" :style="{ transform: `rotate(${deg}deg)` }">
    <path d="M12 20V5" /><path d="m6 11 6-6 6 6" />
  </svg>
</template>

<style scoped>
.cdir { flex: none; }
</style>
