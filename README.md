# promtmanager

`promptgen-extension/` 폴더에 Manifest V3 + Side Panel 기반 크롬 확장(MVP)을 포함합니다.

## 기능(MVP)

- CATEGORY / VIEW / POSE 옵션을 버튼 UI로 선택
- ASSET 입력 → 최종 프롬프트 즉시 조립(미리보기)
- 버튼 1번(또는 Ctrl+Enter)으로 클립보드 복사
- 선택값 저장/복원(`chrome.storage.local`)
- (선택) 우클릭 메뉴: 선택 텍스트를 ASSET에 주입 + 패널 오픈

## 실행(압축해제 로드)

1. Chrome에서 `chrome://extensions` 열기
2. 개발자 모드 ON
3. 압축해제된 확장 프로그램 로드(Load unpacked) → `promptgen-extension/` 선택
4. 툴바 아이콘 클릭(지원 시 자동 오픈) 또는 Side Panel 드롭다운에서 확장 선택

## 개발/검증

- 테스트 실행: `npm test`
- 확장 패키징(zip): `npm run package:ext` → `dist/`에 zip 생성

## 템플릿 스키마(데이터 모델)

이 확장은 “템플릿(Template)” + “필드(Field)” 정의를 기반으로, 사용자 입력을 검증하고 최종 프롬프트를 조립합니다.

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

### Field: `text`

| 필드 | 타입 | 설명 |
|---|---|---|
| `placeholder` | string (optional) | 입력 힌트 |
| `maxLen` | number (optional) | 입력 문자열 최대 길이 |
| `omitLineIfEmpty` | boolean (optional) | 값이 비어 있으면 해당 토큰이 포함된 “라인 전체”를 제거 |

### Field: `single`

| 필드 | 타입 | 설명 |
|---|---|---|
| `options` | `{ label: string, value: string }[]` (optional) | 버튼 옵션 목록 |
| `defaultValue` | string (optional) | 기본 선택값 |
| `allowNone` | boolean (optional) | “(none)” 버튼을 허용할지 여부 |
| `noneLabel` | string (optional) | “(none)” 버튼 라벨 |
| `omitLineIfEmpty` | boolean (optional) | 값이 비어 있으면 해당 토큰이 포함된 “라인 전체”를 제거 |

### Field: `multi`

| 필드 | 타입 | 설명 |
|---|---|---|
| `options` | `{ label: string, value: string }[]` (optional) | 다중 선택 옵션 목록 |
| `minSelected` | number (optional) | `required`인 경우 최소 선택 개수(기본 1) |
| `joiner` | string (optional) | 다중 선택값 결합 구분자(기본 `", "`) |

### 렌더링/검증 규칙

- **필수 검증:** `required: true`인 필드는 비어 있으면 오류로 처리합니다.
- **토큰 치환:** `master` 본문에서 `{{fieldId}}`(또는 `token`)을 찾아 값으로 치환합니다.
- **라인 제거:** `omitLineIfEmpty: true`인 필드가 포함된 라인은, 해당 필드 값이 비어 있으면 “라인 전체”가 제거됩니다.
- **정규화(normalize):** 누락된 값은 `defaultValue`/`allowNone`/옵션 목록에 따라 안전한 기본값으로 보정됩니다.

### 옵션 자동 생성(Generate Fields) 문법

Options 페이지에서 `Generate Fields` 버튼을 누르면, 아래 문법을 기반으로 `fields`를 자동 생성합니다.

- **텍스트 입력:** `{{asset}}` 처럼 `{{token}}`을 쓰면 `text` 필드가 생성됩니다.
- **단일 선택 옵션:** `{a|b|c}` (또는 `a / b / c` 형태) → `single` 필드 + 버튼 옵션 생성
- **다중 선택 옵션:** `{a, b, c}` → `multi` 필드 + 토글 옵션 생성
- **선택(옵션) 처리:** 라인에 `(optional)`이 있으면 기본값이 비어 있을 때 라인이 제거되도록 `omitLineIfEmpty`가 적용됩니다.

