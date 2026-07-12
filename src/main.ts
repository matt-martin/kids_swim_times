import Chart from 'chart.js/auto';
import type { Plugin } from 'chart.js';
import {
  EVENT_KEYS,
  eventLabel,
  eventShortLabel,
  formatTime,
  normalizePoints,
  speedInMilesPerHour,
  type EventKey,
  standardColor,
  type StandardLevel,
  type SwimPoint,
  type Swimmer,
} from './lib/swim';
import { alignSeriesToTimeline, chartAxis, chartLineOptions, chartModeLabel, chartSeries, DEFAULT_CHART_MODE, eventMetricItems, eventMetrics, nearestTimelineIndex, nextHoverState, seasonBands, timelineLabels, tooltipDetails, type ChartMode, type HoverState } from './lib/chartData';
import { assetPath } from './lib/paths';
import './styles.css';

type AppData = { fetchedAt: string; swimmers: Swimmer[] };

const app = document.querySelector<HTMLDivElement>('#app')!;
const isTouchPrimaryInput = window.matchMedia('(hover: none), (pointer: coarse)').matches;
let data: AppData | null = null;
let selectedId = '';
let viewMode: ChartMode = DEFAULT_CHART_MODE;
let charts: Chart[] = [];
let sharedHoverState: HoverState = { index: null, locked: false };
let ignoreSyntheticMouseUntil = 0;

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const axisDateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

function formatDate(value: string): string {
  return dateFormatter.format(new Date(`${value}T12:00:00`));
}

function formatAxisDate(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  return `${axisDateFormatter.format(date)} ’${String(date.getFullYear()).slice(-2)}`;
}

const summerBackgroundPlugin: Plugin<'line'> = {
  id: 'summerBackground',
  beforeDraw(chart) {
    const { chartArea, ctx, scales } = chart;
    const x = scales.x;
    if (!chartArea || !x) return;
    const labels = (chart.data.labels ?? []).map(String);
    ctx.save();
    for (const band of seasonBands(labels)) {
      if (!band.alternate) continue;
      const start = band.start === 0
        ? chartArea.left
        : (x.getPixelForValue(band.start - 1) + x.getPixelForValue(band.start)) / 2;
      const end = band.end === labels.length - 1
        ? chartArea.right
        : (x.getPixelForValue(band.end) + x.getPixelForValue(band.end + 1)) / 2;
      ctx.fillStyle = 'rgba(39, 108, 131, 0.055)';
      ctx.fillRect(start, chartArea.top, end - start, chartArea.bottom - chartArea.top);
    }
    ctx.restore();
  },
};

const sharedHoverPlugin: Plugin<'line'> = {
  id: 'sharedHover',
  afterEvent(chart, args) {
    const { event } = args;
    if (isTouchPrimaryInput) {
      const eventType = event.type as string;
      if (eventType === 'touchstart') {
        ignoreSyntheticMouseUntil = performance.now() + 500;
      }
      if (eventType === 'mousedown' && performance.now() < ignoreSyntheticMouseUntil) return;
      if ((eventType === 'touchstart' || eventType === 'mousedown') && event.x != null && event.y != null) {
        touchPointControllers.get(chart)?.select(event.x, event.y);
      }
      return;
    }
    if (event.type === 'mousemove' && args.inChartArea) {
      const xPixel = event.x;
      const value = xPixel == null ? null : chart.scales.x.getValueForPixel(xPixel);
      const index = value == null ? null : nearestTimelineIndex(value, chart.data.labels?.length ?? 0);
      applySharedHoverState(nextHoverState(sharedHoverState, 'move', index));
    } else if (event.type === 'click' && args.inChartArea) {
      applySharedHoverState(nextHoverState(sharedHoverState, 'click', sharedHoverState.index));
    } else if (event.type === 'mouseout') {
      applySharedHoverState(nextHoverState(sharedHoverState, 'leave', null));
    }
  },
  afterDraw(chart) {
    if (sharedHoverState.index === null) return;
    const { chartArea, ctx, scales } = chart;
    const x = scales.x;
    if (!chartArea || !x) return;
    positionFreezeButton(chart);
    const pixel = x.getPixelForValue(sharedHoverState.index);
    ctx.save();
    ctx.strokeStyle = 'rgba(9, 47, 67, 0.45)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pixel, chartArea.top);
    ctx.lineTo(pixel, chartArea.bottom);
    ctx.stroke();
    ctx.restore();
  },
};

