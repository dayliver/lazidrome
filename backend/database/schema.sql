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
    mtime_ms INTEGER,                -- 파일 수정 시각(ms) — 스캐너 변경 감지용
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
    description TEXT,                -- 출처·비공식 음반 등 메모 (playlists.description 과 동일 용도)
    cover_type TEXT,                 -- NULL이면 이미지 없음, 값이 있으면 확장자 (예: '.jpg', '.png')
    tags TEXT,                       -- JSON: ["신남", "드라이브"]
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
    volume_pct INTEGER NOT NULL DEFAULT 100, -- 트랙 상대 음량 (100 = unity, 기기 마스터와 곱)
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
--    device_id는 소프트 참조(FK 없음): 기기 행을 지워도 과거 기록은 남는다.
CREATE TABLE play_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    track_id TEXT NOT NULL,
    played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    scrobbled INTEGER DEFAULT 0,
    listened_sec INTEGER,
    device_id TEXT,
    FOREIGN KEY (track_id) REFERENCES track_metadata(id) ON DELETE CASCADE
);

-- 8b. 재생 기기 레지스트리
--     exclude_from_stats=1인 기기의 재생은 홈 Top·차트·습관 집계에서 빠진다(기록 자체는 남음).
CREATE TABLE playback_devices (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    exclude_from_stats INTEGER NOT NULL DEFAULT 0,
    last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 9. 플레이리스트 통합 테이블
CREATE TABLE playlists (
    id TEXT PRIMARY KEY,             -- ULID
    name TEXT NOT NULL,
    description TEXT,
    cover_type TEXT,                 -- 커버 확장자 (.jpg 등)
    type TEXT DEFAULT 'list',        -- 💡 핵심: 'list' 또는 'mix'
    rules TEXT,                      -- 💡 핵심: mix일 경우 조건식 JSON 저장
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 10. 플레이리스트 곡 순서 (수동 playlist 전용)
CREATE TABLE playlist_tracks (
    id TEXT PRIMARY KEY,             -- ULID
    playlist_id TEXT NOT NULL,
    track_id TEXT NOT NULL,
    position INTEGER NOT NULL,       -- 곡 순서 정렬용
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    FOREIGN KEY (track_id) REFERENCES track_metadata(id) ON DELETE CASCADE
);

-- 11. 앱 전역 설정
CREATE TABLE app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 12. 페이지 방문 기록 (엔티티 상세 — 홈 "자주 찾은 항목")
CREATE TABLE page_visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    visited_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 최적화
CREATE INDEX idx_track_path ON track_filedata(path);
CREATE INDEX idx_history_time ON play_history(played_at);
CREATE INDEX idx_album_track_lookup ON album_tracks(track_id);
CREATE INDEX idx_playlist_track_lookup ON playlist_tracks(track_id);
CREATE INDEX idx_page_visits_time ON page_visits(visited_at);
CREATE INDEX idx_page_visits_entity ON page_visits(entity_type, entity_id, visited_at);
CREATE INDEX idx_artists_name ON artists(name);
CREATE UNIQUE INDEX idx_artists_name_unique ON artists(name COLLATE NOCASE);
CREATE INDEX idx_albums_name ON albums(name);
CREATE INDEX idx_track_metadata_file ON track_metadata(file_id);
CREATE INDEX idx_history_track_time ON play_history(track_id, played_at);
CREATE INDEX idx_history_device_time ON play_history(device_id, played_at);
CREATE INDEX idx_album_tracks_album ON album_tracks(album_id);
CREATE INDEX idx_playlist_tracks_playlist ON playlist_tracks(playlist_id, position);
CREATE INDEX idx_track_artists_artist ON track_artists(artist_id);