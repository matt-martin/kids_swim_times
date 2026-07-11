import Chart from 'chart.js/auto';
import {
  EVENT_KEYS,
  eventLabel,
  formatTime,
  normalizePoints,
  type EventKey,
  type Swim,
  type SwimPoint,
  type Swimmer,
} from './lib/swim';
import './styles.css';

type AppData = { fetchedAt: string; swimmers: Swimmer[] };

const app = document.querySelector<HTMLDivElement>('#app')!;
let data: AppData | null = null;
let selectedId = '';
let charts: Chart[] = [];

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const axisDateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

function formatDate(value: string): string {
  return dateFormatter.format(new Date(`${value}T12:00:00`));
}

function formatAxisDate(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  return `${axisDateFormatter.format(date)} ’${String(date.getFullYear()).slice(-2)}`;
}

function renderLoading() {
  app.innerHTML = '<main class="shell loading"><div class="loader" aria-label="Loading swim times"></div><p>Pulling the swim story together…</p></main>';
}

function renderError() {
  app.innerHTML = '<main class="shell error-state"><p>We couldn’t load the swim times right now.</p><button class="button" data-action="retry">Try again</button></main>';
  app.querySelector('[data-action="retry"]')?.addEventListener('click', loadData);
}

function getSelected(): Swimmer {
  return data!.swimmers.find((swimmer) => swimmer.id === selectedId) ?? data!.swimmers[0];
}

function allPoints(swimmer: Swimmer): SwimPoint[] {
  return Object.values(swimmer.events)
    .flatMap((swims) => normalizePoints(swims ?? []))
    .sort((a, b) => a.date.localeCompare(b.date) || a.seconds - b.seconds);
}

function render() {
  if (!data) return;
  charts.forEach((chart) => chart.destroy());
  charts = [];
  const swimmer = getSelected();
  selectedId = swimmer.id;
  const points = allPoints(swimmer);
  const firstDate = points[0]?.date;
  const latestDate = points.at(-1)?.date;
  const best = points.length ? Math.min(...points.map((point) => point.comparableSeconds)) : null;
  const seasonCount = new Set(points.map((point) => point.date.slice(0, 4))).size;

  app.innerHTML = `
    <div class="site-shell">
      <header class="topbar shell">
        <a class="wordmark" href="/" aria-label="Swim Story home"><span class="wordmark-mark">≈</span><span>swim story</span></a>
        <div class="topbar-note"><span class="pulse-dot"></span>Summer by summer</div>
      </header>
      <main class="shell">
        <section class="intro">
          <div class="intro-copy">
            <p class="eyebrow">A little more water under the bridge</p>
            <h1>Every summer,<br><em>a little faster.</em></h1>
            <p class="lede">A visual scrapbook of the work your swimmer has put in—meet by meet, season by season.</p>
          </div>
          <div class="intro-wave" aria-hidden="true"><span>✦</span><div class="wave-line"></div><span>✦</span></div>
        </section>

        <nav class="kid-switcher" aria-label="Choose a swimmer">
          ${data.swimmers.map((kid) => `<button class="kid-tab ${kid.id === swimmer.id ? 'selected' : ''}" data-kid="${kid.id}" aria-pressed="${kid.id === swimmer.id}"><span class="kid-avatar avatar-${kid.id}">${kid.name[0]}</span><span>${kid.name}</span></button>`).join('')}
        </nav>

        <section class="story-header">
          <div>
            <p class="eyebrow">${swimmer.name}'s swim story</p>
            <h2>The long view.</h2>
            <p class="story-subtitle">Times are shown as seconds per 25 yards. A dashed line halves 50-yard swims so the story stays fair as the distance grows.</p>
          </div>
          <div class="stats" aria-label="Swim story summary">
            <div class="stat"><strong>${seasonCount || '—'}</strong><span>summer${seasonCount === 1 ? '' : 's'}</span></div>
            <div class="stat"><strong>${best === null ? '—' : formatTime(best)}</strong><span>fastest / 25 yd</span></div>
            <div class="stat"><strong>${latestDate ? formatDate(latestDate).split(',')[0] : '—'}</strong><span>most recent swim</span></div>
          </div>
        </section>

        <section class="charts-grid" aria-label="${swimmer.name}'s event charts">
          ${EVENT_KEYS.map((event) => chartCard(event, swimmer.events[event] ?? [])).join('')}
        </section>
        <p class="source-note">${firstDate ? `Showing ${formatDate(firstDate)} through ${latestDate ? formatDate(latestDate) : ''}.` : 'No results have been recorded yet.'} Data refreshed ${formatDate(data.fetchedAt.slice(0, 10))} from <a href="${swimmer.sourceUrl}" target="_blank" rel="noreferrer">Acorn Swim Database</a>.</p>
      </main>
      <footer class="footer shell"><span>Keep showing up. The numbers will follow.</span><span>♥ &nbsp; Made for the Martin swimmers</span></footer>
    </div>`;

  app.querySelectorAll<HTMLButtonElement>('[data-kid]').forEach((button) => {
    button.addEventListener('click', () => { selectedId = button.dataset.kid!; render(); });
  });
  EVENT_KEYS.forEach((event) => {
    const swims = swimmer.events[event] ?? [];
    if (swims.length) charts.push(createChart(event, swims));
  });
}

