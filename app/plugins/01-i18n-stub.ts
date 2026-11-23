// Templates copied from the dashboard call $t('puzzles.x'). Pocket is English only: resolve it from the bundled strings.
import { usePuzzleI18n } from '~/composables/usePuzzleI18n'

export default defineNuxtPlugin((nuxtApp) => {
  const { t, te } = usePuzzleI18n()
  nuxtApp.vueApp.config.globalProperties.$t = t
  nuxtApp.vueApp.config.globalProperties.$te = te
})
