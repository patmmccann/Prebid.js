#!/usr/bin/env bash
# scenarios.sh <scenario> - one benchmark job (see .github/workflows/vitest-benchmark.yml).
# Every step is timed by measure.sh into $BENCH_OUT/results.jsonl; summarize.js turns that into tables.
set -u
here=$(cd "$(dirname "$0")" && pwd)
m() { "$here/measure.sh" "$@"; }
export BENCH_OUT=${BENCH_OUT:-$PWD/build/bench}
scenario=$1
vrun() { # vrun <label> [vitest args...]
  local label=$1; shift
  m "$label" npx vitest run --config test/vitest-webpack/vitest.config.mjs \
    --reporter=default --reporter=json --outputFile.json="$BENCH_OUT/$label.json" "$@"
}
build() { m "$1" node test/vitest-webpack/build.js; }
cold() { rm -rf .cache/webpack-vitest .cache/babel-loader .cache/webpack-test; }

case "$scenario" in
  karma)
    cold
    m karma-cold npx gulp test-only-nobuild --no-coverage
    m karma-warm npx gulp test-only-nobuild --no-coverage
    ;;
  karma-coverage)
    cold
    m karma-cov-cold npx gulp test-only-nobuild --coverage
    m karma-cov-warm npx gulp test-only-nobuild --coverage
    ;;
  vitest)
    # default: one page per Karma chunk, files run one at a time
    cold
    build build-cold
    vrun run-1
    rm -rf .cache/webpack-vitest
    build build-babelwarm
    build build-warm
    vrun run-2
    vrun run-3
    ;;
  par2|par3|par4|par8)
    cold
    build build-cold
    n=${scenario#par}
    VITEST_PARALLEL=1 vrun run-1 --maxWorkers="$n"
    VITEST_PARALLEL=1 vrun run-2 --maxWorkers="$n"
    ;;
  chrome)
    cold
    build build-cold
    VITEST_CHANNEL=chrome vrun run-1
    VITEST_CHANNEL=chrome vrun run-2
    ;;
  nosplit)
    cold
    VITEST_SPLIT=0 build build-cold
    vrun run-1
    vrun run-2
    ;;
  chunks4|chunks16)
    n=${scenario#chunks}
    cold
    TEST_CHUNKS=$n build build-cold
    vrun run-serial
    VITEST_PARALLEL=1 vrun run-par4 --maxWorkers=4
    ;;
  isolate)
    cold
    VITEST_ISOLATE_SPECS=1 build build-cold
    VITEST_PARALLEL=1 vrun run-par4 --maxWorkers=4
    vrun run-serial
    ;;
  nodeps)
    # browser installed without --with-deps: are the system libraries already on the runner?
    cold
    build build-cold
    vrun run-1
    ;;
  *)
    echo "unknown scenario $scenario"; exit 1;;
esac
