import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const base = 'https://xiaohongshu-demo-86151.abloom-root-8763.chatgpt.site/downloads/';
const expectedHash = '6546170e1677262eed3b528cdee68af6a7cc1657e328cd0f84c8a21137c9d5ee';
const expectedBytes = 54925951;
const manifestResponse = await fetch(base + 'local-preview-manifest.json', { signal: AbortSignal.timeout(120000) });
if (!manifestResponse.ok) throw new Error('Manifest HTTP ' + manifestResponse.status);
const manifest = await manifestResponse.json();
if (manifest.sha256 !== expectedHash || manifest.bytes !== expectedBytes || manifest.parts.length !== 14) {
  throw new Error('Unexpected local ZIP manifest');
}
const buffers = new Array(manifest.parts.length);
let next = 0;
async function worker() {
  while (next < manifest.parts.length) {
    const index = next++;
    const part = manifest.parts[index];
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(base + encodeURIComponent(part.name), { signal: AbortSignal.timeout(180000) });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const bytes = Buffer.from(await response.arrayBuffer());
        const hash = createHash('sha256').update(bytes).digest('hex');
        if (bytes.length !== part.bytes || hash !== part.sha256) throw new Error('Part hash or size mismatch');
        buffers[index] = bytes;
        console.log('Verified ' + part.name);
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        if (attempt < 3) await new Promise(resolve => setTimeout(resolve, attempt * 3000));
      }
    }
    if (lastError) throw new Error(part.name + ': ' + lastError.message);
  }
}
await Promise.all(Array.from({ length: 4 }, () => worker()));
const destination = 'xiaohongshu-local-preview.zip';
const assembled = Buffer.concat(buffers);
const actualHash = createHash('sha256').update(assembled).digest('hex');
if (assembled.length !== expectedBytes || actualHash !== expectedHash) {
  throw new Error('Assembled ZIP differs from the desktop local preview');
}
await writeFile(destination, assembled);
const uploadedHash = createHash('sha256').update(await readFile(destination)).digest('hex');
if (uploadedHash !== expectedHash) throw new Error('Written ZIP hash mismatch');
console.log('Exact local ZIP verified: ' + actualHash + ' (' + assembled.length + ' bytes)');