function applySharedHoverState(next: HoverState) {
  if (next.index === sharedHoverState.index && next.locked === sharedHoverState.locked) return;
  sharedHoverState = next;
  charts.forEach((item) => item.draw());
  updateFreezeButton();
}

function updateFreezeButton() {
  app.querySelectorAll<HTMLButtonElement>('[data-action="unfreeze"]').forEach((button) => {
    button.classList.toggle('visible', sharedHoverState.locked);
    button.setAttribute('aria-hidden', String(!sharedHoverState.locked));
  });
}

function positionFreezeButton(chart: Chart) {
  const button = chart.canvas.parentElement?.querySelector<HTMLButtonElement>('[data-action="unfreeze"]');
  const x = chart.scales.x;
  const wrap = chart.canvas.parentElement;
  if (!button || !x || !wrap || sharedHoverState.index === null) return;
  const canvasRect = chart.canvas.getBoundingClientRect();
  const wrapRect = wrap.getBoundingClientRect();
  button.style.left = `${x.getPixelForValue(sharedHoverState.index) + canvasRect.left - wrapRect.left}px`;
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
  sharedHoverState = { index: null, locked: false };
  const swimmer = getSelected();
  selectedId = swimmer.id;
  const points = allPoints(swimmer);
  const firstDate = points[0]?.date;
  const latestDate = points.at(-1)?.date;
  const sharedLabels = timelineLabels(points);
  const bestComparable = points.length ? Math.min(...points.map((point) => point.comparableSeconds)) : null;
  const bestSpeed = points.length ? Math.max(...points.map((point) => speedInMilesPerHour(point.distance, point.seconds))) : null;
  const seasonCount = new Set(points.map((point) => point.date.slice(0, 4))).size;
  const bestValue = viewMode === 'speed'
    ? (bestSpeed === null ? '—' : bestSpeed.toFixed(2))
    : (bestComparable === null ? '—' : formatTime(bestComparable));

  app.innerHTML = `
    <div class="site-shell">
      <header class="topbar shell">
        <a class="wordmark" href="${assetPath(import.meta.env.BASE_URL, '/') }" aria-label="Swim Story home"><span class="wordmark-mark">≈</span><span>swim story</span></a>
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
            <p class="story-subtitle">${viewMode === 'speed' ? 'Speed is measured in miles per hour, so 25- and 50-yard swims share one natural scale.' : 'Times view shows the actual 25-yard and 50-yard times, plus the 50-yard time divided by two for a fair comparison.'}</p>
          </div>
          <div class="story-tools">
            <div class="view-toggle" role="group" aria-label="Chart view">
              <button class="view-button ${viewMode === 'raw' ? 'selected' : ''}" data-mode="raw" aria-pressed="${viewMode === 'raw'}">${chartModeLabel('raw')}</button>
              <button class="view-button ${viewMode === 'speed' ? 'selected' : ''}" data-mode="speed" aria-pressed="${viewMode === 'speed'}">${chartModeLabel('speed')}</button>
            </div>
            <div class="stats" aria-label="Swim story summary">
            <div class="stat"><strong>${seasonCount || '—'}</strong><span>summer${seasonCount === 1 ? '' : 's'}</span></div>
            <div class="stat"><strong>${bestValue}</strong><span>${viewMode === 'speed' ? 'best mph' : 'best comparable'}</span></div>
            <div class="stat"><strong>${latestDate ? formatDate(latestDate).split(',')[0] : '—'}</strong><span>most recent swim</span></div>
            </div>
          </div>
        </section>

        <section class="charts-grid" aria-label="${swimmer.name}'s event charts">
          ${EVENT_KEYS.map((event) => chartCard(event, swimmer.events[event] ?? [], viewMode)).join('')}
        </section>
        <p class="source-note">${firstDate ? `Showing ${formatDate(firstDate)} through ${latestDate ? formatDate(latestDate) : ''}.` : 'No results have been recorded yet.'} Data refreshed ${formatDate(data.fetchedAt.slice(0, 10))} from <a href="${swimmer.sourceUrl}" target="_blank" rel="noreferrer">Acorn Swim Database</a>.</p>
      </main>
      <footer class="footer shell"><span>Keep showing up. The numbers will follow.</span><span>♥ &nbsp; Made for the Martin swimmers</span></footer>
    </div>`;

  app.querySelectorAll<HTMLButtonElement>('[data-kid]').forEach((button) => {
    button.addEventListener('click', () => { selectedId = button.dataset.kid!; render(); });
  });
  app.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((button) => {
    button.addEventListener('click', () => { viewMode = button.dataset.mode as ChartMode; render(); });
  });
  app.querySelectorAll<HTMLButtonElement>('[data-action="unfreeze"]').forEach((button) => {
    button.addEventListener('click', () => {
      applySharedHoverState(nextHoverState(sharedHoverState, 'unfreeze', null));
    });
  });
  EVENT_KEYS.forEach((event) => {
    const swims = swimmer.events[event] ?? [];
    if (swims.length) charts.push(createChart(event, swims, viewMode, sharedLabels));
  });
}

