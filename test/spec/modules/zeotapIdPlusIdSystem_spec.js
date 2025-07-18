import {expect} from 'chai';
import {attachIdSystem} from 'modules/userId/index.js';
import {getStorage, storage, zeotapIdPlusSubmodule} from 'modules/zeotapIdPlusIdSystem.js';
import * as storageManager from 'src/storageManager.js';
import {MODULE_TYPE_UID} from '../../../src/activities/modules.js';
import {createEidsArray} from '../../../modules/userId/eids.js';
import 'src/prebid.js';

const ZEOTAP_COOKIE_NAME = 'IDP';
const ZEOTAP_COOKIE = 'THIS-IS-A-DUMMY-COOKIE';
const ENCODED_ZEOTAP_COOKIE = btoa(JSON.stringify(ZEOTAP_COOKIE));

function unsetCookie() {
  storage.setCookie(ZEOTAP_COOKIE_NAME, '');
}

function unsetLocalStorage() {
  storage.setDataInLocalStorage(ZEOTAP_COOKIE_NAME, '');
}

describe('Zeotap ID System', function() {
  describe('Zeotap Module invokes StorageManager with appropriate arguments', function() {
    let getStorageManagerSpy;

    beforeEach(function() {
      getStorageManagerSpy = sinon.spy(storageManager, 'getStorageManager');
    });

    it('when a stored Zeotap ID exists it is added to bids', function() {
      getStorage();
      expect(getStorageManagerSpy.calledOnce).to.be.true;
      sinon.assert.calledWith(getStorageManagerSpy, {moduleType: MODULE_TYPE_UID, moduleName: 'zeotapIdPlus'});
    });
  });

  describe('test method: getId calls storage methods to fetch ID', function() {
    let cookiesAreEnabledStub;
    let getCookieStub;
    let localStorageIsEnabledStub;
    let getDataFromLocalStorageStub;

    beforeEach(() => {
      cookiesAreEnabledStub = sinon.stub(storage, 'cookiesAreEnabled');
      getCookieStub = sinon.stub(storage, 'getCookie');
      localStorageIsEnabledStub = sinon.stub(storage, 'localStorageIsEnabled');
      getDataFromLocalStorageStub = sinon.stub(storage, 'getDataFromLocalStorage');
    });

    afterEach(() => {
      storage.cookiesAreEnabled.restore();
      storage.getCookie.restore();
      storage.localStorageIsEnabled.restore();
      storage.getDataFromLocalStorage.restore();
      unsetCookie();
      unsetLocalStorage();
    });

    it('should check if cookies are enabled', function() {
      const id = zeotapIdPlusSubmodule.getId();
      expect(cookiesAreEnabledStub.calledOnce).to.be.true;
    });

    it('should call getCookie if cookies are enabled', function() {
      cookiesAreEnabledStub.returns(true);
      const id = zeotapIdPlusSubmodule.getId();
      expect(cookiesAreEnabledStub.calledOnce).to.be.true;
      expect(getCookieStub.calledOnce).to.be.true;
      sinon.assert.calledWith(getCookieStub, 'IDP');
    });

    it('should check for localStorage if cookies are disabled', function() {
      cookiesAreEnabledStub.returns(false);
      localStorageIsEnabledStub.returns(true)
      const id = zeotapIdPlusSubmodule.getId();
      expect(cookiesAreEnabledStub.calledOnce).to.be.true;
      expect(getCookieStub.called).to.be.false;
      expect(localStorageIsEnabledStub.calledOnce).to.be.true;
      expect(getDataFromLocalStorageStub.calledOnce).to.be.true;
      sinon.assert.calledWith(getDataFromLocalStorageStub, 'IDP');
    });
  });

  describe('test method: getId', function() {
    afterEach(() => {
      unsetCookie();
      unsetLocalStorage();
    });

    it('provides the stored Zeotap id if a cookie exists', function() {
      storage.setCookie(ZEOTAP_COOKIE_NAME, ENCODED_ZEOTAP_COOKIE);
      const id = zeotapIdPlusSubmodule.getId();
      expect(id).to.deep.equal({
        id: ENCODED_ZEOTAP_COOKIE
      });
    });

    it('provides the stored Zeotap id if cookie is absent but present in local storage', function() {
      storage.setDataInLocalStorage(ZEOTAP_COOKIE_NAME, ENCODED_ZEOTAP_COOKIE);
      const id = zeotapIdPlusSubmodule.getId();
      expect(id).to.deep.equal({
        id: ENCODED_ZEOTAP_COOKIE
      });
    });

    it('returns undefined if both cookie and local storage are empty', function() {
      const id = zeotapIdPlusSubmodule.getId();
      expect(id).to.be.undefined
    })
  });

  describe('test method: decode', function() {
    it('provides the Zeotap ID (IDP) from a stored object', function() {
      const zeotapId = {
        id: ENCODED_ZEOTAP_COOKIE,
      };

      expect(zeotapIdPlusSubmodule.decode(zeotapId)).to.deep.equal({
        IDP: ZEOTAP_COOKIE
      });
    });

    it('provides the Zeotap ID (IDP) from a stored string', function() {
      const zeotapId = ENCODED_ZEOTAP_COOKIE;

      expect(zeotapIdPlusSubmodule.decode(zeotapId)).to.deep.equal({
        IDP: ZEOTAP_COOKIE
      });
    });
  });

  describe('eids', () => {
    before(() => {
      attachIdSystem(zeotapIdPlusSubmodule);
    });
    it('zeotapIdPlus', function() {
      const userId = {
        IDP: 'some-random-id-value'
      };
      const newEids = createEidsArray(userId);
      expect(newEids.length).to.equal(1);
      expect(newEids[0]).to.deep.equal({
        source: 'zeotap.com',
        uids: [{
          id: 'some-random-id-value',
          atype: 1
        }]
      });
    });
  });
});
