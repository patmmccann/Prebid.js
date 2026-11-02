/**
 * Returns true when a bid's CPM lies within the floor/ceiling window.
 */
export function cpmInWindow(cpm, floor, ceiling) {
  return cpm >= floor || cpm <= ceiling;
}