function chartCard(event: EventKey, swims: NonNullable<Swimmer['events'][EventKey]>, mode: ChartMode) {
  const hasData = swims.length > 0;
  const series = chartSeries(swims, mode);
  const metrics = eventMetrics(swims);
  const metricItems = eventMetricItems(metrics, mode);
  const metricMarkup = metricItems
    .filter(([, value]) => value !== null)
    .map(([label, value]) => `<div class="event-metric"><strong>${mode === 'speed' ? value!.toFixed(2) : formatTime(value!)}</strong><span>${label}</span></div>`)
    .join('');
  const standards = [...new Set(swims.flatMap((swim) => swim.standard ? [swim.standard.level] : []))] as StandardLevel[];
  const standardLegend = standards.length
    ? `<div class="standard-legend">${standards.map((level) => `<span><i class="standard-star ${level}">★</i>${level} standard</span>`).join('')}</div>`
    : '';
  const unfreezeMarkup = isTouchPrimaryInput ? '' : '<button class="unfreeze-button" data-action="unfreeze" aria-label="Unfreeze date guide" aria-hidden="true">×</button>';
  const touchPointMarkup = isTouchPrimaryInput ? `<div class="touch-point-panel" data-touch-panel hidden role="region" aria-label="Selected ${eventLabel(event)} result" aria-live="polite">
    <button class="touch-point-close" data-action="close-point" aria-label="Close selected result">×</button>
    <p class="touch-point-date" data-touch-date></p>
    <strong class="touch-point-value" data-touch-value></strong>
    <span class="touch-point-detail" data-touch-detail></span>
    <div class="touch-point-nav">
      <button class="touch-point-nav-button" data-action="previous-point" aria-label="Show earlier result">← Earlier</button>
      <span class="touch-point-position" data-touch-position></span>
      <button class="touch-point-nav-button" data-action="next-point" aria-label="Show later result">Later →</button>
    </div>
  </div>` : '';
  return `<article class="chart-card ${hasData ? '' : 'empty-card'}">
    <div class="card-heading"><div><p class="card-kicker">${hasData ? `${swims.length} swims tracked` : 'Not in the record yet'}</p><h3>${eventLabel(event)}</h3></div><span class="event-badge">${eventShortLabel(event)}</span></div>
    ${hasData ? `<div class="event-metrics">${metricMarkup}</div>` : ''}
    ${hasData ? `<div class="legend">${series.map((item) => `<span><i class="legend-line ${item.color} ${item.dashed ? 'dashed' : ''}"></i>${item.label}</span>`).join('')}</div>${standardLegend}<div class="chart-wrap"><canvas data-chart="${event}" aria-label="${eventLabel(event)} ${mode} chart over time"></canvas>${unfreezeMarkup}</div>${touchPointMarkup}` : `<div class="empty-content"><span class="empty-icon">✦</span><p>There aren’t any ${eventLabel(event).toLowerCase()} results in the current record. If this event makes an appearance, it will join the story here.</p></div>`}
  </article>`;
}

type TouchPointController = {
  select: (x: number, y: number) => void;
};

const touchPointControllers = new WeakMap<Chart, TouchPointController>();

