const dayNames = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles',
  jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado'
}

const areaClass = { Roja: 'area-roja', Amarilla: 'area-amarilla', Azul: 'area-azul' }

const wasteMeta = {
  húmedos: { emoji: '📦', label: 'Residuos Húmedos', css: 'humedo' },
  verdes_inertes_voluminosos: { emoji: '🌿', label: 'Residuos Verdes, Inertes y Voluminosos', css: 'verde' },
  reciclables_secos: { emoji: '♻️', label: 'Residuos Reciclables Secos', css: 'reciclable' }
}

const wasteInfo = {
  húmedos: {
    ejemplos: ['🍎 Restos de comida y cáscaras', '🧉 Yerba, café, saquitos de té', '🥡 Servilletas y papeles sucios', '🧻 Pañales y artículos de higiene'],
    contener: 'En bolsa cerrada bien anudada'
  },
  verdes_inertes_voluminosos: {
    ejemplos: ['🌳 Ramas (hasta 1 metro)', '🧱 Escombros y restos de obra', '🪑 Muebles viejos en desuso', '🌿 Restos de poda y pasto'],
    contener: 'Ramas atadas con hilo. Escombros en bolsas resistentes. Muebles tal cual.',
    donde: 'En la vereda, el día de recolección'
  },
  reciclables_secos: {
    ejemplos: ['🥤 Envases de plástico y aluminio', '📦 Cartón y papel limpio y seco', '🍾 Vidrio (botellas y frascos)', '🧴 Envases limpios en general'],
    contener: 'En caja de cartón, bolsa transparente, bolsa verde, o bolsa identificada como "RECICLABLE". Limpios y secos.',
    donde: 'Canastos domiciliarios'
  }
}

const searchInput = document.getElementById('searchInput')
const dropdown = document.getElementById('dropdown')
const resultsDiv = document.getElementById('results')

let schedulesByNeighborhood = {}
let allNeighborhoods = []
let highlightedIndex = -1
let currentFiltered = []

function formatDays(days) {
  const mapped = days.map(d => dayNames[d] || d)
  if (mapped.length === 0) return ''
  if (mapped.length === 1) return mapped[0]
  if (mapped.length === 2) return `${mapped[0]} y ${mapped[1]}`
  return `${mapped.slice(0, -1).join(', ')} y ${mapped[mapped.length - 1]}`
}

function showWelcome() {
  resultsDiv.innerHTML = `
    <div class="card empty-state">
      <div class="big-icon">🏙️</div>
      <h2>Consultá tu barrio</h2>
      <p>Escribí el nombre de tu barrio arriba y te mostramos el cronograma de recolección</p>
    </div>
    </div>`
}

function renderDropdown(filter) {
  const q = filter.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  currentFiltered = q
    ? allNeighborhoods.filter(n => n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q))
    : allNeighborhoods

  if (currentFiltered.length === 0) {
    dropdown.innerHTML = '<div class="no-results">No encontramos ese barrio</div>'
    dropdown.classList.add('show')
    return
  }

  dropdown.innerHTML = currentFiltered.map(n => {
    const info = schedulesByNeighborhood[n]
    const cls = areaClass[info.area] || ''
    return `<div class="dropdown-item" data-value="${n}">${n} <span class="area-tag ${cls}">${info.area}</span></div>`
  }).join('')
  dropdown.classList.add('show')
  highlightedIndex = -1
}

function selectNeighborhood(name) {
  searchInput.value = name
  dropdown.classList.remove('show')
  showInfo(name)
}

