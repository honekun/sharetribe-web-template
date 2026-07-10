#!/usr/bin/env node
/**
 * Rebuilds the shareable single-file HTML edition of the operator guide from
 * docs/operator-guide.md, reusing the existing HTML file as the template
 * (styles, sidebar, hero and scripts are kept; the TOC nav, quick-access grid
 * and <section> blocks are regenerated).
 *
 *   node docs/shareable/build-shareable-guide.js                # English file
 *   node docs/shareable/build-shareable-guide.js <md> <html> [--kicker "Sección"]
 *
 * The Spanish edition has no markdown source; use --fragments to render
 * translated markdown into section HTML for manual splicing:
 *
 *   node docs/shareable/build-shareable-guide.js <md> --fragments [--kicker "Sección" --start 12]
 *
 * Markdown support is scoped to what the guide uses: ##/###/#### headings,
 * GFM tables (rendered here), and CommonMark for everything else (micromark).
 */
const fs = require('fs');
const path = require('path');
const micromark = require('micromark');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// GitHub-style anchor slug; keeps unicode letters (e.g. "género").
const slugify = text =>
  text
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]*)\*\*/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .toLowerCase()
    .replace(/[^\p{L}\p{N} _-]/gu, '')
    .replace(/ /g, '-');

const escapeHtml = text =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Inline markdown for table cells: code, bold, links.
const renderInline = text => {
  let out = escapeHtml(text);
  out = out.replace(/`([^`]+)`/g, (m, c) => `<code>${c}</code>`);
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return out;
};

// Split a GFM table row into cells, honouring escaped \| pipes.
const splitRow = line => {
  const cells = [];
  let cur = '';
  const inner = line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '');
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === '\\' && inner[i + 1] === '|') {
      cur += '|';
      i++;
    } else if (inner[i] === '|') {
      cells.push(cur.trim());
      cur = '';
    } else {
      cur += inner[i];
    }
  }
  cells.push(cur.trim());
  return cells;
};

const renderTable = lines => {
  const header = splitRow(lines[0]);
  const rows = lines.slice(2).map(splitRow);
  const th = header.map(c => `<th>${renderInline(c)}</th>`).join('');
  const trs = rows
    .map(r => `<tr>${r.map(c => `<td>${renderInline(c)}</td>`).join('')}</tr>`)
    .join('\n');
  return `<div class="table-wrap"><table>\n<thead><tr>${th}</tr></thead>\n<tbody>\n${trs}\n</tbody>\n</table></div>`;
};

const isTableLine = line => /^\s*\|/.test(line);
const isTableSep = line => /^\s*\|[\s:|-]+\|?\s*$/.test(line);

// Render a markdown chunk: tables ourselves, the rest through micromark.
const renderBlocks = md => {
  const lines = md.split('\n');
  const out = [];
  let buf = [];
  let inFence = false;
  const flush = () => {
    if (buf.length) {
      out.push(micromark(buf.join('\n')));
      buf = [];
    }
  };
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*```/.test(lines[i])) inFence = !inFence;
    if (
      !inFence &&
      isTableLine(lines[i]) &&
      isTableLine(lines[i + 1] || '') &&
      isTableSep(lines[i + 1])
    ) {
      flush();
      const tbl = [lines[i]];
      i++;
      while (i < lines.length && isTableLine(lines[i])) tbl.push(lines[i++]);
      i--;
      out.push(renderTable(tbl));
    } else {
      buf.push(lines[i]);
    }
  }
  flush();
  // Give sub-headings their GitHub anchors so in-page links keep working.
  return out.join('\n').replace(/<(h[34])>(.*?)<\/\1>/g, (m, tag, inner) => {
    const plain = inner.replace(/<[^>]+>/g, '');
    return `<${tag} id="${slugify(plain)}">${inner}</${tag}>`;
  });
};

const stripTags = html =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

// ---------------------------------------------------------------------------
// Markdown → section model
// ---------------------------------------------------------------------------