function createChart(event: EventKey, swims: NonNullable<Swimmer['events'][EventKey]>, mode: ChartMode, sharedLabels: string[]): Chart {
  const points = normalizePoints(swims);
  const axis = chartAxis(mode);
  const series = alignSeriesToTimeline(chartSeries(swims, mode), points.map((point) => point.date), sharedLabels);
  const canvas = document.querySelector<HTMLCanvasElement>(`[data-chart="${event}"]`)!;
  const timelinePoints = sharedLabels.map((date) => points.find((point) => point.date === date));
  const labels = sharedLabels;
  const datasets = series.map((item) => ({
    label: item.label,
    data: item.values,
    borderColor: item.color === 'coral' ? '#ef765d' : '#276c83',
    backgroundColor: item.color === 'coral' ? '#ef765d' : '#276c83',
    pointStyle: timelinePoints.map((point) => point && pointBelongsToSeries(item.id, point) && point.standard ? 'star' : 'circle'),
    pointBackgroundColor: timelinePoints.map((point) => point && pointBelongsToSeries(item.id, point) && point.standard ? standardColor(point.standard.level) : item.color === 'coral' ? '#ef765d' : '#276c83'),
    pointBorderColor: timelinePoints.map((point) => point && pointBelongsToSeries(item.id, point) && point.standard ? standardColor(point.standard.level) : item.color === 'coral' ? '#ef765d' : '#276c83'),
    pointRadius: timelinePoints.map((point) => point && pointBelongsToSeries(item.id, point) && point.standard ? 6 : 3.5),
    pointHoverRadius: timelinePoints.map((point) => point && pointBelongsToSeries(item.id, point) && point.standard ? 8 : 6),
    borderWidth: 2.5,
    borderDash: item.dashed ? [7, 6] : [],
    tension: 0.22,
    ...chartLineOptions(),
  }));
  const chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      events: isTouchPrimaryInput ? ['touchstart', 'mousedown'] : ['mousemove', 'mouseout', 'click'],
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { display: false },
        // Chart.js invokes this before drawing the grid and data, keeping the summer bands behind both.
        tooltip: {
          enabled: !isTouchPrimaryInput,
          padding: 12,
          backgroundColor: '#092f43',
          titleColor: '#f5f2eb',
          bodyColor: '#f5f2eb',
          callbacks: {
            title: (items) => formatDate(String(items[0].label)),
            label: (item) => `${item.dataset.label}: ${mode === 'speed' ? `${Number(item.raw).toFixed(2)} mph` : `${formatTime(Number(item.raw))} sec`}`,
            afterLabel: (item) => timelinePoints[item.dataIndex] ? tooltipDetails(timelinePoints[item.dataIndex]!) : '',
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
          reverse: axis.reverse,
          beginAtZero: axis.beginAtZero,
          grid: { color: 'rgba(9, 47, 67, 0.08)' },
          ticks: { color: '#68818b', callback: (value) => mode === 'speed' ? Number(value).toFixed(2) : `${Number(value).toFixed(0)}s` },
          title: { display: true, text: mode === 'speed' ? 'miles per hour  ·  faster ↑' : 'seconds  ·  faster ↑', color: '#68818b', font: { size: 11, weight: 'bold' } },
          border: { display: false },
        },
      },
    },
    plugins: [summerBackgroundPlugin, sharedHoverPlugin],
  });

  if (isTouchPrimaryInput) setupTouchPointPanel(chart, points, labels, series, mode);
  return chart;
}

