// Summarizes $BENCH_OUT/results.jsonl (+ per-label logs and Vitest JSON reports) as markdown, and writes
// summary.json next to it for cross-run aggregation.
const fs = require('fs');
const path = require('path');
const out = process.env.BENCH_OUT || 'build/bench';
const scenario = process.env.BENCH_SCENARIO || '';
const rows = fs.readFileSync(path.join(out, 'results.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
const stamp = (line) => Number(line.match(/^\[\s*([\d.]+)\]/)?.[1]);

function vitestInfo(row) {
  const file = path.join(out, `${row.label}.json`);
  if (!fs.existsSync(file)) return null;
  const r = JSON.parse(fs.readFileSync(file, 'utf8'));
  const files = r.testResults || [];
  const testMs = files.flatMap(f => f.assertionResults || []).reduce((n, a) => n + (a.duration || 0), 0);
  const firstStart = Math.min(...files.map(f => f.startTime).filter(Boolean));
  const fileSpans = files.map(f => [f.name.replace(/.*vitest-bundles\//, ''), ((f.endTime - f.startTime) / 1000).toFixed(1)]);
  const log = fs.readFileSync(path.join(out, `${row.label}.log`), 'utf8');
  const duration = log.match(/Duration\s+(.*)/)?.[1]?.trim();
  return {
    passed: r.numPassedTests, failed: r.numFailedTests, skipped: r.numPendingTests, todo: r.numTodoTests,
    total: r.numTotalTests, files: files.length, failedFiles: files.filter(f => f.status === 'failed').map(f => f.name.replace(/.*vitest-bundles\//, '')),
    testSec: +(testMs / 1000).toFixed(1),
    toFirstFileSec: Number.isFinite(firstStart) ? +((firstStart - row.t0) / 1000).toFixed(1) : null,
    fileSpans, duration,
  };
}

function karmaInfo(row) {
  const file = path.join(out, `${row.label}.log`);
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  if (!lines.some(l => /Starting chunk/.test(l))) return null;
  const chunks = [];
  let cur;
  for (const l of lines) {
    const t = stamp(l);
    let mm;
    if ((mm = l.match(/Starting chunk (\d+)/))) { cur = { chunk: +mm[1], start: t, passed: 0, failed: 0, skipped: 0 }; chunks.push(cur); }
    if (!cur) continue;
    if (/Starting browser/.test(l) && cur.browser == null) cur.browser = t;
    if (/Connected on socket/.test(l) && cur.connected == null) cur.connected = t;
    if ((mm = l.match(/Finished in (.*?) @/))) cur.finished = mm[1];
    if ((mm = l.match(/(\d+) tests? completed/))) cur.passed = +mm[1];
    if ((mm = l.match(/(\d+) tests? failed/))) cur.failed = +mm[1];
    if ((mm = l.match(/(\d+) tests? skipped/))) cur.skipped = +mm[1];
    if (/Chunk \d+ of \d+: done/.test(l)) cur.end = t;
  }
  const sum = (k) => chunks.reduce((n, c) => n + c[k], 0);
  const span = (a, b) => chunks.reduce((n, c) => n + ((c[b] ?? 0) - (c[a] ?? 0)), 0);
  return {
    passed: sum('passed'), failed: sum('failed'), skipped: sum('skipped'), chunks: chunks.length,
    // chunk start -> browser launch is mostly karma-webpack's compile; launch -> connect is browser startup
    compileSec: +span('start', 'browser').toFixed(1), browserStartSec: +span('browser', 'connected').toFixed(1),
    testsSec: +span('connected', 'end').toFixed(1), perChunk: chunks,
  };
}

const enriched = rows.map(row => ({ scenario, ...row, vitest: vitestInfo(row), karma: karmaInfo(row) }));
fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(enriched, null, 2));
let md = `### ${scenario}\n\n| step | wall s | exit | CPU busy % | mem MB (base→peak) | passed | failed | skipped | breakdown |\n|---|---|---|---|---|---|---|---|---|\n`;
for (const r of enriched) {
  const info = r.vitest || r.karma || {};
  let br = '';
  if (r.vitest) br = `first file at ${r.vitest.toFirstFileSec}s; Σtest ${r.vitest.testSec}s; ${r.vitest.files} files; ${r.vitest.duration || ''}`;
  if (r.karma) br = `${r.karma.chunks} chunks; compile ${r.karma.compileSec}s; browser start ${r.karma.browserStartSec}s; tests ${r.karma.testsSec}s`;
  md += `| ${r.label} | ${r.wall} | ${r.status} | ${r.cpuBusyPct} | ${r.memBaseMB}→${r.memPeakMB} | ${info.passed ?? ''} | ${info.failed ?? ''} | ${info.skipped ?? ''} | ${br} |\n`;
}
for (const r of enriched) {
  if (r.vitest?.failedFiles?.length) md += `\n${r.label} failed files: ${r.vitest.failedFiles.join(', ')}\n`;
  if (r.vitest && r.vitest.files <= 40) md += `\n<details><summary>${r.label} per-file seconds</summary>\n\n${r.vitest.fileSpans.map(([f, s]) => `- ${f}: ${s}`).join('\n')}\n</details>\n`;
}
process.stdout.write(md);
