/*
 * Static, deterministic QA captures of the shared TELO365 studio.
 * Start the local Vite server, then run:
 *   node tools/capture-studio-quality.mjs --port 4175
 *   node tools/capture-studio-quality.mjs --port 4175 --avatar male
 * TELO_DEV_PORT / TELO_REVIEW_AVATAR are supported as defaults.
 * Images and a capture manifest are written only under ignored artifacts/.
 * No geometry, animation, production media or review approval is modified.
 */
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { chromium } from 'playwright'

const { values } = parseArgs({ options: {
  port: { type: 'string', default: process.env.TELO_DEV_PORT || '4175' },
  avatar: { type: 'string', default: process.env.TELO_REVIEW_AVATAR || 'both' },
  size: { type: 'string', default: '1200' },
  help: { type: 'boolean', default: false },
} })
if (values.help) {
  console.log('node tools/capture-studio-quality.mjs [--port 4175] [--avatar male|female|both] [--size 1200]')
  process.exit(0)
}
const port = Number(values.port)
const size = Number(values.size)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid local Vite port')
if (!Number.isInteger(size) || size < 600 || size > 2048) throw new Error('--size must be an integer from 600 to 2048')
if (!['male', 'female', 'both'].includes(values.avatar)) throw new Error('--avatar must be male, female or both')

const root = resolve('.')
const output = join(root, 'artifacts', 'studio-quality-review')
const phaseFile = join(root, 'artifacts', 'squat-technique-review', 'phase-times.json')
const phaseData = JSON.parse(await readFile(phaseFile, 'utf8'))
const avatars = values.avatar === 'both' ? ['male', 'female'] : [values.avatar]
const views = ['front', 'side', 'back', 'three-quarter']
const phases = ['standing', 'bottom']
const viewLabels = { front: 'Спереди', side: 'Сбоку', back: 'Сзади', 'three-quarter': '3/4' }
const phaseLabels = { standing: 'Начало клипа', bottom: 'Нижняя точка' }
const avatarLabels = { male: 'Мужчина', female: 'Женщина' }
const errors = []
const manifest = {
  generatedBy: 'tools/capture-studio-quality.mjs',
  purpose: 'Visual QA of a single shared studio; does not approve exercise technique',
  createdAt: new Date().toISOString(),
  resolution: { width: size, height: size },
  phaseSource: 'artifacts/squat-technique-review/phase-times.json',
  avatars: {},
}
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: size + 80, height: size + 80 }, deviceScaleFactor: 1 })
page.on('pageerror', error => errors.push(error.message))
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
page.on('response', response => {
  if (response.status() >= 400 && response.url().startsWith(`http://127.0.0.1:${port}/`)) {
    errors.push(`HTTP ${response.status()}: ${response.url()}`)
  }
})

async function setState(state) {
  await page.evaluate(next => window.__teloSquatTechniqueReview.set(next), state)
  await page.waitForFunction(next => {
    const current = window.__teloSquatTechniqueReview?.status().state
    return current?.avatar === next.avatar && current.view === next.view
      && Math.abs(current.time - next.time) < 0.000001 && current.diagnostic === false
  }, state, { timeout: 15000 })
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))))
  await page.waitForTimeout(100)
}

