import { escapeHtml } from './html';
import type { GeneratedPoi, PoiResources } from './types';

const RESOURCE_LABELS: Record<keyof PoiResources, string> = {
  salvage: 'Salvage',
  specimens: 'Specimens',
  whispers: 'Whispers',
  charts: 'Charts',
  cargo: 'Cargo',
};

const RESOURCE_ORDER: (keyof PoiResources)[] = ['salvage', 'specimens', 'whispers', 'charts', 'cargo'];

function renderResources(resources: PoiResources): string {
  const rows = RESOURCE_ORDER.filter((key) => (resources[key] ?? []).length > 0).map((key) => {
    const items = (resources[key] ?? []).map((item) => `<li>${escapeHtml(item)}</li>`).join('');
    return `
      <div class="poi-resource">
        <span class="poi-resource-label">${RESOURCE_LABELS[key]}</span>
        <ul class="poi-resource-list">${items}</ul>
      </div>`;
  });

  if (rows.length === 0) return '';
  return `<div class="poi-resources"><h4>Sample Resources</h4>${rows.join('')}</div>`;
}

/** Render a generated point of interest as HTML for the tool panel. */
export function renderPoiHtml(poi: GeneratedPoi): string {
  const senseLabel = poi.senseKind === 'secure' ? 'from a secure position' : 'from a perilous position';
  const promptLabel = poi.promptKind === 'hook' ? 'Hook' : 'Encounter';

  return `
    <article class="prompt-card poi-card">
      <header class="poi-header">
        <span class="poi-feature">${escapeHtml(poi.feature.name)}</span>
        <span class="poi-layer">${escapeHtml(poi.layer.name)}</span>
      </header>
      <p class="poi-feature-description">${escapeHtml(poi.feature.description)}</p>
      <div class="poi-block">
        <h4>${escapeHtml(poi.site.name)}</h4>
        <p>${escapeHtml(poi.site.description)}</p>
      </div>
      <div class="poi-block">
        <h4>Sense <span class="poi-tag">${escapeHtml(poi.sense.sense)} &middot; ${senseLabel}</span></h4>
        <p>${escapeHtml(poi.sense.text)}</p>
      </div>
      <div class="poi-block">
        <h4>${promptLabel}</h4>
        <p>${escapeHtml(poi.prompt)}</p>
      </div>
      ${renderResources(poi.resources)}
      ${poi.site.source ? `<p class="poi-source">${escapeHtml(poi.site.source)}</p>` : ''}
    </article>`;
}

/** Render a generated point of interest as plain text for copying. */
export function formatPoiText(poi: GeneratedPoi): string {
  const lines: string[] = [];
  const senseLabel = poi.senseKind === 'secure' ? 'from a secure position' : 'from a perilous position';
  const promptLabel = poi.promptKind === 'hook' ? 'Hook' : 'Encounter';

  lines.push(`${poi.feature.name} - ${poi.layer.name}`);
  lines.push(poi.feature.description);
  lines.push('');
  lines.push(`${poi.site.name}: ${poi.site.description}`);
  lines.push('');
  lines.push(`Sense (${poi.sense.sense}, ${senseLabel}): ${poi.sense.text}`);
  lines.push(`${promptLabel}: ${poi.prompt}`);

  const resources = RESOURCE_ORDER.filter((key) => (poi.resources[key] ?? []).length > 0);
  if (resources.length > 0) {
    lines.push('');
    lines.push('Sample Resources');
    for (const key of resources) {
      lines.push(`${RESOURCE_LABELS[key]}: ${(poi.resources[key] ?? []).join(', ')}`);
    }
  }

  return lines.join('\n');
}
