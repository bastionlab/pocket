<script setup lang="ts">
import { exportBackup, importBackup } from '~/local/backup'
const msg = ref('')
async function onPick(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  try { msg.value = 'Restored ' + await importBackup(f) + ' items. Reload the app to see them.' } catch (err: any) { msg.value = err.message }
}
</script>

<template>
  <div>
    <NuxtLink to="/">Back</NuxtLink>
    <h1>Backup</h1>
    <p class="sub">Everything lives only on this phone. Save a backup file now and then, especially before clearing browser data.</p>
    <button class="btn" type="button" @click="exportBackup">Save backup file</button>
    <p><label class="btn">Restore from file<input type="file" accept="application/json" hidden @change="onPick"></label></p>
    <p v-if="msg">{{ msg }}</p>
  </div>
</template>
