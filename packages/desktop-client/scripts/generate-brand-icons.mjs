import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const packageDirectory = path.resolve(scriptDirectory, '..');
const publicDirectory = path.join(packageDirectory, 'public');
const sourceIcon = path.join(publicDirectory, 'nosso-caderninho-icon.svg');
const electronIcon = path.resolve(
  packageDirectory,
  '../desktop-electron/icons/icon.png',
);

const outputs = [
  ['favicon-16x16.png', 16],
  ['favicon-32x32.png', 32],
  ['apple-touch-icon.png', 180],
  ['android-chrome-192x192.png', 192],
  ['android-chrome-512x512.png', 512],
  ['maskable-192x192.png', 192],
  ['maskable-512x512.png', 512],
];

await Promise.all(
  outputs.map(([filename, size]) =>
    sharp(sourceIcon)
      .resize(size, size)
      .png()
      .toFile(path.join(publicDirectory, filename)),
  ),
);

await sharp(sourceIcon).resize(1024, 1024).png().toFile(electronIcon);
