// Copies the MediaPipe WASM runtime (classic and module builds) into public/ so hand tracking is served by the app itself.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const from = join('node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const to = join('public', 'mediapipe');
if (!existsSync(from)) process.exit(0);
mkdirSync(to, { recursive: true });
for (const build of ['vision_wasm_internal', 'vision_wasm_module_internal'])
  for (const ext of ['.js', '.wasm']) copyFileSync(join(from, build + ext), join(to, build + ext));
console.log('MediaPipe runtime copied to public/mediapipe');
