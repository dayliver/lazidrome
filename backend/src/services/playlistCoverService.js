import { imagesSubdir } from '../lib/imagesPath.js';
import { saveCoverFromBuffer as writeCoverFromBuffer } from '../lib/imageCoverWrite.js';

export async function savePlaylistCoverImage(id, buffer) {
  if (!buffer) return null;
  let coverType = null;
  await writeCoverFromBuffer(
    id,
    buffer,
    imagesSubdir('playlists'),
    () => {
      coverType = 'jpg';
    },
    { quality: 80 },
  );
  return coverType;
}
