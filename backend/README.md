# 폴더 구조

```
backend/
├── database/            # SQL 스키마 및 실제 .db 파일 보관
│   ├── schema.sql       # 우리가 만든 설계도
│   └── lazidrome.db     # (자동생성) SQLite 실제 데이터베이스
├── src/
│   ├── index.js         # Entry Point (서버 가동 및 플러그인 등록)
│   ├── db.js            # Database 연결 및 초기화 (Better-SQLite3)
│   ├── lib/             # 공통 유틸리티 및 로직 (순수 함수들)
│   │   ├── hasher.js    # 파일 해시 추출
│   │   ├── metadata.js  # ID3 태그 추출 및 정제
│   │   └── scrobbler.js # Last.fm 연동 로직
│   ├── services/        # 비즈니스 로직 및 백그라운드 작업
│   │   └── scanner.js   # Chokidar 기반 파일 감시 및 DB 동기화
│   └── routes/          # API 엔드포인트 정의
│       ├── tracks.js    # 곡 목록, 태그 수정, 별점
│       ├── artists.js   # 아티스트 정보, 바이오그래피
│       └── stream.js    # 실시간 음원 스트리밍 (FFmpeg 처리 가능)
├── .env                 # 환경 변수 (음악 폴더 경로 등)
└── package.json
```

# 파일별 핵심 기능 및 메소드 요약

1. src/db.js (데이터베이스 엔진)

- initDB(): 서버 시작 시 lazidrome.db가 없으면 schema.sql을 읽어 테이블을 생성합니다.

- db.prepare(...): 모든 서비스에서 사용할 공통 쿼리 실행 객체를 익스포트합니다.

2. src/lib/ (도구함)

- hasher.js: getFileHash(filePath) -> 파일의 SHA-256 값을 뽑아 track_filedata의 PK로 씁니다.

- metadata.js: parseTags(filePath) -> music-metadata를 이용해 제목, 아티스트, 비트레이트 등을 객체로 반환합니다.

- scrobbler.js: postToLastFM(trackInfo) -> 재생 완료 시 Last.fm API로 기록을 보냅니다.

3. src/services/scanner.js (감시자)

- startScanner(watchPath): chokidar를 가동해 폴더를 감시합니다.

- handleNewFile(path): 새 파일 발견 시 hasher로 ID 확인 -> DB에 없으면 metadata 추출 후 INSERT.

- handleDelete(path): 파일 삭제 시 DB에서 해당 경로 삭제 (Cascade 옵션 덕분에 메타데이터도 날아감).

4. src/routes/ (입구)

- tracks.js:

    - GET /api/tracks: 최신순/별점순 곡 목록 반환.

    - PATCH /api/tracks/:id: 태그 수정 및 별점 부여.

- stream.js:

    - GET /api/stream/:id: track_filedata에서 경로를 찾아 fastify-static이나 Range 헤더를 처리하며 음원을 쏴줍니다.