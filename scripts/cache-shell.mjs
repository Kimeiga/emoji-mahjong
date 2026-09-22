import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const html = await readFile('dist/index.html', 'utf8')
const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(match => match[1])
const precache = ['/', '/manifest.json', ...new Set(assets)]
const version = createHash('sha256').update(html).digest('hex').slice(0, 12)
const template = await readFile('public/sw.js', 'utf8')
await writeFile('dist/sw.js', template.replace("'emoji-mahjong-dev'", JSON.stringify(`emoji-mahjong-${version}`)).replace('const PRECACHE = [];', `const PRECACHE = ${JSON.stringify(precache)};`))
