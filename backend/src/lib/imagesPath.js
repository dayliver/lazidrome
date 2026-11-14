import path from 'node:path';

/** Shared images root (`IMAGES_PATH` or `./storage/images`). */
export function resolveImagesRoot() {
  return path.resolve(process.env.IMAGES_PATH || './storage/images');
}

export function imagesSubdir(...parts) {
  return path.join(resolveImagesRoot(), ...parts);
}
