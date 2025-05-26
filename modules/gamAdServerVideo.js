/* eslint prebid/validate-imports: "off" */
import {registerVideoSupport} from '../src/adServerManager.js';
import {buildDfpVideoUrl, getVastXml, notifyTranslationModule, dep, VAST_TAG_URI_TAGNAME, getBase64BlobContent} from 'modules/dfpAdServerVideo.js';

export const buildGamVideoUrl = buildDfpVideoUrl;
export { getVastXml, notifyTranslationModule, dep, VAST_TAG_URI_TAGNAME, getBase64BlobContent };

registerVideoSupport('gam', {
  buildVideoUrl: buildGamVideoUrl,
  getVastXml
});