function setupTouchPointPanel(
  chart: Chart,
  points: SwimPoint[],
  labels: string[],
  series: ReturnType<typeof chartSeries>,
  mode: ChartMode,
) {
  const panel = chart.canvas.closest<HTMLElement>('.chart-card')?.querySelector<HTMLElement>('[data-touch-panel]');
  if (!panel) return;

  let selectedIndex: number | null = null;

  const updatePanel = (datasetIndex: number | null = null, dataIndex: number | null = null) => {
    if (selectedIndex === null) {
      panel.hidden = true;
      chart.setActiveElements([]);
      chart.canvas.dataset.touchSelection = 'closed';
      chart.update('none');
      return;
    }

    const point = points[selectedIndex];
    if (!point) return;
    const date = panel.querySelector<HTMLElement>('[data-touch-date]');
    const value = panel.querySelector<HTMLElement>('[data-touch-value]');
    const detail = panel.querySelector<HTMLElement>('[data-touch-detail]');
    const position = panel.querySelector<HTMLElement>('[data-touch-position]');
    const previous = panel.querySelector<HTMLButtonElement>('[data-action="previous-point"]');
    const next = panel.querySelector<HTMLButtonElement>('[data-action="next-point"]');
    if (!date || !value || !detail || !position || !previous || !next) return;

    date.textContent = formatDate(point.date);
    value.textContent = mode === 'speed'
      ? `${point.distance} yd · ${speedInMilesPerHour(point.distance, point.seconds).toFixed(2)} mph`
      : `${point.distance} yd · ${formatTime(point.seconds)}`;
    detail.textContent = `${tooltipDetails(point)}${point.meet ? ` · ${point.meet}` : ''}`;
    position.textContent = `${selectedIndex + 1} / ${points.length}`;
    previous.disabled = selectedIndex === 0;
    next.disabled = selectedIndex === points.length - 1;
    panel.hidden = false;
    chart.canvas.dataset.touchSelection = 'selected';

    if (datasetIndex !== null && dataIndex !== null) {
      chart.setActiveElements([{ datasetIndex, index: dataIndex }]);
    } else {
      const selectedDateIndex = labels.indexOf(point.date);
      const selectedSeriesIndex = series.findIndex((item) => pointBelongsToSeries(item.id, point));
      chart.setActiveElements(selectedDateIndex === -1 || selectedSeriesIndex === -1
        ? []
        : [{ datasetIndex: selectedSeriesIndex, index: selectedDateIndex }]);
    }
    chart.update('none');
  };

  const selectPoint = (index: number, datasetIndex: number | null = null, dataIndex: number | null = null) => {
    selectedIndex = Math.max(0, Math.min(points.length - 1, index));
    updatePanel(datasetIndex, dataIndex);
  };

  touchPointControllers.set(chart, {
    select: (x, y) => {
      let nearest: { pointIndex: number; datasetIndex: number; dataIndex: number; distance: number } | null = null;
      chart.data.datasets.forEach((_dataset, datasetIndex) => {
        const meta = chart.getDatasetMeta(datasetIndex);
        const seriesItem = series[datasetIndex];
        if (!seriesItem) return;
        meta.data.forEach((element, dataIndex) => {
          const props = element.getProps(['x', 'y'], true) as { x?: number; y?: number };
          if (props.x == null || props.y == null || (element as unknown as { skip?: boolean }).skip) return;
          const point = points.find((candidate) => candidate.date === labels[dataIndex] && pointBelongsToSeries(seriesItem.id, candidate));
          if (!point) return;
          const distance = (props.x - x) ** 2 + (props.y - y) ** 2;
          if (!nearest || distance < nearest.distance) {
            nearest = { pointIndex: points.indexOf(point), datasetIndex, dataIndex, distance };
          }
        });
      });

      const nearestSelection = nearest as { pointIndex: number; datasetIndex: number; dataIndex: number; distance: number } | null;
      if (nearestSelection) {
        selectPoint(nearestSelection.pointIndex, nearestSelection.datasetIndex, nearestSelection.dataIndex);
        return;
      }

      const value = chart.scales.x.getValueForPixel(x);
      const dateIndex = value == null ? null : nearestTimelineIndex(value, labels.length);
      const pointIndex = dateIndex === null ? null : points.findIndex((point) => point.date === labels[dateIndex]);
      if (pointIndex !== null && pointIndex >= 0) selectPoint(pointIndex);
    },
  });

  panel.querySelector<HTMLButtonElement>('[data-action="close-point"]')?.addEventListener('click', () => {
    selectedIndex = null;
    updatePanel();
  });
  panel.querySelector<HTMLButtonElement>('[data-action="previous-point"]')?.addEventListener('click', () => {
    if (selectedIndex !== null && selectedIndex > 0) selectPoint(selectedIndex - 1);
  });
  panel.querySelector<HTMLButtonElement>('[data-action="next-point"]')?.addEventListener('click', () => {
    if (selectedIndex !== null && selectedIndex < points.length - 1) selectPoint(selectedIndex + 1);
  });
}

function pointBelongsToSeries(seriesId: string, point: SwimPoint | undefined): boolean {
  if (!point) return false;
  if (seriesId === 'speed') return true;
  if (seriesId === '50' || seriesId === '50-per-25') return point.distance === 50;
  return point.distance === Number(seriesId);
}

async function loadData() {
  renderLoading();
  try {
    const response = await fetch(assetPath(import.meta.env.BASE_URL, 'data/swim-times.json'));
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
