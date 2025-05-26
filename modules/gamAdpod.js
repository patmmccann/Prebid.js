/* eslint prebid/validate-imports: "off" */
import {registerVideoSupport} from '../src/adServerManager.js';
import {buildAdpodVideoUrl, adpodUtils} from 'modules/dfpAdpod.js';

registerVideoSupport('gam', {
  buildAdpodVideoUrl,
  getAdpodTargeting: (args) => adpodUtils.getTargeting(args)
});

export { buildAdpodVideoUrl, adpodUtils };
