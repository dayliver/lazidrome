import { imagesSubdir } from '../lib/imagesPath.js';
import {
  saveCoverFromUrl as writeCoverFromUrl,
  saveCoverFromBuffer as writeCoverFromBuffer,
} from '../lib/imageCoverWrite.js';
import { updateAlbumCoverType } from '../repositories/albumRepository.js';

const COVERS_DIR = imagesSubdir('albums');

export async function saveCoverFromUrl(albumId, url) {
  await writeCoverFromUrl(albumId, url, COVERS_DIR, (ext) => updateAlbumCoverType(albumId, ext));
}

export async function saveCoverFromBuffer(albumId, buffer) {
  await writeCoverFromBuffer(albumId, buffer, COVERS_DIR, () => updateAlbumCoverType(albumId, '.jpg'));
}