예시:

```
CATEGORY: {building|nature|animal}
VIEW: {side-view|front-view|top-down}
POSE (optional): {idle|walking|sitting}
ASSET: {{asset}}
```

## 운영 & 트러블슈팅

### 권한(permissions) 설명

- `storage`: 템플릿/선택값/입력값 저장 및 복원에 사용합니다.
- `sidePanel`: 사이드 패널 UI를 표시하는 데 사용합니다.
- `contextMenus`(선택): 우클릭 메뉴로 선택 텍스트를 ASSET에 주입하는 기능에 사용합니다.

### 사이드 패널이 자동으로 열리지 않을 때

- `chrome://extensions` → 확장 프로그램 상세 → **Side panel**(지원 브라우저)에서 열기
- 또는 툴바 아이콘 클릭 후, 브라우저의 Side Panel 드롭다운에서 확장을 선택합니다.

### 우클릭 “선택 텍스트 → ASSET 주입” 동작 방식

1. 컨텍스트 메뉴 클릭 시 선택 텍스트를 `chrome.storage.local`의 `pg.pendingUpdate`에 저장합니다.
2. 사이드 패널이 열릴 때(또는 다음 초기화 시) `pg.pendingUpdate`를 읽어 ASSET 값에 반영한 뒤 삭제합니다.
3. 패널이 이미 열려 있는 경우에는 메시지로 즉시 반영도 시도합니다(베스트 에포트).

### 로컬 상태 초기화(Reset)

개발자 도구(사이드 패널 Inspect) 콘솔에서 아래 중 하나를 실행합니다.

- 전체 초기화: `chrome.storage.local.clear()`
- 프롬프트 제너레이터 키만 초기화: `chrome.storage.local.get(null, console.log)`로 키를 확인 후 `pg.*` 관련 키를 제거

### FAQ

- **복사가 실패합니다.**
  - 먼저 “Select Preview Text” 버튼으로 텍스트를 선택한 뒤 `Ctrl/Cmd+C`로 수동 복사를 시도하세요.
  - 회사/브라우저 정책에 의해 클립보드 API가 차단될 수 있습니다.
- **패널이 안 보이거나 메뉴가 없습니다.**
  - 브라우저가 Side Panel을 지원하는지 확인하고, `chrome://extensions`에서 확장이 활성화되어 있는지 확인하세요.
- **템플릿이 목록에 안 뜹니다.**
  - `pg.customTemplates` 데이터가 손상된 경우 일부 템플릿이 무시될 수 있습니다(패널 내 경고 표시).

## 버전업 & 설치(배포)

### 버전 올리기(Version bump)

1. `promptgen-extension/manifest.json`의 `"version"` 값을 올립니다. (예: `0.1.0` → `0.1.1`)
2. 변경 후 테스트를 실행합니다: `npm test`

### 패키지(zip) 빌드

- `npm run package:ext`
  - 결과물: `dist/promptgen-extension-v<version>.zip`

### 설치 방법

#### 방법 A) 개발자 모드(권장, 로컬 설치)

1. `chrome://extensions` 열기
2. 개발자 모드 ON
3. **압축해제된 확장 프로그램 로드(Load unpacked)** → `promptgen-extension/` 선택

#### 방법 B) zip으로 전달/보관

1. `npm run package:ext`로 zip 생성
2. zip을 압축 해제
3. `chrome://extensions` → 개발자 모드 ON → **Load unpacked** → 압축 해제된 `promptgen-extension/` 폴더 선택  
   (Chrome은 zip 자체를 “직접 설치”하는 방식이 기본 제공되지 않으므로, 로컬 설치는 “압축 해제 + Load unpacked”가 가장 간단합니다.)

#### 방법 C) (고급) Pack extension / 배포

- `chrome://extensions`에서 “Pack extension”으로 `.crx`를 만들 수 있습니다.  
  다만 일반 사용자 환경에서는 정책/스토어 제한으로 `.crx` 설치가 막힐 수 있어, **로컬 개발/테스트는 방법 A가 안정적**입니다.
