// Copy the extension's static files into dist/ next to the bundled JS and CSS.
import { mkdir, copyFile } from 'node:fs/promises';

const files = ['manifest.json', 'background.js', 'popup.html', 'popup.css', 'icon48.png'];

await mkdir('dist', { recursive: true });
for (const file of files) await copyFile(file, `dist/${file}`);
