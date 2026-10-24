import { restValues } from './evaluate';

/** Channel values of the running scenario, refreshed every frame and read by the scene (no React state). */
export const liveChannels = restValues();
