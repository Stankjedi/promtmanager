<p align="center">
  <img
    src="promptgen-extension/icons/icon128.png"
    width="96"
    height="96"
    alt="프롬프트 생성기(사이드 패널) 아이콘"
  />
</p>

# promtmanager — 프롬프트 생성기 (사이드 패널)

Manifest V3 기반 Chrome/Edge 확장입니다. 템플릿으로 프롬프트를 **조립·검증**하고, **즉시 복사**할 수 있습니다.

- **현재 버전:** 0.1.3 (`promptgen-extension/manifest.json`)
- **저장 방식:** `chrome.storage.local` (로컬 퍼스트 / 계정·서버 불필요)

## 설치(마켓플레이스)

- **Chrome Web Store:** https://chromewebstore.google.com/search/%ED%94%84%EB%A1%AC%ED%94%84%ED%8A%B8%20%EC%83%9D%EC%84%B1%EA%B8%B0%20%EC%82%AC%EC%9D%B4%EB%93%9C%20%ED%8C%A8%EB%84%90
- **Microsoft Edge Add-ons:** https://microsoftedge.microsoft.com/addons/search/%ED%94%84%EB%A1%AC%ED%94%84%ED%8A%B8%20%EC%83%9D%EC%84%B1%EA%B8%B0%20%EC%82%AC%EC%9D%B4%EB%93%9C%20%ED%8C%A8%EB%84%90

> 위 링크는 “검색 링크”입니다. 스토어 **상세페이지 URL**을 알려주시면 “바로 설치” 링크로 정확히 교체하겠습니다.

## 주요 기능

- **사이드 패널로 즉시 사용:** 템플릿 선택 → 옵션/텍스트 입력 → 미리보기/검증 → 복사
- **템플릿 검색 + 즐겨찾기(⭐):** 템플릿이 많아져도 빠르게 탐색/전환
- **값 초기화:** 현재 템플릿 입력값을 기본값으로 되돌리고 저장
- **옵션 페이지(템플릿 운영):** 생성/복제/삭제, 기본 템플릿 오버라이드, 가져오기/내보내기, 필드 자동 생성(마스터 문법 기반)
- **우클릭 주입(선택):** 선택 텍스트를 ASSET에 주입하고 패널을 열어 워크플로 단축

## 실행(로컬 개발자 모드, 압축해제 로드)

### Chrome
1. `chrome://extensions` 열기
2. 개발자 모드 ON
3. **압축해제된 확장 프로그램 로드(Load unpacked)** → `promptgen-extension/` 선택
4. 툴바 아이콘 클릭(지원 시 자동 오픈) 또는 Side Panel 드롭다운에서 확장 선택

### Edge
1. `edge://extensions` 열기
2. 개발자 모드 ON
3. **Load unpacked** → `promptgen-extension/` 선택
4. Side Panel에서 확장 선택(브라우저 버전에 따라 위치/명칭이 다를 수 있음)

## 개발/검증

- 테스트 실행: `npm test`
- 확장 패키징(zip): `npm run package:ext` → `dist/`에 zip 생성
- CI: GitHub Actions에서 `npm test` 및 패키징을 실행합니다(워크플로: `.github/workflows/ci.yml`).

## 템플릿 스키마(데이터 모델)

이 확장은 “템플릿(Template)” + “필드(Field)” 정의를 기반으로 입력을 검증하고 최종 프롬프트를 조립합니다.

### Template

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | string | 템플릿 고유 ID (저장/선택 키로 사용) |
| `name` | string | 템플릿 표시 이름 |
| `description` | string (optional) | 템플릿 설명(패널에 표시) |
| `master` | string | 마스터 프롬프트 본문(토큰 포함) |
| `fields` | Field[] | 입력 필드 정의 목록 |

### Field (공통)

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | string | 필드 고유 ID (기본 토큰: `{{id}}`) |
| `label` | string | 패널에 표시될 라벨(검증 에러 메시지에도 사용) |
| `kind` | `"text" \| "single" \| "multi"` | 입력 UI 종류 |
| `required` | boolean (optional) | 필수 여부 |
| `help` | string (optional) | 필드 도움말 텍스트 |
| `token` | string (optional) | 기본 토큰(`{{id}}`) 대신 사용할 커스텀 토큰 |

