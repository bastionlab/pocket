<template>
  <main class="wrap">
    <NuxtPage />
  </main>
</template>

<style>
.wrap { max-width: 760px; margin: 0 auto; padding: 16px 14px calc(24px + env(safe-area-inset-bottom)); }
.sub { color: var(--muted); margin: 0 0 20px; }
.card { display: flex; flex-direction: column; justify-content: center; gap: 2px; min-height: 52px; padding: 14px 16px; margin-bottom: 10px; background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); color: var(--text); text-decoration: none; }
.card:hover { text-decoration: none; }
.card strong { font-size: 1.05rem; }
.card small { color: var(--muted); }
.btn { min-height: 44px; padding: 0 18px; border: 0; border-radius: var(--radius-sm); background: var(--accent); color: #0a0c10; font: inherit; font-weight: 600; }
</style>