function showInfo(name) {
  const info = schedulesByNeighborhood[name]
  if (!info) {
    resultsDiv.innerHTML = `
      <div class="card empty-state">
        <div class="big-icon">😕</div>
        <h2>No encontramos ese barrio</h2>
        <p>Probá buscando con otro nombre</p>
      </div>`
    return
  }

  const wasteOrder = ['húmedos', 'verdes_inertes_voluminosos', 'reciclables_secos']
  const sorted = [...info.schedules].sort(
    (a, b) => wasteOrder.indexOf(a.wasteType) - wasteOrder.indexOf(b.wasteType)
  )

  const areaCls = areaClass[info.area] || ''

  let html = `
    <div class="card">
      <div class="card-header">
        <span style="font-size:20px;">📍</span>
        <span style="font-size:18px;font-weight:600;">${name}</span>
        <span class="area-badge ${areaCls}">Área ${info.area}</span>
      </div>
    </div>`

  sorted.forEach((s, i) => {
    const meta = wasteMeta[s.wasteType]
    const info = wasteInfo[s.wasteType]
    const [hDesde, hHasta] = DATA.timeRanges[s.timeOfDay].split(' a ')
    const turno = s.timeOfDay === 'mañana' ? 'mañana' : 'tarde'
    const dondeText = info.donde || s.note || ''
    html += `
      <div class="schedule-card ${meta.css}" style="animation-delay:${0.12 + i * 0.1}s">
        <div class="schedule-type">
          <span class="waste-label">${meta.emoji} ${meta.label}</span>
          <button class="toggle-ejemplos-btn" data-expanded="false">▼ Ejemplos</button>
        </div>
        <div class="ejemplos-block">
          ${info.ejemplos.map(e => `<div class="ejemplo-item">${e}</div>`).join('')}
        </div>
        <div class="waste-info">
          <div class="waste-info-item"><span class="waste-info-label">📦 Cómo contenerlo</span><span>${info.contener}</span></div>
          ${dondeText ? `<div class="waste-info-item"><span class="waste-info-label">📍 Dónde desecharlo</span><span>${dondeText}</span></div>` : ''}
        </div>
        <hr class="schedule-sep">
        <div class="schedule-row">
          <span class="icon">🗓️</span>
          <span>${formatDays(s.days)}</span>
        </div>
        <div class="schedule-row">
          <span class="icon">⏰</span>
          <span><span class="schedule-turno">Por la ${turno}</span> entre las ${hDesde} y las ${hHasta} (una sola vez por día por domicilio)</span>
        </div>
      </div>`
  })

  resultsDiv.innerHTML = html
}

function init() {
  for (const area of DATA.areas) {
    for (const sched of area.schedules) {
      const timeRange = DATA.timeRanges[sched.timeOfDay]
      for (const n of sched.neighborhoods) {
        if (!schedulesByNeighborhood[n]) {
          schedulesByNeighborhood[n] = { area: area.name, schedules: [] }
        }
        schedulesByNeighborhood[n].schedules.push({ ...sched, timeRange })
      }
    }
  }

  allNeighborhoods = Object.keys(schedulesByNeighborhood).sort((a, b) => a.localeCompare(b, 'es'))

  searchInput.addEventListener('input', () => renderDropdown(searchInput.value))

  searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim() !== '') renderDropdown(searchInput.value)
  })

  searchInput.addEventListener('keydown', e => {
    const items = dropdown.querySelectorAll('.dropdown-item')
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      highlightedIndex = Math.min(highlightedIndex + 1, items.length - 1)
      items.forEach((el, i) => el.classList.toggle('highlighted', i === highlightedIndex))
      if (items[highlightedIndex]) items[highlightedIndex].scrollIntoView({ block: 'nearest' })
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      highlightedIndex = Math.max(highlightedIndex - 1, 0)
      items.forEach((el, i) => el.classList.toggle('highlighted', i === highlightedIndex))
      if (items[highlightedIndex]) items[highlightedIndex].scrollIntoView({ block: 'nearest' })
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlightedIndex >= 0 && items[highlightedIndex]) {
        selectNeighborhood(items[highlightedIndex].dataset.value)
      } else if (currentFiltered.length === 1) {
        selectNeighborhood(currentFiltered[0])
      }
    } else if (e.key === 'Escape') {
      dropdown.classList.remove('show')
    }
  })

  dropdown.addEventListener('click', e => {
    const item = e.target.closest('.dropdown-item')
    if (item) selectNeighborhood(item.dataset.value)
  })

  document.addEventListener('click', e => {
    if (!e.target.closest('.search-wrapper')) {
      dropdown.classList.remove('show')
    }
  })

  resultsDiv.addEventListener('click', e => {
    const btn = e.target.closest('.toggle-ejemplos-btn')
    if (!btn) return
    const expanded = btn.dataset.expanded === 'true'
    btn.dataset.expanded = !expanded
    btn.textContent = expanded ? '▼ Ejemplos' : '✕ Cerrar'
    btn.closest('.schedule-card').querySelector('.ejemplos-block').classList.toggle('show')
  })

  showWelcome()
}

init()
