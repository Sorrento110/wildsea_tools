import { SHIP_RATING_KEYS, SHIP_RATING_LABELS } from './ship-generator';
import type { GeneratedSection, GeneratedShip, GeneratorOption, RatingMap } from './types';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function ratingDeltas(ratings: RatingMap): string {
  const entries = Object.entries(ratings);
  if (entries.length === 0) return '';
  const chips = entries
    .map(([key, delta]) => {
      const label = SHIP_RATING_LABELS[key] ?? key;
      const sign = delta > 0 ? '+' : '';
      return `<span class="delta-chip ${delta < 0 ? 'delta-negative' : 'delta-positive'}">${escapeHtml(
        label,
      )} ${sign}${delta}</span>`;
    })
    .join('');
  return `<div class="option-deltas">${chips}</div>`;
}

function optionCardId(sectionKey: string, optionId: string): string {
  return `option-${sectionKey}-${optionId}`;
}

function optionCard(sectionKey: string, option: GeneratorOption): string {
  const category = option.category
    ? `<span class="option-category">${escapeHtml(option.category)}</span>`
    : '';
  const special = option.special
    ? `<p class="option-special"><strong>Special:</strong> ${escapeHtml(option.special)}</p>`
    : '';
  const stakes = `${option.stakes} stake${option.stakes === 1 ? '' : 's'}`;

  return `
    <article class="option-card" id="${escapeHtml(optionCardId(sectionKey, option.id))}">
      <header class="option-card-header">
        <div class="option-card-title">
          <h4>${escapeHtml(option.name)}</h4>
          ${category}
        </div>
        <span class="option-stakes">${escapeHtml(stakes)}</span>
      </header>
      <p class="option-description">${escapeHtml(option.description)}</p>
      ${ratingDeltas(option.ratings ?? {})}
      ${special}
      <footer class="option-source">${escapeHtml(option.source)}</footer>
    </article>
  `;
}

export interface RenderOptions {
  /** Section keys whose reroll button should be disabled because a constraint pins them. */
  pinnedSections?: string[];
}

function sectionHtml(section: GeneratedSection, pinned: boolean): string {
  const description = section.description
    ? `<p class="section-description">${escapeHtml(section.description)}</p>`
    : '';
  const options = section.options.map((option) => optionCard(section.key, option)).join('');
  const button = pinned
    ? `<button type="button" class="section-reroll" disabled aria-label="${escapeHtml(section.title)} is pinned">Pinned</button>`
    : `<button type="button" class="section-reroll" data-action="reroll-section" data-section="${escapeHtml(
        section.key,
      )}" aria-label="Reroll ${escapeHtml(section.title)}">Reroll</button>`;

  return `
    <section class="ship-section">
      <header class="ship-section-header">
        <div>
          <h3>${escapeHtml(section.title)}</h3>
          ${description}
        </div>
        ${button}
      </header>
      <div class="option-list">${options}</div>
    </section>
  `;
}

function ratingsHtml(ratings: RatingMap): string {
  const chips = SHIP_RATING_KEYS.map((key) => {
    const label = SHIP_RATING_LABELS[key] ?? key;
    return `
      <div class="rating-chip">
        <span class="rating-key">${escapeHtml(label)}</span>
        <span class="rating-value">${ratings[key] ?? 0}</span>
      </div>
    `;
  }).join('');
  return `<div class="rating-strip">${chips}</div>`;
}

function warningsHtml(warnings: string[] | undefined): string {
  if (!warnings || warnings.length === 0) return '';
  const items = warnings.map((warning) => `<p>${escapeHtml(warning)}</p>`).join('');
  return `<div class="ship-warnings">${items}</div>`;
}

function noEngineNote(ship: GeneratedShip): string {
  return !ship.sections.some((s) => s.key === 'engines')
    ? `<p class="no-engine-note">No engine — this vessel is driven without one.</p>`
    : '';
}

function selectionParam(ship: GeneratedShip): string {
  const selection: Record<string, string[]> = {};
  for (const section of ship.sections) {
    selection[section.key] = section.options.map((option) => option.id);
  }
  return encodeURIComponent(JSON.stringify(selection));
}

