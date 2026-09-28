import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const manifest = JSON.parse(await readFile('package-manifest.json', 'utf8'));
const output = 'package';
await mkdir(output, { recursive: true });
await copyFile('index.html', join(output, 'index.html'));

let next = 0;
async function download(file) {
  const encodedPath = file.path.split('/').map(encodeURIComponent).join('/');
  const url = new URL(encodedPath, manifest.source.endsWith('/') ? manifest.source : manifest.source + '/');
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const bytes = Buffer.from(await response.arrayBuffer());
      const hash = createHash('sha256').update(bytes).digest('hex');
      if (bytes.length !== file.size || hash !== file.sha256) {
        throw new Error('Content mismatch: expected ' + file.size + '/' + file.sha256 + ', got ' + bytes.length + '/' + hash);
      }
      const destination = join(output, ...file.path.split('/'));
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, bytes);
      console.log('Verified ' + file.path);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, attempt * 2000));
    }
  }
  throw new Error(file.path + ': ' + lastError.message);
}
async function worker() {
  while (next < manifest.files.length) {
    const file = manifest.files[next++];
    await download(file);
  }
}
await Promise.all(Array.from({ length: Math.min(8, manifest.files.length) }, () => worker()));
console.log('Verified ' + (manifest.files.length + 1) + ' package files.');
