import { imagesSubdir } from '../lib/imagesPath.js';
import {
  saveCoverFromUrl as writeCoverFromUrl,
  saveCoverFromBuffer as writeCoverFromBuffer,
} from '../lib/imageCoverWrite.js';
import { updateArtistCoverType } from '../repositories/artistRepository.js';

const COVERS_DIR = imagesSubdir('artists');

export async function saveArtistCoverFromUrl(artistId, url) {
  await writeCoverFromUrl(artistId, url, COVERS_DIR, (ext) => updateArtistCoverType(artistId, ext));
}

export async function saveArtistCoverFromBuffer(artistId, buffer) {
  await writeCoverFromBuffer(artistId, buffer, COVERS_DIR, () =>
    updateArtistCoverType(artistId, '.jpg'),
  );
}