### 렌더링/검증 규칙(요약)

- **필수 검증:** `required: true`인 필드는 비어 있으면 오류로 처리합니다.
- **토큰 치환:** `master` 본문에서 `{{fieldId}}`(또는 `token`)을 찾아 값으로 치환합니다.
- **라인 제거:** `omitLineIfEmpty: true`인 필드가 포함된 라인은, 값이 비어 있으면 “라인 전체”가 제거됩니다.
- **정규화(normalize):** 누락/비정상 값은 `defaultValue`/`allowNone`/옵션 목록/`maxLen` 정책으로 안전하게 보정됩니다.
- **정합성 경고:** 마스터 본문과 필드 정의가 불일치하면 `[정합성]` 경고가 표시됩니다(예: `master`에 정의되지 않은 `{{token}}` 또는 `master`에서 사용되지 않는 필드).

### 옵션 자동 생성(Generate Fields) 문법

Options 페이지에서 `Generate Fields`를 누르면 아래 문법으로 `fields`를 자동 생성합니다.

- **텍스트 토큰:** `{{asset}}` → `text` 필드 생성
- **단일 선택:** `{a|b|c}` 또는 `a / b / c` → `single` 필드 + 버튼 옵션 생성
- **다중 선택:** `{a, b, c}` → `multi` 필드 + 토글 옵션 생성
- **선택 처리:** 라인에 `(optional)`이 있으면 `omitLineIfEmpty` 적용

예시:

```
CATEGORY: {building|nature|animal}
VIEW: {side-view|front-view|top-down}
POSE (optional): {idle|walking|sitting}
ASSET: {{asset}}
```

## 운영 & 트러블슈팅

### 권한(permissions) 설명

- `storage`: 템플릿/선택값/입력값 저장 및 복원
- `sidePanel`: 사이드 패널 UI 표시
- `contextMenus`(선택): 우클릭 메뉴로 선택 텍스트를 ASSET에 주입

### 사이드 패널이 자동으로 열리지 않을 때

- Chrome: `chrome://extensions` → 확장 상세 → **Side panel**(지원 브라우저)에서 열기
- Edge: `edge://extensions`에서 확장 상세/Side Panel 관련 설정 확인(브라우저 버전에 따라 다름)

### 우클릭 “선택 텍스트 → ASSET 주입” 동작 방식

1. 컨텍스트 메뉴 클릭 시 선택 텍스트를 `chrome.storage.local`의 `pg.pendingUpdate`에 저장합니다.
2. 사이드 패널이 열릴 때(또는 다음 초기화 시) `pg.pendingUpdate`를 읽어 ASSET 값에 반영한 뒤 삭제합니다.
3. 패널이 이미 열려 있는 경우 메시지로 즉시 반영도 시도합니다(베스트 에포트).

### 로컬 상태 초기화(Reset)

개발자 도구(사이드 패널 Inspect) 콘솔에서 아래 중 하나를 실행합니다.

- 전체 초기화: `chrome.storage.local.clear()`
- 관련 키만 초기화: `chrome.storage.local.get(null, console.log)`로 키를 확인 후 `pg.*` 관련 키 제거

### FAQ

- **복사가 실패합니다.**
  - 먼저 “미리보기 텍스트 선택”을 눌러 텍스트를 선택한 뒤 `Ctrl/Cmd+C`로 수동 복사를 시도하세요.
  - 회사/브라우저 정책에 의해 클립보드 API가 차단될 수 있습니다.
- **템플릿 경고가 뜹니다.**
  - `[정합성]` 경고는 마스터 본문과 필드 정의의 불일치를 의미합니다. 마스터의 `{{token}}`과 필드(또는 `field.token`)가 1:1로 맞는지 확인하세요.

## 배포/버전업

### 버전 올리기(Version bump)

1. `promptgen-extension/manifest.json`의 `"version"` 값을 올립니다. (예: `0.1.0` → `0.1.1`)
2. 변경 후 테스트: `npm test`
3. 패키징: `npm run package:ext` (`dist/`에 zip 생성)
