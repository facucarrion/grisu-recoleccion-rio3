import { input, confirm } from '@inquirer/prompts'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { findZone } from './zones.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const data = JSON.parse(readFileSync(resolve(__dirname, '..', 'data.json'), 'utf-8'))

const dayMap = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles',
  jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado'
}

function formatDays(days) {
  const mapped = days.map(d => dayMap[d] || d)
  if (mapped.length === 0) return ''
  if (mapped.length === 1) return mapped[0]
  if (mapped.length === 2) return `${mapped[0]} y ${mapped[1]}`
  return `${mapped.slice(0, -1).join(', ')} y ${mapped[mapped.length - 1]}`
}

function buildAreaIndex() {
  const index = {}
  for (const area of data.areas) {
    index[area.name] = { name: area.name, schedules: area.schedules }
  }
  return index
}

const areaIndex = buildAreaIndex()

const wasteMeta = {
  húmedos: { emoji: '📦', label: 'RESIDUOS HÚMEDOS' },
  verdes_inertes_voluminosos: { emoji: '🌿', label: 'RESIDUOS VERDES, INERTES Y VOLUMINOSOS' },
  reciclables_secos: { emoji: '♻️', label: 'RESIDUOS RECICLABLES SECOS' }
}

function printAreaInfo(area, lat, lng, address) {
  console.log()
  console.log('╔══════════════════════════════════════════════════╗')
  console.log('║      📍  UBICACIÓN POR DIRECCIÓN                ║')
  console.log('╚══════════════════════════════════════════════════╝')
  console.log()
  console.log(`🏠  ${address}`)
  console.log(`🌎  ${lat.toFixed(5)}, ${lng.toFixed(5)}`)
  console.log(`📍  Área ${area.name}`)
  console.log()

  const wasteOrder = ['húmedos', 'verdes_inertes_voluminosos', 'reciclables_secos']
  const sorted = [...area.schedules].sort(
    (a, b) => wasteOrder.indexOf(a.wasteType) - wasteOrder.indexOf(b.wasteType)
  )

  for (const s of sorted) {
    const meta = wasteMeta[s.wasteType]
    const tf = s.timeOfDay === 'mañana' ? '⏰  MAÑANA' : '⏰  TARDE'
    console.log(`${meta.emoji}  ${meta.label}`)
    if (s.note) console.log(`   ${s.note}`)
    console.log(`   🗓️  ${formatDays(s.days, s.dateRange)}`)
    console.log(`   ${tf} de ${data.timeRanges[s.timeOfDay]}`)
    console.log()
  }
}

function extractStreet(input) {
  return input.replace(/\s+\d+\s*[-/]?\s*\d*[a-zA-Z]?\s*$/, '').trim()
}

async function nominatimSearch(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=ar`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'GIRSU-RioTercero/1.0 (consulta de recoleccion)' }
  })
  if (!res.ok) throw new Error('Error HTTP ' + res.status)
  return await res.json()
}

async function geocodeAddress(address) {
  const variations = [
    address,
    address.normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
    address.replace(/[sz]/gi, ''),
    address.replace(/b|v/gi, '')
  ]
  const seen = new Set()
  const queries = []
  for (const v of variations) {
    for (const suffix of [', Río Tercero, Córdoba, Argentina', '']) {
      const full = `${extractStreet(v)}${suffix}`.trim()
      if (!seen.has(full.toLowerCase())) {
        seen.add(full.toLowerCase())
        queries.push(full)
      }
    }
  }
  queries.unshift(`${address}, Río Tercero, Córdoba, Argentina`)

  for (const q of queries) {
    const json = await nominatimSearch(q)
    const match = json.find(r =>
      r.display_name?.toLowerCase().includes('río tercero') ||
      r.display_name?.toLowerCase().includes('riotercero')
    )
    if (match) {
      return {
        lat: parseFloat(match.lat),
        lng: parseFloat(match.lon),
        displayName: match.display_name.split(',')[0]
      }
    }
  }

  const suggestions = await findSuggestions(extractStreet(address))
  return { suggestions }
}

function normalize(str) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

async function findSuggestions(streetName) {
  const json = await nominatimSearch(`${streetName}, Río Tercero, Córdoba, Argentina`)
  const rioTercero = json.filter(r =>
    r.display_name?.toLowerCase().includes('río tercero') ||
    r.display_name?.toLowerCase().includes('riotercero')
  )
  const rawNames = [...new Set(rioTercero.map(r => r.display_name.split(',')[0].trim()))]

  if (rawNames.length > 0) return rawNames.slice(0, 6)

  const words = normalize(streetName).split(/\s+/).filter(w => w.length > 3)
  for (const word of words) {
    const json2 = await nominatimSearch(`${word}, Río Tercero, Córdoba, Argentina`)
    const matches = json2.filter(r =>
      r.display_name?.toLowerCase().includes('río tercero') ||
      r.display_name?.toLowerCase().includes('riotercero')
    )
    const names = [...new Set(matches.map(r => r.display_name.split(',')[0].trim()))]
    if (names.length > 0) return names.slice(0, 6)
  }

  return []
}

async function main() {
  console.log()
  console.log('╔══════════════════════════════════════════════════╗')
  console.log('║      📍  RECOLECCIÓN POR DIRECCIÓN               ║')
  console.log('╚══════════════════════════════════════════════════╝')
  console.log()
  console.log('Ingresá una dirección para saber en qué área de recolección estás.')
  console.log()

  while (true) {
    const address = await input({
      message: 'Calle y número (ej: 25 de Mayo 912):',
      validate: v => v.trim().length > 0 || 'Escribí una dirección'
    })

    console.log()
    console.log('🔍  Buscando ubicación...')
    console.log()

    let result
    try {
      result = await geocodeAddress(address)
    } catch (err) {
      console.log('⚠️  Error al geocodificar. Verificá tu conexión a internet.')
      console.log()
      const again = await confirm({ message: '¿Intentar con otra dirección?' })
      if (!again) break
      continue
    }

    if (!result || result.suggestions) {
      const suggestions = result?.suggestions
      if (suggestions && suggestions.length > 0) {
        console.log('😕  No encontramos exactamente esa dirección.')
        console.log('   Quizás quisiste decir:')
        suggestions.forEach(s => console.log(`      • ${s}`))
        console.log()
      } else {
        console.log('😕  No encontramos esa dirección en Río Tercero.')
      }
      console.log('   Probá escribiendo la calle y número de forma más exacta.')
      console.log('   Ejemplo: "25 de Mayo 912" o "San Martín 500"')
      console.log()
      const again = await confirm({ message: '¿Intentar con otra dirección?' })
      if (!again) break
      console.log()
      continue
    }

    const zone = findZone(result.lat, result.lng)

    if (!zone) {
      console.log(`🏠  ${address}`)
      console.log(`🌎  ${result.lat.toFixed(5)}, ${result.lng.toFixed(5)}`)
      console.log()
      console.log('😕  Esa dirección está fuera de las zonas de recolección mapeadas.')
      console.log('   Probá buscando por nombre de barrio en la app principal.')
      console.log()
    } else {
      const area = areaIndex[zone.area]
      printAreaInfo(area, result.lat, result.lng, address)
    }

    console.log('──────────────────────────────────────────────')
    const again = await confirm({ message: '¿Consultar otra dirección?' })
    if (!again) {
      console.log()
      console.log('🙌  ¡Gracias por usar el sistema! 🚮')
      console.log()
      break
    }
    console.log()
  }
}

main().catch(console.error)
