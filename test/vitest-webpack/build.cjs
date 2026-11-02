// Spike: build Karma's test bundles with Karma's own webpack/Babel configuration, but emit them as
// ES modules - one self-contained bundle per spec file - so Vitest Browser Mode can run them as test
// files. Nothing is re-transformed by Vite except trivial import analysis; module exports stay the
// plain CommonJS objects that `sinon.stub(namespace, 'fn')` relies on.
//
// Environment (mirrors karmaRunner.js):
//   VITEST_FILES   comma separated spec paths (like `gulp test-only --file`); no pipeline_setup, like Karma
//   TEST_CHUNKS    number of chunks the full suite is split into (default 8, as in gulpfile.js)
//   TEST_CHUNK     which chunk to build (1-based); omit to build every spec
//   TEST_PAT       spec file pattern (default *_spec.js)
//   VITEST_SOURCEMAPS=1  emit inline source maps (slower, larger)
//   VITEST_COVERAGE=1    instrument with babel-plugin-istanbul, as karma does with coverage on
//
// Run `npx gulp precompile` first, exactly as for `test-only-nobuild`.
const path = require('path');
const fs = require('fs');
const glob = require('glob');
const webpack = require('webpack');
const karmaConfMaker = require('../../karma.conf.maker.js');
const helpers = require('../../gulpHelpers.js');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.resolve(ROOT, 'build/vitest-bundles');

function selectSpecs() {
  if (process.env.VITEST_FILES) {
    return {specs: process.env.VITEST_FILES.split(',').map(f => f.trim()).filter(Boolean), pipeline: false};
  }
  // same chunking as karmaRunner.js
  const chunkNum = process.env.TEST_CHUNKS ?? 8;
  const pat = process.env.TEST_PAT ?? '*_spec.js';
  const tests = glob.sync('test/spec/**/' + pat, {cwd: ROOT}).map(f => f.replace(/\\/g, '/')).sort();
  const chunkLen = chunkNum === 'MAX' ? 0 : Math.floor(tests.length / Number(chunkNum));
  let chunks = [[]];
  tests.forEach((fn) => {
    chunks[chunks.length - 1].push(fn);
    if (chunks[chunks.length - 1].length > chunkLen) chunks.push([]);
  });
  chunks = chunks.filter(c => c.length > 0);
  const n = process.env.TEST_CHUNK ? Number(process.env.TEST_CHUNK) : null;
  return {specs: n ? chunks[n - 1] : chunks.flat(), pipeline: true};
}

function makeConfig({specs, pipeline}) {
  const coverage = !!process.env.VITEST_COVERAGE;
  // Reuse karma's webpack config as-is (babel-loader + @babel/plugin-transform-modules-commonjs,
  // resolution against dist/src, aliases, plugins). Only the entry/output shape changes below.
  const config = karmaConfMaker(coverage, false, false, specs, undefined, 1, false).webpack;

  // Karma loads, as separate entries sharing one runtime: test_deps, [pipeline_setup], ...specs, hookSetup.
  // Here every spec gets its own entry with the same setup modules, in the same order.
  const pre = ['test/test_deps.js', ...(pipeline ? ['test/pipeline_setup.js'] : [])];
  const post = ['test/helpers/hookSetup.js'];
  config.entry = Object.fromEntries(specs.map(spec => {
    const name = spec.replace(/^test\/spec\//, '').replace(/\.js$/, '');
    return [name, [...pre, spec, ...post].map(f => helpers.getPrecompiledPath(f))];
  }));
  config.devtool = process.env.VITEST_SOURCEMAPS ? 'inline-source-map' : false;
  config.experiments = {...(config.experiments || {}), outputModule: true};
  config.output = {
    ...config.output,
    path: OUT,
    filename: '[name].js',
    chunkFilename: '_chunks/[id].js',
    module: true,
    chunkFormat: 'module',
    chunkLoading: 'import',
    globalObject: 'self',
    clean: true,
  };
  delete config.output.chunkLoadingGlobal;
  // self-contained bundles: each spec file is its own module graph, so nothing is shared between
  // the files of a chunk the way karma's single runtime shares it (see report)
  config.optimization = {splitChunks: false, runtimeChunk: false, minimize: false};
  config.cache = {
    type: 'filesystem',
    cacheDirectory: path.resolve(ROOT, '.cache/webpack-vitest'),
    version: JSON.stringify({coverage, pipeline}),
  };
  config.stats = 'errors-warnings';
  if (!process.env.VITEST_SOURCEMAPS) {
    // the precompiled modules carry `//# sourceMappingURL=x.js.map` comments that webpack leaves in
    // place when it isn't producing maps; Vite would then try (and fail) to read them
    config.plugins = [...(config.plugins || []), {
      apply(compiler) {
        compiler.hooks.thisCompilation.tap('StripSourceMapComments', (compilation) => {
          compilation.hooks.processAssets.tap({name: 'StripSourceMapComments', stage: webpack.Compilation.PROCESS_ASSETS_STAGE_DEV_TOOLING}, (assets) => {
            Object.keys(assets).filter(f => f.endsWith('.js')).forEach(file => {
              const src = assets[file].source().toString();
              compilation.updateAsset(file, new webpack.sources.RawSource(src.replace(/\/\/# sourceMappingURL=\S*$/gm, '')));
            });
          });
        });
      }
    }];
  }
  return config;
}

const selection = selectSpecs();
const started = Date.now();
webpack(makeConfig(selection), (err, stats) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  const info = stats.toJson({all: false, errors: true, warnings: true});
  if (stats.hasErrors()) {
    info.errors.forEach(e => console.error(e.message));
    process.exit(1);
  }
  fs.writeFileSync(path.join(OUT, 'specs.json'), JSON.stringify(selection.specs, null, 2));
  console.log(`built ${selection.specs.length} spec bundle(s) into ${path.relative(ROOT, OUT)} in ${((Date.now() - started) / 1000).toFixed(1)}s`);
});
