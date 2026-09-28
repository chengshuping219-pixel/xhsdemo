import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const old = await readFile('previous/xiaohongshu-local-preview.zip');
const oldHash = createHash('sha256').update(old).digest('hex');
if (old.length !== 54925952 || oldHash !== '4ee7f97bed06a8e57e64cd26af3ac08a73f2c5ffbce0273693fe9d388da04063') {
  throw new Error('Previous release is not the verified local ZIP');
}
const tail = Buffer.from((await readFile('patches/corner-fix-tail.b64', 'utf8')).trim(), 'base64');
if (tail.length !== 13824) throw new Error('Unexpected local patch length');
const updated = Buffer.concat([old.subarray(0, 54912129), tail]);
const hash = createHash('sha256').update(updated).digest('hex');
if (updated.length !== 54925953 || hash !== '9db9e69a383ecb75b9162fed22766e8fa4c2a152a3b9fc4c0e2429e01a6ef0a3') {
  throw new Error('Patched ZIP differs from the local desktop ZIP');
}
await writeFile('xiaohongshu-local-preview.zip', updated);
console.log('Exact local ZIP verified: ' + hash);
