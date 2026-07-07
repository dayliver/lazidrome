import path from 'node:path';
import { parseArtistAlbumTitleFilename, parseLazidromeUploadPath } from './pathSanitize.js';
import { splitArtistNames } from './artistTags.js';

/**
 * ID3/Vorbis 태그 + Lazidrome 업로드 경로·파일명으로 스캔용 메타 확정.
 * 태그가 비었거나 제목이 `아티스트 - 앨범 - 제목` 합성 문자열인 경우 파일명/폴더를 우선한다.
 */
export function resolveScanTrackMeta(filePath, tracksRoot, metadata) {
  const ext = path.extname(filePath);
  const baseName = path.basename(filePath, ext);
  const pathHints = parseLazidromeUploadPath(filePath, tracksRoot);
  const parsedFromBase = parseArtistAlbumTitleFilename(baseName);
  const parsedFromTitle = parseArtistAlbumTitleFilename(String(metadata?.common?.title ?? '').trim());

  let title = String(metadata?.common?.title ?? '').trim();
  let albumName = String(metadata?.common?.album ?? '').trim();
  let trackArtistNames = splitArtistNames(metadata?.common?.artist);
  let albumArtistTagNames = splitArtistNames(metadata?.common?.albumartist);
  let albumNamesForAlbum = splitArtistNames(
    metadata?.common?.albumartist || metadata?.common?.artist,
  );

  const compositeTitle =
    parsedFromTitle ||
    (title === baseName && parsedFromBase) ||
    (!albumName && !trackArtistNames.length && parsedFromBase);

  if (compositeTitle) {
    const parsed = parsedFromBase || parsedFromTitle;
    if (parsed) {
      title = parsed.title;
      albumName = parsed.album;
      trackArtistNames = splitArtistNames(parsed.artist);
      albumNamesForAlbum = splitArtistNames(parsed.artist);
      albumArtistTagNames = splitArtistNames(parsed.artist);
    }
  } else {
    if (!title) title = pathHints.title || baseName;
    if (!albumName) albumName = pathHints.album || '';
    if (!trackArtistNames.length && pathHints.artist) {
      trackArtistNames = splitArtistNames(pathHints.artist);
    }
    if (!albumNamesForAlbum.length) {
      albumNamesForAlbum = splitArtistNames(pathHints.artist);
    }
    if (!albumArtistTagNames.length && pathHints.artist) {
      albumArtistTagNames = splitArtistNames(pathHints.artist);
    }
  }

  if (!title) title = baseName;

  return {
    title,
    albumName,
    trackArtistNames,
    albumArtistTagNames,
    albumNamesForAlbum,
    year: metadata?.common?.year || null,
    genre: metadata?.common?.genre?.[0] || null,
    trackNo: metadata?.common?.track?.no || null,
    discNo: metadata?.common?.disk?.no || null,
    duration: metadata?.format?.duration || 0,
  };
}
