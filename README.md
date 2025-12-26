<p align="center">
  <img
    src="ui/icons/icon128.png"
    width="96"
    height="96"
    alt="프롬프트 생성기 아이콘"
  />
</p>

<p align="center">
  <a href="https://ctee.kr/place/stankjedi">
    <img src="https://img.shields.io/badge/☕-후원하기-orange?style=for-the-badge" alt="후원하기" />
  </a>
</p>

# promtmanager — 프롬프트 생성기 (데스크탑 오버레이)

이 프로젝트는 템플릿 기반으로 프롬프트를 조립하고 빠르게 복사할 수 있는 데스크탑 오버레이 애플리케이션입니다. Rust와 Tauri를 기반으로 제작되었습니다.

## 주요 기능 (데스크탑 오버레이)

- **항상 위(always-on-top) 오버레이**: 다른 창 위에서 상시 대기하며 빠르게 프롬프트 조립
- **전역 단축키**
  - `Ctrl+Shift+O`: 오버레이 창 토글 (보이기/숨기기)
  - `Ctrl+Shift+V`: 클립보드 텍스트를 `ASSET` 필드에 주입하고 창 표시
- **시스템 트레이**: 트레이 아이콘을 통해 창 제어 및 템플릿 관리 페이지 접근
- **템플릿 관리**: 템플릿 생성, 복제, 삭제 및 가져오기/내보내기 기능 제공
- **반응형 레이아웃**: 드래그 가능한 리사이저로 옵션 영역과 미리보기 영역 크기 자유 조절

## 실행 및 빌드

### 필수 요구사항
- [Rust](https://www.rust-lang.org/tools/install) (cargo)
- Node.js (npm/npx)

### 개발 실행
```bash
npm run dev:desktop
```

### 윈도우 빌드 (EXE/MSI)
```bash
npm run build:desktop
```

빌드 결과물은 `src-tauri/target/release/bundle/` 경로에 생성됩니다.

## 주요 UX 가이드

1. **오버레이 사용**: 작업 중 `Ctrl+Shift+O`를 눌러 앱을 띄우고 프롬프트를 조립한 뒤 복사하여 즉시 활용하세요.
2. **클립보드 연동**: 유용한 텍스트를 복사한 상태에서 `Ctrl+Shift+V`를 누르면 해당 내용이 `ASSET` 필드에 자동으로 입력됩니다.
3. **템플릿 운영**: 트레이 메뉴나 앱 상단의 관리 버튼을 통해 템플릿을 추가/수정할 수 있습니다. `Generate Fields` 기능을 사용하면 마스터 프롬프트에서 필드를 자동으로 추출합니다.

## 개발 정보

- **기술 스택**: Rust (Tauri), JavaScript (Vanilla), CSS
- **저장 방식**: WebView `localStorage`를 사용하여 템플릿과 설정값을 저장합니다.
- **테스트**: `npm test`를 통해 프롬프트 조립 및 검증 로직을 테스트할 수 있습니다.
