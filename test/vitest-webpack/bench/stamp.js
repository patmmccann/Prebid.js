// Prefixes each line of stdin with the seconds elapsed since BENCH_T0 (epoch ms), or since start.
const t0 = Number(process.env.BENCH_T0) || Date.now();
let buf = '';
const out = (line) => process.stdout.write(`[${((Date.now() - t0) / 1000).toFixed(1).padStart(7)}] ${line}\n`);
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => {
  buf += d;
  const lines = buf.split(/\r?\n/);
  buf = lines.pop();
  lines.forEach(out);
});
process.stdin.on('end', () => { if (buf) out(buf); });
