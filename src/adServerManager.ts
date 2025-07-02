import { getGlobal, type PrebidJS } from './prebidGlobal.js';
import { logWarn } from './utils.js';

declare module './prebidGlobal' {
  interface PrebidJS {
    adServers?: Record<string, Record<string, any>>;
  }
}
const prebid = getGlobal() as PrebidJS;

/**
 * This file defines the plugin points in prebid-core for AdServer-specific functionality.
 *
 * Its main job is to expose functions for AdServer modules to append functionality to the Prebid public API.
 * For a given Ad Server with name "adServerName", these functions will only change the API in the
 * $$PREBID_GLOBAL$$.adServers[adServerName] namespace.
 */

export interface CachedVideoBid {
  /** The ID which can be used to retrieve this video from prebid-server. */
  videoCacheId: string;
}

export type VideoAdUrlBuilder = (bid: CachedVideoBid, options: Record<string, any>) => string;

export interface VideoSupport {
  buildVideoAdUrl: VideoAdUrlBuilder;
  [key: string]: any;
}

/**
 * Enable video support for the Ad Server.
 *
 * @property {string} name The identifying name for this adserver.
 * @property {VideoSupport} videoSupport An object with the functions needed to support video in Prebid.
 */
export function registerVideoSupport(name: string, videoSupport: VideoSupport): void {
  prebid.adServers = prebid.adServers || {};
  prebid.adServers[name] = prebid.adServers[name] || {};
  Object.keys(videoSupport).forEach((key) => {
    if (prebid.adServers![name][key]) {
      logWarn(`Attempting to add an already registered function property ${key} for AdServer ${name}.`);
      return;
    }
    prebid.adServers![name][key] = videoSupport[key];
  });
}
