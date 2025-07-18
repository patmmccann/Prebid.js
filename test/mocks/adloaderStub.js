import * as adloader from 'src/adloader.js';

// this export is for adloader's tests against actual implementation
export const loadExternalScript = adloader.loadExternalScript;

export let loadExternalScriptStub = createStub();

function createStub() {
  return sinon.stub(adloader, 'loadExternalScript').callsFake((...args) => {
    if (typeof args[3] === 'function') {
      args[3]();
    }
    return document.createElement('script');
  });
}

beforeEach(function() {
  loadExternalScriptStub.restore();
  loadExternalScriptStub = createStub();
});
