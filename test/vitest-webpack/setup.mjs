// Runs in the browser before each bundled spec file. Supplies what karma-mocha, karma-chai and
// karma-sinon supply under Karma: Mocha's BDD globals (on top of Vitest's runner), chai globals,
// and a `window.__karma__` stub for test/test_deps.js. No spec is changed.
import * as vitest from 'vitest';
import * as chai from 'chai';
import sinon from 'sinon';

const DEFAULT_TIMEOUT = 3000; // karma.conf.maker.js: client.mocha.timeout
const NO_TIMEOUT = 2 ** 31 - 1;

// karma-chai / karma-sinon globals (test_deps.js replaces `sinon` with the bundled copy)
globalThis.chai = chai;
globalThis.expect = chai.expect;
globalThis.assert = chai.assert;
globalThis.should = chai.should();
globalThis.sinon = sinon;

// test_deps.js wraps `window.__karma__.loaded`
globalThis.__karma__ = {loaded() {}};

// Make the test page look like karma's context.html. Vitest's iframe is `<html lang="en">`, which
// FPD enrichment picks up as `site.content.language` (and so adds a `site` next to app/dooh).
document.documentElement.removeAttribute('lang');

// ---- Mocha BDD interface on top of Vitest -------------------------------------------------------

// A Mocha `Context`: tests and hooks of a suite share it (prototypally inherited from the parent suite),
// so `this.foo = ...` in a hook is visible in the tests.
const rootSuite = {title: '', parent: null, timeout: DEFAULT_TIMEOUT, retries: 0, ctx: {}};
rootSuite.ctx = makeCtx(null);
let currentSuite = rootSuite;

function makeCtx(parent) {
  const ctx = parent ? Object.create(parent) : {};
  Object.defineProperties(ctx, {
    timeout: {
      value(ms) {
        if (ms === undefined) return this.runnable?.timeout ?? currentSuite.timeout;
        if (this.runnable) this.runnable.setTimeout(ms);
        return this;
      },
      writable: true
    },
    slow: {value() { return this; }, writable: true},
    retries: {value() { return this; }, writable: true},
    skip: {
      value() {
        if (this.vctx?.skip) return this.vctx.skip();
        throw new Error('this.skip() is not supported here');
      },
      writable: true
    },
  });
  return ctx;
}

// what a Mocha Suite's `this` looks like inside a describe() body
function suiteThis(suite) {
  return {
    title: suite.title,
    timeout(ms) { if (ms === undefined) return suite.timeout; suite.timeout = ms; return this; },
    retries(n) { if (n === undefined) return suite.retries; suite.retries = n; return this; },
    slow() { return this; },
    ctx: suite.ctx,
  };
}

function testInfo(task, ctx) {
  const parentOf = (t) => {
    const s = t?.suite;
    if (!s || s.type !== 'suite' || s.filepath) return {title: '', parent: null, root: true, fullTitle: () => ''};
    return {title: s.name, parent: parentOf(s), fullTitle() { const p = this.parent.fullTitle(); return p ? `${p} ${this.title}` : this.title; }};
  };
  const parent = parentOf(task);
  return {
    title: task.name,
    parent,
    ctx,
    get state() {
      const s = task.result?.state;
      return s === 'pass' ? 'passed' : s === 'fail' ? 'failed' : s === 'skip' ? 'pending' : undefined;
    },
    get err() { return task.result?.errors?.[0]; },
    fullTitle() { const p = parent.fullTitle(); return p ? `${p} ${task.name}` : task.name; },
    titlePath() { const out = []; let p = parent; while (p && !p.root) { out.unshift(p.title); p = p.parent; } return [...out, task.name]; },
  };
}

