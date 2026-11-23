<script setup lang="ts">
const cards = [
  { to: '/habits', name: 'Habits' },
  { to: '/puzzles', name: 'Puzzles' },
  { to: '/languages', name: 'Languages' },
  { to: '/notes', name: 'Notes' },
]

const standalone = ref(false)
const isIos = ref(false)
const deferred = ref<any>(null)

onMounted(() => {
  const nav = navigator as any
  standalone.value = window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true
  isIos.value = /iPhone|iPad|iPod/.test(navigator.userAgent)
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred.value = e
  })
  window.addEventListener('appinstalled', () => { standalone.value = true })
})

async function install() {
  if (!deferred.value) return
  deferred.value.prompt()
  await deferred.value.userChoice
  deferred.value = null
}
</script>

<template>
  <div>
    <h1>Bastion Pocket</h1>
    <p class="sub">Your add-ons, on this phone. Nothing leaves the device.</p>

    <NuxtLink v-for="c in cards" :key="c.to" :to="c.to" class="card">
      <strong>{{ c.name }}</strong>
    </NuxtLink>

    <NuxtLink to="/backup" class="card"><strong>Backup</strong><small>Save or restore your data</small></NuxtLink>

    <div v-if="!standalone && (deferred || isIos)" class="card">
      <strong>Install</strong>
      <button v-if="deferred" class="btn" type="button" @click="install">Install app</button>
      <small v-else>Tap the Share button in Safari, then Add to Home Screen.</small>
    </div>
  </div>
</template>