const parseGuide = md => {
  const lines = md.split('\n');
  const sections = [];
  let cur = null;
  let title = '';
  for (const line of lines) {
    const h1 = line.match(/^# (.+)$/);
    const h2 = line.match(/^## (.+)$/);
    if (h1 && !title) {
      title = h1[1].trim();
      cur = { title, body: [] };
      sections.push(cur);
      continue;
    }
    if (h2) {
      const t = h2[1].trim();
      if (t === 'Table of Contents') {
        cur = null; // skip the md TOC entirely
        continue;
      }
      cur = { title: t, body: [] };
      sections.push(cur);
      continue;
    }
    if (cur) cur.body.push(line);
  }
  return sections.map((s, i) => {
    const isOverview = i === 0;
    const displayTitle = s.title.replace(/`/g, '');
    const label = displayTitle.replace(/^\d+\.\s*/, '');
    const body = s.body
      .join('\n')
      .replace(/\n---\s*$/g, '\n')
      .trim();
    return {
      id: isOverview ? 'overview' : slugify(s.title),
      title: displayTitle,
      label: isOverview ? displayTitle : label,
      html: renderBlocks(body),
      excerptSource: body,
    };
  });
};

const renderSection = (s, index, kicker) => {
  const searchText = `${s.title} ${stripTags(s.html)}`.toLowerCase().replace(/"/g, '&quot;');
  const num = String(index + 1).padStart(2, '0');
  return [
    `      <section id="${s.id}" class="doc-section" data-search-text="${searchText}">`,
    `        <div class="section-kicker">${kicker} ${num}</div>`,
    `        <h2>${escapeHtml(s.title)}</h2>`,
    `${s.html}<hr />`,
    `      </section>`,
  ].join('\n');
};

const tocLink = (s, index) =>
  `<a class="toc-link" href="#${s.id}"><span>${String(index + 1).padStart(
    2,
    '0'
  )}</span>${escapeHtml(s.label)}</a>`;

const quickCard = (s, index) => {
  const firstPara = s.excerptSource.split(/\n\s*\n/)[0] || '';
  const excerpt = stripTags(renderBlocks(firstPara)).slice(0, 130);
  return [
    `<a class="quick-card" href="#${s.id}">`,
    `        <span>${String(index + 1).padStart(2, '0')}</span>`,
    `        <strong>${escapeHtml(s.label)}</strong>`,
    `        <small>${escapeHtml(excerpt)}</small>`,
    `      </a>`,
  ].join('\n');
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const getFlag = name => {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1];
};
const kicker = getFlag('--kicker') || 'Section';
const positional = args.filter(
  (a, i) => !a.startsWith('--') && args[i - 1] !== '--kicker' && args[i - 1] !== '--start'
);

const mdPath = positional[0] || path.join(__dirname, '..', 'operator-guide.md');
const sections = parseGuide(fs.readFileSync(mdPath, 'utf8'));

if (args.includes('--fragments')) {
  // Render each md section as a standalone HTML fragment for manual splicing.
  const start = parseInt(getFlag('--start') || '1', 10) - 1;
  sections.forEach((s, i) => {
    console.log(`\n<!-- fragment: ${s.id} -->`);
    console.log(renderSection(s, start + i, kicker));
    console.log(`<!-- toc: ${tocLink(s, start + i)} -->`);
    console.log(`<!-- card: ${quickCard(s, start + i)} -->`);
  });
  process.exit(0);
}

const htmlPath = positional[1] || path.join(__dirname, 'operator-guide.html');
let html = fs.readFileSync(htmlPath, 'utf8');

const toc = sections.map(tocLink).join('');
const cards = sections
  .slice(1)
  .map((s, i) => quickCard(s, i + 1))
  .join('');
const body = sections.map((s, i) => renderSection(s, i, kicker)).join('\n');

html = html.replace(
  /(<nav class="toc" aria-label="[^"]*">).*?(<\/nav>)/s,
  (m, a, b) => a + toc + b
);
html = html.replace(
  /(<div class="quick-grid" aria-label="[^"]*">).*?(<\/div>)/s,
  (m, a, b) => a + cards + b
);
html = html.replace(/<section id="overview"[\s\S]*<\/section>(?=\s*<\/main>)/, body.trimStart());

fs.writeFileSync(htmlPath, html);
console.log(
  `Wrote ${htmlPath}: ${sections.length} sections (${Math.round(html.length / 1024)} KB)`
);
