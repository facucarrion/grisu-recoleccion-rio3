import { search, confirm } from '@inquirer/prompts';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(resolve(__dirname, 'data.json'), 'utf-8'));

const dayMap = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles',
  jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo'
};

function formatDays(days, dateRange) {
  if (dateRange) {
    return `${dayMap[dateRange.from]} a ${dayMap[dateRange.to]}`;
  }
  const mapped = days.map(d => dayMap[d] || d);
  if (mapped.length === 0) return '';
  if (mapped.length === 1) return mapped[0];
  if (mapped.length === 2) return `${mapped[0]} y ${mapped[1]}`;
  return `${mapped.slice(0, -1).join(', ')} y ${mapped[mapped.length - 1]}`;
}

const wasteMeta = {
  húmedos: { emoji: '📦', label: 'RESIDUOS HÚMEDOS' },
  verdes_inertes_voluminosos: { emoji: '🌿', label: 'RESIDUOS VERDES, INERTES Y VOLUMINOSOS' },
  reciclables_secos: { emoji: '♻️', label: 'RESIDUOS RECICLABLES SECOS' }
};

const allChoices = [];

const neighborhoodIndex = new Map();

for (const area of data.areas) {
  for (const schedule of area.schedules) {
    if (schedule.neighborhoods.length === 0) {
      const key = `__${area.name}__`;
      if (!neighborhoodIndex.has(key)) {
        neighborhoodIndex.set(key, { area: area.name, schedules: [] });
      }
      neighborhoodIndex.get(key).schedules.push(schedule);
    } else {
      for (const n of schedule.neighborhoods) {
        if (!neighborhoodIndex.has(n)) {
          neighborhoodIndex.set(n, { area: area.name, schedules: [] });
          allChoices.push(n);
        }
        neighborhoodIndex.get(n).schedules.push(schedule);
      }
    }
  }
}

allChoices.sort((a, b) => a.localeCompare(b, 'es'));

function printHeader() {
  console.log();
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║        🚮  RECOLECCIÓN RÍO TERCERO              ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log();
}

function printBarrioInfo(barrio, info) {
  console.log();
  console.log(`📍  ${barrio}`);
  console.log(`📍  Área ${info.area}`);
  console.log();

  const wasteOrder = ['húmedos', 'verdes_inertes_voluminosos', 'reciclables_secos'];
  const sorted = [...info.schedules].sort(
    (a, b) => wasteOrder.indexOf(a.wasteType) - wasteOrder.indexOf(b.wasteType)
  );

  for (const s of sorted) {
    const meta = wasteMeta[s.wasteType];
    console.log(`${meta.emoji}  ${meta.label}`);
    if (s.note) console.log(`   ${s.note}`);
    console.log(`   🗓️  ${formatDays(s.days, s.dateRange)}`);
    const tf = s.timeOfDay === 'mañana' ? 'MAÑANA' : 'TARDE';
    console.log(`   ⏰  ${tf} de ${data.timeRanges[s.timeOfDay]}`);
    console.log();
  }
}

async function main() {
  printHeader();

  while (true) {
    console.log('Escribí el nombre de tu barrio y seleccionalo con las flechitas ⬆⬇');
    console.log();

    const barrio = await search({
      message: 'Barrio:',
      source: (input) => {
        if (!input || input.trim() === '') return allChoices.slice(0, 8);
        const lower = input.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return allChoices
          .filter(n => n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(lower))
          .slice(0, 8);
      },
      pageSize: 8
    });

    printHeader();

    const info = neighborhoodIndex.get(barrio);
    if (info) {
      printBarrioInfo(barrio, info);
    } else {
      console.log();
      console.log('😕  No encontramos ese barrio en el sistema.');
      console.log();
    }

    console.log('──────────────────────────────────────────────');
    const again = await confirm({ message: '¿Consultar otro barrio?' });
    if (!again) {
      console.log();
      console.log('🙌  ¡Gracias por usar el sistema! 🚮');
      console.log('    Ante cualquier duda, consultá con el municipio.');
      console.log();
      break;
    }
    printHeader();
  }
}

main().catch(console.error);