async function createContactSheet(avatar, frames) {
  // A browser layout of existing QA screenshots: the individual source images
  // remain unchanged at full resolution. This sheet is only for comparison.
  const sheet = await browser.newPage({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 1 })
  try {
    await sheet.setContent('<!doctype html><html lang="ru"><meta charset="utf-8"><style>'
      + 'body{margin:0;padding:24px;background:#eef2eb;color:#294b39;font:16px/1.4 system-ui,sans-serif}'
      + 'h1{font-size:24px;margin:0 0 8px}p{margin:0 0 18px;color:#526858}'
      + '.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}'
      + 'figure{margin:0;background:#fff;border:1px solid #d4dfd2;border-radius:10px;overflow:hidden}'
      + 'img{display:block;width:100%;height:auto}figcaption{padding:9px 12px;font-size:14px}'
      + '</style><h1></h1><p></p><div class="grid"></div></html>')
    await sheet.evaluate(({ avatarLabel, frames }) => {
      document.querySelector('h1').textContent = `TELO365 — единая студия · ${avatarLabel}`
      document.querySelector('p').textContent = 'Оригинальный squat · одинаковая сцена и свет · камера неподвижна · кадры заданы точным временем клипа'
      const grid = document.querySelector('.grid')
      for (const frame of frames) {
        const figure = document.createElement('figure')
        const img = document.createElement('img')
        img.src = frame.dataUrl
        const caption = document.createElement('figcaption')
        caption.textContent = `${frame.phaseLabel} · ${frame.viewLabel} · ${frame.time.toFixed(6)} с`
        figure.append(img, caption)
        grid.append(figure)
      }
    }, { avatarLabel: avatarLabels[avatar], frames })
    await sheet.evaluate(() => Promise.all(Array.from(document.images, image => image.decode())))
    await sheet.screenshot({ path: join(output, `${avatar}-contact-sheet.png`), fullPage: true })
  } finally {
    await sheet.close()
  }
}

try {
  for (const avatar of avatars) {
    const detail = phaseData.avatars[avatar]
    if (!detail || !phases.every(phase => Number.isFinite(detail.phases[phase]))) {
      throw new Error(`Exact standing/bottom times are missing for ${avatar} in ${phaseFile}`)
    }
    const sourceBytes = await readFile(join(root, detail.source))
    const avatarOutput = join(output, avatar)
    await mkdir(avatarOutput, { recursive: true })
    await page.goto(`http://127.0.0.1:${port}/tools/squat-technique-review.html?avatar=${avatar}`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForFunction(() => Boolean(window.__teloSquatTechniqueReview), null, { timeout: 15000 })
    // Capture-only sizing removes the review-page card from the image and uses
    // a square, fixed camera aspect. Product UI styles are never changed.
    await page.addStyleTag({ content: `.squat-technique-review-stage{width:${size}px!important;height:${size}px!important;max-width:none!important;max-height:none!important;border:0!important;border-radius:0!important}` })
    const canvas = page.locator('.squat-technique-review-canvas canvas')
    await canvas.waitFor({ state: 'visible', timeout: 15000 })
    // Network idle means GLB fetch completed; Suspense + GPU uploads settle next.
    await page.waitForTimeout(1200)
    const frames = []
    const captures = []
    for (const phase of phases) {
      const time = detail.phases[phase]
      if (time < 0 || time > detail.durationSeconds) throw new Error(`Invalid ${phase} timestamp for ${avatar}`)
      for (const view of views) {
        await setState({ avatar, view, time, diagnostic: false })
        const filename = `${phase}-${view}.png`
        const buffer = await canvas.screenshot({ path: join(avatarOutput, filename) })
        frames.push({ phaseLabel: phaseLabels[phase], viewLabel: viewLabels[view], time, dataUrl: `data:image/png;base64,${buffer.toString('base64')}` })
        captures.push({ phase, view, timeSeconds: time, file: `${avatar}/${filename}`, sha256: createHash('sha256').update(buffer).digest('hex') })
        console.log(`${avatar}: ${phase} / ${view} @ ${time.toFixed(6)} s`)
      }
    }
    await createContactSheet(avatar, frames)
    manifest.avatars[avatar] = {
      sourceGlb: detail.source,
      sourceSha256: createHash('sha256').update(sourceBytes).digest('hex'),
      clip: detail.clip,
      durationSeconds: detail.durationSeconds,
      captures,
      contactSheet: `${avatar}-contact-sheet.png`,
    }
  }
  if (errors.length) throw new Error(`Browser errors during QA capture:\n${errors.join('\n')}`)
  const suffix = values.avatar === 'both' ? '' : `-${values.avatar}`
  await writeFile(join(output, `capture-manifest${suffix}.json`), JSON.stringify(manifest, null, 2) + '\n')
  console.log(`Studio QA captures saved to ${output}; no browser errors.`)
} catch (error) {
  const state = await page.evaluate(() => window.__teloSquatTechniqueReview?.status() || null).catch(() => null)
  console.error(JSON.stringify({ captureFailed: true, state, errors }, null, 2))
  throw error
} finally {
  await browser.close()
}
