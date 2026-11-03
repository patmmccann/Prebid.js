#!/usr/bin/env bash
# measure.sh <label> <command...>
# Runs the command, timestamping its output into $BENCH_OUT/<label>.log, and appends one JSON line to
# $BENCH_OUT/results.jsonl: wall clock, exit status, whole-machine CPU busy % and peak used memory.
set -u
label=$1; shift
out=${BENCH_OUT:-build/bench}
mkdir -p "$out"
here=$(dirname "$0")
cpu() { awk '/^cpu /{busy=$2+$3+$4+$7+$8; total=busy+$5+$6; print busy, total}' /proc/stat; }
read -r b0 t0c < <(cpu)
peakfile=$(mktemp)
echo 0 > "$peakfile"
( peak=0; while :; do
    used=$(free -m | awk '/^Mem:/{print $3}')
    [ "$used" -gt "$peak" ] && peak=$used && echo "$peak" > "$peakfile"
    sleep 0.5
  done ) &
sampler=$!
base=$(free -m | awk '/^Mem:/{print $3}')
export BENCH_T0=$(date +%s%3N)
"$@" 2>&1 | node "$here/stamp.js" > "$out/$label.log"
status=${PIPESTATUS[0]}
t1=$(date +%s%3N)
kill $sampler 2>/dev/null; wait $sampler 2>/dev/null
read -r b1 t1c < <(cpu)
peak=$(cat "$peakfile"); rm -f "$peakfile"
wall=$(awk -v a="$BENCH_T0" -v b="$t1" 'BEGIN{printf "%.1f", (b-a)/1000}')
busy=$(awk -v a="$b0" -v b="$b1" -v c="$t0c" -v d="$t1c" 'BEGIN{ if (d>c) printf "%.0f", 100*(b-a)/(d-c); else print 0 }')
echo "{\"label\":\"$label\",\"wall\":$wall,\"status\":$status,\"cpuBusyPct\":$busy,\"memBaseMB\":$base,\"memPeakMB\":$peak,\"t0\":$BENCH_T0,\"t1\":$t1}" >> "$out/results.jsonl"
echo "$label: ${wall}s status=$status cpu=${busy}% mem ${base}->${peak}MB"
tail -n 15 "$out/$label.log"
exit 0