function glanceHtml(ship: GeneratedShip, detailBaseUrl?: string): string {
  const encodedSelection = selectionParam(ship);
  const rows = ship.sections
    .map((section) => {
      const parts = section.options.map((option) => {
        const description = escapeHtml(option.description ?? '');
        const name = escapeHtml(option.name);
        if (detailBaseUrl) {
          const href = `${detailBaseUrl}?selection=${encodedSelection}&option=${optionCardId(
            section.key,
            option.id,
          )}`;
          return `<a class="glance-option" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" data-description="${description}">${name}</a>`;
        }
        return `<span class="glance-option" tabindex="0" data-description="${description}">${name}</span>`;
      });
      return `
        <div class="glance-row">
          <span class="glance-label">${escapeHtml(section.title)}</span>
          <span class="glance-values">${parts.join('<span class="glance-sep"> · </span>')}</span>
        </div>
      `;
    })
    .join('');
  return `<div class="ship-glance">${rows}</div>`;
}

export interface QuickRenderOptions {
  /** When provided, option names in the glance become links to this generator page. */
  detailBaseUrl?: string;
}

/**
 * Render a compact, at-a-glance summary (ratings + glance rows only),
 * suitable for quick-access panels where full detail cards are unnecessary.
 */
export function renderShipQuickHtml(ship: GeneratedShip, options: QuickRenderOptions = {}): string {
  const noEngine = noEngineNote(ship);

  return `
    ${ratingsHtml(ship.ratings)}
    <p class="stakes-line">Total stakes: <strong>${ship.totalStakes}</strong></p>
    ${glanceHtml(ship, options.detailBaseUrl)}
    ${noEngine}
  `;
}

/**
 * Render a generated ship to HTML. Used both by the server (initial paint)
 * and the client (rerolls), so the markup stays in one place.
 */
export function renderShipHtml(ship: GeneratedShip, options: RenderOptions = {}): string {
  const pinned = new Set(options.pinnedSections ?? []);
  const noEngine = noEngineNote(ship);

  return `
    <div class="ship-summary">
      ${warningsHtml(ship.warnings)}
      ${ratingsHtml(ship.ratings)}
      <p class="stakes-line">Total stakes: <strong>${ship.totalStakes}</strong></p>
      ${glanceHtml(ship)}
      ${noEngine}
    </div>
    <div class="ship-sections">${ship.sections.map((section) => sectionHtml(section, pinned.has(section.key))).join('')}</div>
  `;
}

function ratingLine(ratings: RatingMap): string {
  return SHIP_RATING_KEYS.map((key) => `${SHIP_RATING_LABELS[key] ?? key} ${ratings[key] ?? 0}`).join(' · ');
}

function optionText(option: GeneratorOption): string {
  const parts = [`${option.name} (${option.source})`];
  if (option.category) parts.push(`Category: ${option.category}`);
  if (option.stakes > 0) parts.push(`Stakes: ${option.stakes}`);
  if (option.ratings && Object.keys(option.ratings).length > 0) {
    parts.push(
      Object.entries(option.ratings)
        .map(([key, delta]) => `${SHIP_RATING_LABELS[key] ?? key} ${delta > 0 ? '+' : ''}${delta}`)
        .join(', '),
    );
  }
  if (option.special) parts.push(`Special: ${option.special}`);
  return parts.join(' — ');
}

/**
 * Plain-text version of a ship, suitable for copy/paste.
 */
export function formatShipText(ship: GeneratedShip): string {
  const header = [
    'Wildsea Ship',
    `Ratings: ${ratingLine(ship.ratings)}`,
    `Total stakes: ${ship.totalStakes}`,
  ];

  const sections = ship.sections.map((section) => {
    const lines = [`\n${section.title}`];
    for (const option of section.options) {
      lines.push(`- ${optionText(option)}`);
    }
    return lines.join('\n');
  });

  return [...header, ...sections].join('\n');
}
