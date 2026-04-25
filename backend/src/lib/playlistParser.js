export async function parsePlaylistRequest(request) {
  let data = { name: '', description: '', type: 'list', rules: null, playlistTracks: [] };
  let coverBuffer = null;

  if (request.isMultipart()) {
    if (request.body && request.body.name && request.body.name.value !== undefined) {
      data.name = request.body.name.value;
      data.description = request.body.description?.value;
      data.type = request.body.type?.value || 'list';
      data.rules = request.body.rules?.value;
      data.playlistTracks = request.body.playlistTracks?.value;
      if (request.body.newCoverFile) coverBuffer = await request.body.newCoverFile.toBuffer();
    } else {
      const parts = request.parts();
      for await (const part of parts) {
        if (part.file && part.fieldname === 'newCoverFile') coverBuffer = await part.toBuffer();
        else if (part.fieldname) data[part.fieldname] = part.value;
      }
    }
  } else {
    data = { ...request.body };
  }

  if (typeof data.rules === 'string') {
    try { data.rules = JSON.parse(data.rules); } catch(e) { data.rules = null; }
  }
  if (typeof data.playlistTracks === 'string') {
    try { data.playlistTracks = JSON.parse(data.playlistTracks); } catch(e) { data.playlistTracks = []; }
  }

  return { data, coverBuffer };
}