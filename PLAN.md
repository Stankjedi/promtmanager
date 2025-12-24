# Project Plan — Prompt Manager / Prompt Generator

## 목표(핵심 UX)

- 옵션형 마스터 프롬프트(CATEGORY/VIEW/POSE 등)를 **버튼/토글 UI**로 선택
- 선택값을 즉시 반영해 **최종 프롬프트를 실시간 조립(미리보기)**
- 버튼 1번(또는 단축키)으로 **클립보드 복사**

## 현재 상태

`promptgen-extension/`에 **Manifest V3 + Side Panel** 기반 MVP를 구현했습니다.

- Side Panel UI(옵션 버튼 + 미리보기 + Copy)
- 템플릿 1개 내장(Pixel Sprite DB16)
- required 검증 + optional 라인 제거(omitLineIfEmpty) + 토큰 치환
- `chrome.storage.local` 저장/복원
- (선택) 우클릭 메뉴로 선택 텍스트를 ASSET에 주입 + 패널 오픈

## 아키텍처 개요(MV3)

- Service Worker: 설치 초기화, 컨텍스트 메뉴 이벤트 처리
- Side Panel 페이지: UI/렌더링/복사/저장
- Storage: 기본은 `chrome.storage.local`(템플릿/값), 필요 시 `chrome.storage.sync`는 가벼운 설정만

## 권한(permissions) 전략

- 필수: `storage`, `sidePanel`
- 선택: `contextMenus`(우클릭 주입)
- (주의) `clipboardWrite`는 설치 경고가 커서 기본은 제외하고, 환경 정책으로 복사가 막히는 경우에만 추가 고려

## 로드맵

### Phase 1 — MVP(완료)

- Side Panel 메인 UI
- 내장 템플릿 1개
- 버튼 선택(CATEGORY/VIEW/POSE) + ASSET 입력
- 미리보기 즉시 조립 + Copy
- 선택값 저장/복원(local)
- 우클릭 메뉴(선택 텍스트 → ASSET)

### Phase 1.5 — 폴리싱(권장)

- UX 개선: Copy 성공/실패 토스트, 필수값 포커스 이동, 미리보기 “자동 스크롤 유지” 옵션
- 템플릿 UI 개선: 섹션 접기/펼치기, 옵션 검색(필드 옵션이 많아질 때)
- 복사 안정화: 환경별 실패 케이스 수집 후 `clipboardWrite` 옵션화(설치 경고 안내 포함)

### Phase 2 — Options page(템플릿 관리)

- 템플릿 목록/추가/복제/삭제
- Import/Export(JSON): 파일 업로드 + 다운로드(Blob)로 권한 없이 구현
- 템플릿 검증:
  - 중복 `id`
  - `master` 내 토큰 누락/불일치
  - `fields` 옵션 비어있음/형식 오류
  - `required`/`defaultValue`/`allowNone` 조합 오류
- 내장 템플릿은 읽기 전용, 사용자 템플릿만 편집 가능

### Phase 3 — “프롬프트 텍스트 → 옵션 자동 파싱”

- `{a|b|c}`, `{a / b / c}`, `{a, b, c}` 감지 → `fields` 자동 생성
- `(optional)`/`optional` 감지 → `omitLineIfEmpty=true` 자동 설정
- 라벨 기반 `id` 생성(snake_case 정규화) + 중복 방지
- 파싱 결과를 Options page에서 편집 가능하게 연결

### Phase 4 — 워크플로 자동화

- 우클릭 메뉴 확장:
  - “선택 텍스트를 ASSET에 넣기 + 패널 열기”
  - (선택) 선택 텍스트를 특정 필드에 매핑
- 단축키(commands): 패널 열기 / Copy
- 히스토리(최근 복사 N개), 즐겨찾기, 태그

## 완료 기준(DoD) 체크리스트

- Chrome에서 Unpacked로 로드 가능
- Side Panel에서 옵션 변경 시 미리보기가 즉시 갱신됨
- 필수값 미입력 시 오류 표시 + Copy 차단
- Copy 버튼/단축키로 클립보드 복사 성공(정책 차단 시 명확한 안내)
- 새로고침/재시작 후 선택값이 복원됨

## 운영/테스트 메모

- Side Panel은 Chrome 버전에 따라 “아이콘 클릭으로 자동 오픈” 동작이 달라질 수 있어 수동 오픈 경로도 안내합니다.
- `storage.sync`는 쿼터가 작으므로 템플릿 본문은 `storage.local` 유지가 안전합니다.

### 운영 노트(권장)

- 클립보드 복사는 환경/정책에 의해 차단될 수 있으므로, 실패 시 수동 복사 플로우(텍스트 선택 → `Ctrl/Cmd+C`)를 항상 제공하는 방향이 안전합니다.
- `chrome.storage.local` 데이터(`pg.customTemplates`, `pg.values.*`)는 사용자가 직접 수정/손상시킬 수 있으므로, 런타임 스키마 검증 및 안전 폴백이 필요합니다.
- 템플릿 스키마 변경이 발생하면 버전/마이그레이션 정책을 함께 정의해 호환성을 유지합니다.