function chartCard(event: EventKey, swims: NonNullable<Swimmer['events'][EventKey]>) {
  const hasData = swims.length > 0;
  const labels = seriesLabels(swims);
  return `<article class="chart-card ${hasData ? '' : 'empty-card'}">
    <div class="card-heading"><div><p class="card-kicker">${hasData ? `${swims.length} swims tracked` : 'Not in the record yet'}</p><h3>${eventLabel(event)}</h3></div><span class="event-badge">${event === 'individual-medley' ? 'IM' : event.slice(0, 2).toUpperCase()}</span></div>
    ${hasData ? `<div class="legend"><span><i class="legend-line solid"></i>${labels.primaryLabel}</span>${labels.hasSplit ? '<span><i class="legend-line dashed"></i>50 yd ÷ 2</span>' : ''}</div><div class="chart-wrap"><canvas data-chart="${event}" aria-label="${eventLabel(event)} times over time"></canvas></div>` : `<div class="empty-content"><span class="empty-icon">✦</span><p>There aren’t any ${eventLabel(event).toLowerCase()} results in the current record. If this event makes an appearance, it will join the story here.</p></div>`}
  </article>`;
}

function seriesLabels(swims: Swim[]) {
  const primaryDistances = [...new Set(swims.filter((swim) => swim.distance !== 50).map((swim) => swim.distance))].sort((a, b) => a - b);
  return {
    primaryLabel: primaryDistances.map((distance) => `${distance} yd`).join(' / ') || 'Other distance',
    hasSplit: swims.some((swim) => swim.distance === 50),
  };
}

function createChart(event: EventKey, swims: NonNullable<Swimmer['events'][EventKey]>): Chart {
  const points = normalizePoints(swims);
  const labelsInfo = seriesLabels(swims);
  const canvas = document.querySelector<HTMLCanvasElement>(`[data-chart="${event}"]`)!;
  const labels = points.map((point) => point.date);
  const normal = points.map((point) => point.isSplit ? null : point.comparableSeconds);
  const split = points.map((point) => point.isSplit ? point.comparableSeconds : null);
  const datasets = [
    { label: labelsInfo.primaryLabel, data: normal, borderColor: '#ef765d', backgroundColor: '#ef765d', pointRadius: 3.5, pointHoverRadius: 6, borderWidth: 2.5, borderDash: [] as number[], tension: 0.22, spanGaps: false },
  ];
  if (labelsInfo.hasSplit) datasets.push({ label: '50 yd ÷ 2', data: split, borderColor: '#276c83', backgroundColor: '#276c83', pointRadius: 3.5, pointHoverRadius: 6, borderWidth: 2.5, borderDash: [7, 6], tension: 0.22, spanGaps: false });
  return new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { display: false },
        tooltip: {
          padding: 12,
          backgroundColor: '#092f43',
          titleColor: '#f5f2eb',
          bodyColor: '#f5f2eb',
          callbacks: {
            title: (items) => formatDate(String(items[0].label)),
            label: (item) => `${item.dataset.label}: ${formatTime(Number(item.raw))} sec`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#68818b', maxRotation: 0, autoSkip: true, maxTicksLimit: 6, callback: (value) => formatAxisDate(labels[Number(value)] ?? labels[0]) },
          border: { display: false },
        },
        y: {
          reverse: true,
          grid: { color: 'rgba(9, 47, 67, 0.08)' },
          ticks: { color: '#68818b', callback: (value) => `${Number(value).toFixed(0)}s` },
          title: { display: true, text: `${event === 'individual-medley' ? 'seconds' : 'seconds / 25 yd'}  ·  faster ↑`, color: '#68818b', font: { size: 11, weight: 'bold' } },
          border: { display: false },
        },
      },
    },
  });
}

async function loadData() {
  renderLoading();
  try {
    const response = await fetch('/data/swim-times.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    data = await response.json() as AppData;
    selectedId = data.swimmers[0]?.id ?? '';
    render();
  } catch (error) {
    console.error(error);
    renderError();
  }
}

loadData();
