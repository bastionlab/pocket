<script setup lang="ts">
const cards = [
  { to: '/habits', name: 'Habits', icon: 'check', desc: 'Build streaks' },
  { to: '/puzzles', name: 'Puzzles', icon: 'gamepad', desc: 'Daily puzzles and quizzes' },
  { to: '/languages', name: 'Languages', icon: 'languages', desc: 'Kana, kanji and more' },
  { to: '/notes', name: 'Notes', icon: 'note', desc: 'Quick notes with todos' },
  { to: '/backup', name: 'Backup', icon: 'download', desc: 'Save or restore your data' },
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
    <p class="sub">Your add-ons, on this phone. Nothing leaves the device.</p>

    <HomeToday />

    <div class="grid">
      <NuxtLink v-for="c in cards" :key="c.to" :to="c.to" class="card tile">
        <Icon :name="c.icon" :size="22" />
        <strong>{{ c.name }}</strong>
        <small>{{ c.desc }}</small>
      </NuxtLink>
    </div>

    <div v-if="!standalone && (deferred || isIos)" class="card">
      <strong>Install</strong>
      <button v-if="deferred" class="btn primary" type="button" @click="install">Install app</button>
      <small v-else>Tap the Share button in Safari, then Add to Home Screen.</small>
    </div>
  </div>
</template>

<style scoped>
.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-bottom: 10px; }
.tile { margin-bottom: 0; gap: 4px; min-height: 96px; justify-content: flex-start; }
.tile :deep(.icon) { color: var(--accent); margin-bottom: 4px; }
@media (min-width: 761px) { .grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
</style>
