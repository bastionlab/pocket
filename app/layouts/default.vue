<script setup lang="ts">
const route = useRoute()
const router = useRouter()

const tabs = [
  { to: '/', label: 'Home', icon: 'home' },
  { to: '/habits', label: 'Habits', icon: 'check' },
  { to: '/puzzles', label: 'Puzzles', icon: 'gamepad' },
  { to: '/languages', label: 'Languages', icon: 'languages' },
  { to: '/notes', label: 'Notes', icon: 'note' },
]
const titles: Record<string, string> = {
  '/': 'Bastion Pocket', '/habits': 'Habits', '/puzzles': 'Puzzles',
  '/languages': 'Languages', '/notes': 'Notes', '/backup': 'Backup',
}
const base = computed(() => '/' + (route.path.split('/')[1] || ''))
const title = computed(() => titles[base.value] || 'Bastion Pocket')
// pages open their sub-views through query keys (puzzle game g, note n, habit h, study/kanji/vocab/grammar ...) and push a history entry
const DETAIL = ['g', 'n', 'h', 'study', 'k', 'd', 'v', 'p']
const inDetail = computed(() => DETAIL.some(k => route.query[k] !== undefined))
const isRoot = computed(() => tabs.some(t => t.to === route.path) && !inDetail.value)
const active = (to: string) => to === '/' ? route.path === '/' : base.value === to

useHead({ title: computed(() => base.value === '/' ? 'Bastion Pocket' : `${title.value} - Bastion Pocket`) })

function back() {
  if (window.history.state?.back) router.back()
  else if (inDetail.value) router.replace(route.path) // opened by link: drop the sub-view, stay on the page
  else router.push('/')
}
</script>

<template>
  <div class="shell">
    <nav class="side" aria-label="Main">
      <div class="brand">Bastion</div>
      <NuxtLink v-for="t in tabs" :key="t.to" :to="t.to" class="nav" :class="{ on: active(t.to) }">
        <Icon :name="t.icon" :size="18" /><span>{{ t.label }}</span>
      </NuxtLink>
      <NuxtLink to="/backup" class="nav bottom" :class="{ on: active('/backup') }">
        <Icon name="download" :size="18" /><span>Backup</span>
      </NuxtLink>
    </nav>

    <div class="main">
      <header class="top">
        <button v-if="!isRoot" class="hbtn" type="button" aria-label="Back" @click="back">
          <Icon name="chevron-left" :size="22" />
        </button>
        <span v-else class="hbtn ghost" aria-hidden="true" />
        <h1 class="ttl">{{ title }}</h1>
        <NuxtLink to="/backup" class="hbtn" aria-label="Backup"><Icon name="download" :size="20" /></NuxtLink>
      </header>
      <main class="wrap"><slot /></main>
    </div>

    <nav class="tabbar" aria-label="Main">
      <NuxtLink v-for="t in tabs" :key="t.to" :to="t.to" class="tab" :class="{ on: active(t.to) }">
        <Icon :name="t.icon" :size="22" /><span>{{ t.label }}</span>
      </NuxtLink>
    </nav>
  </div>
</template>

<style>
.shell { min-height: 100dvh; display: flex; }
.shell .side { display: none; }
.shell .tabbar { display: none; }
.shell .main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.shell .top {
  position: sticky; top: 0; z-index: 20; display: flex; align-items: center; gap: 4px;
  padding: env(safe-area-inset-top) 8px 0; min-height: calc(52px + env(safe-area-inset-top));
  background: var(--bg); border-bottom: 1px solid var(--line);
}
.shell .hbtn {
  display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px;
  border: 0; background: transparent; color: var(--text); border-radius: var(--radius-sm); padding: 0;
}
.shell .hbtn.ghost { pointer-events: none; }
.shell .hbtn:active { background: var(--panel-2); }
.shell .ttl { flex: 1; margin: 0; text-align: center; font-size: 1rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.shell .wrap { width: 100%; max-width: 900px; margin: 0 auto; padding: 16px 14px calc(24px + var(--tabbar)); }

@media (max-width: 760px) {
  .shell { --tabbar: calc(58px + env(safe-area-inset-bottom)); }
  .shell .tabbar {
    display: flex; position: fixed; left: 0; right: 0; bottom: 0; z-index: 30;
    height: var(--tabbar); padding-bottom: env(safe-area-inset-bottom);
    background: var(--panel); border-top: 1px solid var(--line);
  }
  .shell .tab {
    flex: 1; min-width: 0; min-height: 44px; display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 2px; color: var(--muted); font-size: 10.5px; text-decoration: none;
  }
  .shell .tab.on { color: var(--accent); }
}
@media (min-width: 761px) {
  .shell .side {
    display: flex; flex-direction: column; gap: 4px; width: 200px; flex: none; padding: 16px 10px;
    position: sticky; top: 0; height: 100dvh; background: var(--panel); border-right: 1px solid var(--line);
  }
  .shell .brand { font-weight: 700; padding: 6px 12px 14px; }
  .shell .nav {
    display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 0 12px;
    border-radius: var(--radius-sm); color: var(--muted); text-decoration: none;
  }
  .shell .nav.on { color: var(--accent); background: var(--accent-soft); }
  .shell .nav.bottom { margin-top: auto; }
}
@media (prefers-reduced-motion: no-preference) {
  .shell .tab, .shell .nav, .shell .hbtn { transition: color var(--dur) var(--ease-out), background var(--dur) var(--ease-out); }
}

.sub { color: var(--muted); margin: 0 0 20px; }
.card { display: flex; flex-direction: column; justify-content: center; gap: 2px; min-height: 52px; padding: 14px 16px; margin-bottom: 10px; background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); color: var(--text); text-decoration: none; }
.card:hover { text-decoration: none; }
.card strong { font-size: 1.05rem; }
.card small { color: var(--muted); }
</style>
