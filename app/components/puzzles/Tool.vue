<script setup lang="ts">
/** A toolbar button for `#tools` of <PuzzlesStage>: core ghost button, icon + short label, 40px (44 on touch). `on` = a toggle that is on.
 * `iconOnly` = a square icon button (label becomes aria-label / tooltip), for the stats bar `#actions`. */
defineProps<{ icon?: string, label: string, on?: boolean, disabled?: boolean, iconOnly?: boolean }>()
</script>

<template>
  <button type="button" class="btn sm ghost pzs-tool" :class="{ on, ico: iconOnly }" :aria-label="iconOnly ? label : undefined" :title="iconOnly ? label : undefined" :disabled="disabled" :aria-pressed="on === undefined ? undefined : on">
    <Icon v-if="icon" :name="icon" :size="16" />
    <span v-if="!iconOnly">{{ label }}</span>
  </button>
</template>