// Run a Mocha runnable (test or hook) with Mocha semantics: `this` is the suite context, `done`
// callbacks, returned promises, a resettable timeout (`this.timeout(n)`), "overspecified" detection.
function run(fn, {suite, timeout, title, vctx, test, kind}) {
  const ctx = suite.ctx;
  return new Promise((resolve, reject) => {
    let timer;
    let finished = false;
    const runnable = {
      timeout,
      setTimeout(ms) {
        this.timeout = ms;
        arm();
      }
    };
    function arm() {
      clearTimeout(timer);
      const ms = runnable.timeout;
      if (ms > 0 && ms < NO_TIMEOUT) {
        timer = setTimeout(() => finish(new Error(
          `Timeout of ${ms}ms exceeded. For async tests and hooks, ensure "done()" is called; if returning a Promise, ensure it resolves. (${title})`
        )), ms);
      }
    }
    function finish(err) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      ctx.runnable = prev.runnable;
      if (err != null && err !== false) {
        if (err === vctxSkip) return reject(err);
        reject(err instanceof Error || (err && err.constructor?.name?.endsWith('Error')) ? err : new Error(`done() invoked with non-Error: ${JSON.stringify(err)}`));
      } else {
        resolve();
      }
    }
    const prev = {runnable: ctx.runnable};
    ctx.runnable = runnable;
    ctx.vctx = vctx;
    ctx.test = test ?? (vctx?.task ? testInfo(vctx.task, ctx) : {title, ctx});
    if (kind === 'test') ctx.currentTest = ctx.test;
    arm();
    try {
      if (fn.length > 0) {
        const r = fn.call(ctx, (err) => finish(err));
        if (r && typeof r.then === 'function') {
          finish(new Error('Resolution method is overspecified. Specify a callback *or* return a Promise; not both.'));
        }
      } else {
        const r = fn.call(ctx);
        if (r && typeof r.then === 'function') {
          r.then(() => finish(), (e) => finish(e ?? new Error('Promise rejected with no or falsy reason')));
        } else {
          finish();
        }
      }
    } catch (e) {
      finish(e);
    }
  });
}
const vctxSkip = Symbol('skip');

function wrapDescribe(vDescribe) {
  return function describe(title, fn) {
    if (typeof fn !== 'function') return vDescribe(title);
    const parent = currentSuite;
    const suite = {title, parent, timeout: parent.timeout, retries: parent.retries, ctx: makeCtx(parent.ctx)};
    return vDescribe(String(title), function () {
      currentSuite = suite;
      try {
        return fn.call(suiteThis(suite));
      } finally {
        currentSuite = parent;
      }
    });
  };
}

function wrapIt(vIt) {
  return function it(title, fn) {
    if (typeof fn !== 'function') return vitest.it.skip(String(title), () => {});
    const suite = currentSuite;
    const timeout = suite.timeout;
    const opts = {timeout: NO_TIMEOUT, ...(suite.retries ? {retry: suite.retries} : {})};
    return vIt(String(title), opts, (vctx) => run(fn, {suite, timeout, title, vctx, kind: "test"}));
  };
}

function hookArgs(args) {
  // Mocha allows before('description', fn)
  return typeof args[0] === 'function' ? args[0] : args[1];
}

function wrapEachHook(vHook, setsCurrentTest) {
  return function (...args) {
    const fn = hookArgs(args);
    const suite = currentSuite;
    const timeout = suite.timeout;
    vHook((vctx) => {
      if (setsCurrentTest) suite.ctx.currentTest = testInfo(vctx.task, suite.ctx);
      return run(fn, {suite, timeout, title: `"${vHook.name}" hook`, vctx, kind: 'hook'});
    }, NO_TIMEOUT);
  };
}

function wrapAllHook(vHook) {
  return function (...args) {
    const fn = hookArgs(args);
    const suite = currentSuite;
    const timeout = suite.timeout;
    vHook(() => run(fn, {suite, timeout, title: `"${vHook.name}" hook`, kind: 'hook'}), NO_TIMEOUT);
  };
}

const describe = wrapDescribe(vitest.describe);
describe.only = wrapDescribe(vitest.describe.only);
describe.skip = wrapDescribe(vitest.describe.skip);
const it = wrapIt(vitest.it);
it.only = wrapIt(vitest.it.only);
it.skip = (title) => vitest.it.skip(String(title), () => {});

Object.assign(globalThis, {
  describe,
  context: describe,
  xdescribe: describe.skip,
  xcontext: describe.skip,
  it,
  specify: it,
  xit: it.skip,
  xspecify: it.skip,
  before: wrapAllHook(vitest.beforeAll),
  after: wrapAllHook(vitest.afterAll),
  beforeEach: wrapEachHook(vitest.beforeEach, true),
  afterEach: wrapEachHook(vitest.afterEach, true),
});
