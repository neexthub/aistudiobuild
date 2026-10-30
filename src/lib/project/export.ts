import { zipSync, strToU8 } from 'fflate';
import { validateFiles, type FileMap } from './files';
export function sourceZip(files: FileMap): Uint8Array {
  validateFiles(files);
  return zipSync(Object.fromEntries(Object.entries(files).filter(([path]) => !/(^|\/)(\.git|node_modules|\.next|dist|out|accounts|sessions)(\/|$)|(^|\/)\.env/.test(path)).map(([path, content]) => [path, strToU8(content)])));
}
export function downloadSource(files: FileMap, name: string) {
  const data = sourceZip(files);
  const blob = new Blob([new Uint8Array(data)], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `${name}.zip`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
