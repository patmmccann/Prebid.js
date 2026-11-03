// Throwaway diagnostic: does an overwrite/deletion of a cookie made through document.cookie show up in the
// next document.cookie read in this browser?
function read(name) {
  const m = document.cookie.split('; ').find(c => c.startsWith(name + '='));
  return m === undefined ? null : m.slice(name.length + 1);
}
const PAST = 'Thu, 01 Jan 1970 00:00:01 GMT';
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const results = [];
function log(label, value) {
  results.push(`${label}=${JSON.stringify(value)}`);
  // eslint-disable-next-line no-console
  console.log(`[cookie-probe] ${label}: ${JSON.stringify(value)} | all: ${document.cookie.length} chars, ${document.cookie ? document.cookie.split('; ').length : 0} cookies`);
}

describe('cookie probe', () => {
  after(() => {
    // eslint-disable-next-line no-console
    console.log('[cookie-probe] SUMMARY ' + results.join(' '));
  });

  it('A: overwrite immediately, same task', () => {
    document.cookie = 'probeA=1; path=/';
    log('A after set 1', read('probeA'));
    document.cookie = 'probeA=2; path=/';
    log('A after set 2', read('probeA'));
    document.cookie = `probeA=; expires=${PAST}; path=/`;
    log('A after delete', read('probeA'));
  });

  it('B: delete in a later task', async () => {
    document.cookie = 'probeB=1; path=/';
    log('B after set', read('probeB'));
    await wait(0);
    document.cookie = `probeB=; expires=${PAST}; path=/`;
    log('B after delete (sync)', read('probeB'));
    await wait(0);
    log('B after delete +0ms', read('probeB'));
    await wait(50);
    log('B after delete +50ms', read('probeB'));
    await wait(500);
    log('B after delete +550ms', read('probeB'));
  });

  it('C: overwrite in a later task', async () => {
    document.cookie = 'probeC=1; path=/';
    read('probeC');
    await wait(0);
    document.cookie = 'probeC=2; path=/';
    log('C after overwrite (sync)', read('probeC'));
    await wait(50);
    log('C after overwrite +50ms', read('probeC'));
    await wait(500);
    log('C after overwrite +550ms', read('probeC'));
    document.cookie = `probeC=; expires=${PAST}; path=/`;
  });

  it('D: set with an invalid expires ("20000"), then delete in a later task', async () => {
    document.cookie = 'probeD=value; expires=20000; path=/';
    log('D after set', read('probeD'));
    await wait(0);
    document.cookie = `probeD=; expires=${PAST}; path=/`;
    log('D after delete (sync)', read('probeD'));
    await wait(500);
    log('D after delete +500ms', read('probeD'));
  });

  it('E: set with a future expires, then delete in a later task', async () => {
    document.cookie = `probeE=value; expires=${new Date(Date.now() + 3600e3).toUTCString()}; path=/`;
    log('E after set', read('probeE'));
    await wait(0);
    document.cookie = `probeE=; expires=${PAST}; path=/`;
    log('E after delete (sync)', read('probeE'));
    await wait(500);
    log('E after delete +500ms', read('probeE'));
  });

  it('F: set without reading, then delete', async () => {
    document.cookie = 'probeF=1; path=/';
    await wait(0);
    document.cookie = `probeF=; expires=${PAST}; path=/`;
    log('F after delete (sync)', read('probeF'));
    await wait(500);
    log('F after delete +500ms', read('probeF'));
  });

  it('G: max-age=0 delete in a later task', async () => {
    document.cookie = 'probeG=1; path=/';
    log('G after set', read('probeG'));
    await wait(0);
    document.cookie = 'probeG=; max-age=0; path=/';
    log('G after delete (sync)', read('probeG'));
    await wait(500);
    log('G after delete +500ms', read('probeG'));
  });

  it('H: many writes then delete', async () => {
    for (let i = 0; i < 20; i++) document.cookie = `probeH=${i}; path=/`;
    log('H after 20 writes', read('probeH'));
    await wait(0);
    document.cookie = `probeH=; expires=${PAST}; path=/`;
    log('H after delete (sync)', read('probeH'));
    await wait(500);
    log('H after delete +500ms', read('probeH'));
  });

  [50, 100, 150, 200, 300].forEach(n => it(`J${n}: with ${n} other cookies, overwrite and delete`, async () => {
    for (let i = 0; i < n; i++) document.cookie = `probeFill${i}=${'x'.repeat(20)}; path=/`;
    log(`J${n} filled`, document.cookie.split('; ').filter(c => c.startsWith('probeFill')).length);
    document.cookie = 'probeJ=1; path=/';
    log(`J${n} after set`, read('probeJ'));
    await wait(0);
    document.cookie = 'probeJ=2; path=/';
    log(`J${n} after overwrite`, read('probeJ'));
    document.cookie = `probeJ=; expires=${PAST}; path=/`;
    log(`J${n} after delete`, read('probeJ'));
    await wait(100);
    log(`J${n} after delete +100ms`, read('probeJ'));
    document.cookie = 'probeJnew=1; path=/';
    log(`J${n} new cookie`, read('probeJnew'));
    document.cookie = `probeJnew=; expires=${PAST}; path=/`;
  }));

  it('K: clean up fill cookies', async () => {
    for (let i = 0; i < 300; i++) document.cookie = `probeFill${i}=; expires=${PAST}; path=/`;
    log('K remaining fill', document.cookie.split('; ').filter(c => c.startsWith('probeFill')).length);
    document.cookie = 'probeK=1; path=/';
    await wait(0);
    document.cookie = `probeK=; expires=${PAST}; path=/`;
    log('K after delete', read('probeK'));
  });

  it('L: set then delete in the same task, read later', async () => {
    document.cookie = 'probeL=1; path=/';
    read('probeL');
    document.cookie = `probeL=; expires=${PAST}; path=/`;
    log('L sync', read('probeL'));
    await wait(0);
    log('L +0ms', read('probeL'));
    await wait(50);
    log('L +50ms', read('probeL'));
    await wait(500);
    log('L +550ms', read('probeL'));
  });

  [0, 1, 5, 20].forEach(gap => it(`M${gap}: 100 rounds of set, ${gap}ms, delete/overwrite, check now and 20ms later`, async function () {
    this.timeout(60000);
    let staleDelete = 0; let staleDeleteLater = 0; let staleOverwrite = 0; let staleOverwriteLater = 0;
    for (let i = 0; i < 100; i++) {
      document.cookie = `probeM=a${i}; path=/`;
      await wait(gap);
      document.cookie = `probeM=; expires=${PAST}; path=/`;
      if (read('probeM') !== null) staleDelete++;
      await wait(20);
      if (read('probeM') !== null) staleDeleteLater++;
      document.cookie = `probeN=a${i}; path=/`;
      await wait(gap);
      document.cookie = `probeN=b${i}; path=/`;
      if (read('probeN') !== `b${i}`) staleOverwrite++;
      await wait(20);
      if (read('probeN') !== `b${i}`) staleOverwriteLater++;
    }
    document.cookie = `probeN=; expires=${PAST}; path=/`;
    log(`M${gap} stale`, { staleDelete, staleDeleteLater, staleOverwrite, staleOverwriteLater });
  }));

  it('I: clock check', () => {
    log('I Date.now', Date.now());
    log('I UTC', new Date().toUTCString());
    log('I UA', navigator.userAgent);
    log('I cookieEnabled', navigator.cookieEnabled);
    log('I origin', location.origin);
    log('I isSecureContext', window.isSecureContext);
  });
});
