const { rmSync, existsSync, readdirSync } = require('fs')
const { join } = require('path')
const { execSync } = require('child_process')

const root = process.cwd()
const nodeModules = join(root, 'node_modules')

// 1. Remove .next cache (Turbopack/webpack may have cached stale modules)
const nextDir = join(root, '.next')
if (existsSync(nextDir)) {
  console.log('Removing .next cache directory...')
  rmSync(nextDir, { recursive: true, force: true })
  console.log('Removed .next cache')
} else {
  console.log('.next cache not found')
}

// 2. Search all of .pnpm for anything matching tensorflow or mediapipe
const pnpmDir = join(nodeModules, '.pnpm')
if (existsSync(pnpmDir)) {
  const entries = readdirSync(pnpmDir)
  const staleEntries = entries.filter(e => 
    e.includes('tensorflow') || e.includes('mediapipe') || e.includes('body-segmentation')
  )
  if (staleEntries.length > 0) {
    for (const entry of staleEntries) {
      const fullPath = join(pnpmDir, entry)
      console.log(`Removing stale pnpm entry: ${entry}`)
      rmSync(fullPath, { recursive: true, force: true })
    }
  } else {
    console.log('No stale entries found in .pnpm/')
  }
}

// 3. Remove top-level hoisted packages
const topLevelStale = ['@tensorflow-models', '@tensorflow', '@mediapipe']
for (const dir of topLevelStale) {
  const fullPath = join(nodeModules, dir)
  if (existsSync(fullPath)) {
    console.log(`Removing hoisted package: ${dir}`)
    rmSync(fullPath, { recursive: true, force: true })
  }
}

// 4. Also check node_modules/.cache
const cacheDir = join(nodeModules, '.cache')
if (existsSync(cacheDir)) {
  console.log('Removing node_modules/.cache...')
  rmSync(cacheDir, { recursive: true, force: true })
  console.log('Removed .cache')
}

// 5. Run pnpm install to reconcile
console.log('Running pnpm install...')
try {
  execSync('pnpm install', { cwd: root, stdio: 'inherit' })
} catch (e) {
  console.log('pnpm install warning:', e.message)
}

console.log('Done! All caches and stale deps cleared.')
