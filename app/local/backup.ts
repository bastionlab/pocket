import { kv } from './store'

export async function exportBackup() {
  const blob = new Blob([JSON.stringify({ app: 'bastion-pocket', v: 1, at: new Date().toISOString(), data: await kv.dump() })], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'bastion-pocket-' + new Date().toISOString().slice(0, 10) + '.json'
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}

export async function importBackup(file: File): Promise<number> {
  const j = JSON.parse(await file.text())
  if (j?.app !== 'bastion-pocket' || typeof j.data !== 'object') throw new Error('Not a Pocket backup file')
  await kv.restore(j.data)
  return Object.keys(j.data).length
}
