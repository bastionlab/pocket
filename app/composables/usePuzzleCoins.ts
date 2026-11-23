import { isRandomDay } from '../utils/puzzles/registry'

/** what GET /api/puzzles tells about coins (the rest of the overview is the page's business) */
export interface PuzzleRewards { base: number, perStreak: number, maxStreak: number, archive: number }
export interface PuzzleOverview { today: string, coins: number, hintCosts: Record<string, number>, rewards: PuzzleRewards, games: any[] }

const DEFAULT_COST = 6
let inflight: Promise<PuzzleOverview | null> | null = null

/**
 * The global coin balance + hint prices, shared by the page and every game (useState). The server decides all numbers:
 * games ask `buyHint(game, day)` and only reveal the hint when it resolves true.
 */
export function usePuzzleCoins() {
  const coins = useState<number>('puzzles:coins', () => 0)
  const costs = useState<Record<string, number>>('puzzles:costs', () => ({}))
  const rewards = useState<PuzzleRewards | null>('puzzles:rewards', () => null)
  const loaded = useState<boolean>('puzzles:coins:loaded', () => false)
  const { toast } = useToast()
  const { t } = usePuzzleI18n()

  function apply(o: Partial<PuzzleOverview> | null) {
    if (!o) return
    if (typeof o.coins === 'number') coins.value = o.coins
    if (o.hintCosts) costs.value = o.hintCosts
    if (o.rewards) rewards.value = o.rewards
    loaded.value = true
  }

  /** re-read the overview (the same request is shared when several callers ask at once); returns it for the page */
  function refresh(): Promise<PuzzleOverview | null> {
    if (!inflight) {
      inflight = $fetch<PuzzleOverview>('/api/puzzles').then((o) => { apply(o); return o }).finally(() => { inflight = null })
    }
    return inflight
  }

  // a leveled game's key is `<id>:<level>`: the price belongs to the game
  const hintCost = (game: string) => costs.value[game] ?? costs.value[game.split(':')[0]!] ?? DEFAULT_COST

  /** spend the hint price; true = bought (reveal the hint), false = not enough coins (a toast is shown) */
  async function buyHint(game: string, day: string): Promise<boolean> {
    if (isRandomDay(day)) return true // random games are free practice: no coins, no server call
    try {
      const r = await $fetch<{ ok: boolean, coins: number }>('/api/puzzles/hint', { method: 'POST', body: { game, day } })
      coins.value = r.coins
      return true
    } catch (e: any) {
      if (e?.statusCode === 402 || e?.status === 402 || e?.response?.status === 402) {
        if (typeof e?.data?.coins === 'number') coins.value = e.data.coins
        toast(t('puzzles.coins.notEnough', { n: hintCost(game) }), { tone: 'bad' })
      } else {
        toast(e?.data?.statusMessage || e?.message || t('puzzles.coins.hintFailed'), { tone: 'bad' })
      }
      return false
    }
  }

  if (import.meta.client && !loaded.value && !inflight) refresh().catch(() => {})

  return { coins, rewards, hintCost, buyHint, refresh, apply }
}
