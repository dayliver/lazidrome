/*
===============================================================================
[Project] Lazidrome - Minimalist Music Server (v2.1)
[Strategy] 
 1. Many-to-Many Relationship: Tracks <-> Albums (Junction Table)
 2. Image Hierarchy: track_ -> album_ -> artist_ (Flag-based -> Type-based)
 3. Contextual Artwork: Support for album-specific track covers
===============================================================================
*/

-- 1. 물리 파일 데이터
CREATE TABLE track_filedata (
    id TEXT PRIMARY KEY,             -- 파일 해시 (sha256)
    path TEXT NOT NULL,
    size INTEGER NOT NULL,
    duration REAL NOT NULL,
    bitrate INTEGER,
    format TEXT,
    source TEXT DEFAULT 'scan',
    scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. 아티스트 정보
CREATE TABLE artists (
    id TEXT PRIMARY KEY,             -- ULID
    name TEXT NOT NULL,
    aliases TEXT,                    -- JSON: {"ko": "...", "jp": "..."}
    tags TEXT,                       -- JSON: ["Vocalist", "Rock"]
    cover_type TEXT,                 -- 💉 수정됨: NULL이면 이미지 없음, 값이 있으면 확장자 (예: '.jpg', '.png')
    mbid TEXT UNIQUE
);

-- 3. 앨범 정보 (main_artist_id 제거)
CREATE TABLE albums (
    id TEXT PRIMARY KEY,             -- ULID
    name TEXT NOT NULL,
    cover_type TEXT,                 -- NULL이면 이미지 없음, 값이 있으면 확장자 (예: '.jpg', '.png')
    year INTEGER,
    mbid TEXT UNIQUE
);

-- [신규] 3-1. 앨범-아티스트 교차 테이블 (다대다 관계)
CREATE TABLE album_artists (
    album_id TEXT NOT NULL,
    artist_id TEXT NOT NULL,
    PRIMARY KEY (album_id, artist_id),
    FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE,
    FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE
);

-- 4. 논리 트랙 메타데이터 (앨범 의존성 제거)
CREATE TABLE track_metadata (
    id TEXT PRIMARY KEY,             -- ULID
    file_id TEXT NOT NULL,
    title TEXT,
    year INTEGER,
    genre TEXT,
    rating INTEGER DEFAULT 0,
    starred INTEGER DEFAULT 0,
    play_count INTEGER DEFAULT 0,
    custom_cover_type TEXT,          -- 💉 수정됨: 기존 has_custom_cover 대체 (track_{id}{ext} 확인용)
    tags TEXT,                       -- JSON: ["신남", "드라이브"]
    last_played DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (file_id) REFERENCES track_filedata(id) ON DELETE CASCADE
);

-- 5. 앨범-트랙 교차 테이블 (다대다 관계의 핵심)
CREATE TABLE album_tracks (
    id TEXT PRIMARY KEY,             -- ULID
    album_id TEXT NOT NULL,
    track_id TEXT NOT NULL,
    is_primary INTEGER DEFAULT 0,    -- 1이면 이 트랙의 대표 앨범 (기본 커버/검색용)
    disc_number INTEGER,             -- 생략 가능
    track_number INTEGER,            -- 생략 가능
    FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE,
    FOREIGN KEY (track_id) REFERENCES track_metadata(id) ON DELETE CASCADE,
    UNIQUE(album_id, track_id)       -- 한 앨범에 같은 곡이 중복 등록 방지
);

-- 6. 아티스트 바이오그래피
CREATE TABLE artist_biographies (
    artist_id TEXT,
    language TEXT NOT NULL,
    biography TEXT,
    PRIMARY KEY (artist_id, language),
    FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE
);

-- 7. 관계 및 역할 (Bitmask)
CREATE TABLE track_artists (
    track_id TEXT,
    artist_id TEXT,
    role_mask INTEGER DEFAULT 1,
    PRIMARY KEY (track_id, artist_id),
    FOREIGN KEY (track_id) REFERENCES track_metadata(id) ON DELETE CASCADE,
    FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE
);

-- 8. 재생 기록
CREATE TABLE play_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    track_id TEXT NOT NULL,
    played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    scrobbled INTEGER DEFAULT 0,
    FOREIGN KEY (track_id) REFERENCES track_metadata(id) ON DELETE CASCADE
);

-- 9. 플레이리스트 (앨범과 유사한 구조로 통일)
CREATE TABLE playlists (
    id TEXT PRIMARY KEY,             -- ULID
    name TEXT NOT NULL,
    description TEXT,
    cover_type TEXT,                 -- 💉 수정됨: 기존 has_cover 대체
    is_compilation INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 10. 플레이리스트 곡 순서 (ULID PK 추가 및 필드명 통일)
CREATE TABLE playlist_tracks (
    id TEXT PRIMARY KEY,             -- ULID (앨범 트랙과 통일)
    playlist_id TEXT NOT NULL,
    track_id TEXT NOT NULL,
    position INTEGER NOT NULL,       -- 앨범의 track_number와 같은 역할
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    FOREIGN KEY (track_id) REFERENCES track_metadata(id) ON DELETE CASCADE,
    UNIQUE(playlist_id, track_id)
);

-- 11. 앱 전역 설정
CREATE TABLE app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 최적화
CREATE INDEX idx_track_path ON track_filedata(path);
CREATE INDEX idx_history_time ON play_history(played_at);
CREATE INDEX idx_album_track_lookup ON album_tracks(track_id);
CREATE INDEX idx_playlist_track_lookup ON playlist_tracks(track_id);