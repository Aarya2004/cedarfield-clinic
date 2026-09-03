/**
 * Stamped by the deploy step (docs/RECORDING.md, evidence chains): `vercel` CLI deploys carry no git
 * hash, and this route renders per request, so a build-time env never reaches it. The deploy writes
 * the short SHA and the UTC time here before uploading; the committed default is what a local run shows.
 */
export const BUILD_SHA = 'local';
export const BUILD_AT = 'local';
