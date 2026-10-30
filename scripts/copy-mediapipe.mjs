// Copies the MediaPipe WASM runtime (module build) into public/ so hand tracking is served by the app itself.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const from = join('node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const to = join('public', 'mediapipe');
if (!existsSync(from)) process.exit(0);
mkdirSync(to, { recursive: true });
for (const f of ['vision_wasm_module_internal.js', 'vision_wasm_module_internal.wasm']) copyFileSync(join(from, f), join(to, f));
console.log('MediaPipe runtime copied to public/mediapipe');
