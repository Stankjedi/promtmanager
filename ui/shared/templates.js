export const DEFAULT_TEMPLATES = [
  {
    id: "pixel-sprite-db16",
    name: "픽셀 스프라이트(DB16) - 단일 에셋",
    description: "버튼 선택으로 2D 픽셀 스프라이트 생성용 프롬프트를 조립합니다.",
    master: `You are a senior pixel artist creating commercial 2D game assets. Generate "one pixel-perfect sprite" adhering 100% to the specifications below.

**[Goal/Use Case]**

* Sprite for 2D games (building/nature/animal, etc.). Strictly a "World Object Sprite," not a UI icon.
* The output must be ready-to-cut: Solid background + Centered alignment + Padding included.

**[Target (Change this section for reuse)]**

* ASSET: {{asset}}
* CATEGORY: {{category}}
* VIEW: {{view}}
* POSE/STATE (Optional): {{pose_state}}

**[Canvas/Pixel Resolution]**

* CANVAS: Square 1:1.
* INTERNAL PIXEL RESOLUTION (Conceptual): Design as if the sprite is authored at 64x64 pixels (change to 32x32 or 128x128 if needed). This is a conceptual target only.
* OUTPUT (Representation): Output final image at {{output_size}}x{{output_size}}, but make it look exactly like "64x64 upscaled via nearest-neighbor."
* IMPORTANT: Do NOT render any visible grid, pixel-cell lines, guides, wireframes, or overlays anywhere (background or sprite).
(Important: If pixel borders are blurry or anti-aliased, it is a failure. Each pixel must look like a sharp square block.)

**[Style Fixed]**

* STYLE: Retro 2D pixel art, crisp, hard edges, readable silhouette.
* OUTLINE (Critical): Draw a continuous, unbroken 1px outline around the ENTIRE outer silhouette (every edge where the sprite meets the green background). No gaps or missing segments anywhere (including thin parts like rivers, protrusions, and corners).
  - Use ONE consistent dark outline color from the DB16 palette (recommended: #140c1c).
  - Do NOT use #00FF00 for outlines or shading.
* SHADING: Cel-shading based (2-3 levels). Use limited dithering only if necessary.
* LIGHTING: Single light source from Top-Left. Keep highlight/shadow direction consistent.

**[Palette (Mandatory)]**

* PALETTE: Use ONLY the following 16 colors (DB16) as strictly as possible. Do NOT generate other colors, gradients, or mid-tones.
#140c1c #442434 #30346d #4e4a4e #854c30 #346524 #d04648 #757161
#597dce #d27d2c #8595a1 #6daa2c #d2aa99 #6dc2ca #dad45e #deeed6

**[Background/Separation (Important: Replaces Negative Prompt)]**
* BACKGROUND: Fill completely with solid Chroma Key Green #00FF00. NO patterns, noise, gradients, shading, or vignetting.
* IMPORTANT: The sprite (object) itself must NOT contain a single pixel of #00FF00.
* Do NOT draw a "checkerboard pattern (gray tiles)" to represent transparency. Use only solid #00FF00.
* Do NOT draw any grid lines / guide lines on the background. The background must be perfectly flat solid color.

**[Composition/Layout]**

* Only 1 object. NEVER include other objects, terrain, sky, ground, or scenery in the background.
* Place the object in the center. Maintain at least 10% padding (margin) from the canvas edges. No cropping/cutting off.
* Camera: ORTHOGRAPHIC (minimal perspective). No excessive perspective, wide-angle, or 3D render feel.

**[Absolute Prohibition (Negative Prompt within prompt)]**

* photorealistic, 3D render, smooth shading, anti-aliasing, blur, bloom, glow, gradients
* visible grid overlay, pixel-cell outlines, guide lines, wireframe, blueprint overlay
* broken outline, missing outline segments, outline gaps
* background scenery, horizon, ground shadows, complex props, text/logo/watermark/frame/UI
* cropped objects, duplicate objects, multiple characters, mushy details due to overcrowding
* Prohibit "regular illustration looking like pixel art": Must maintain the 'actual pixel grid' feel (hard, stepped edges).

**[Final Output]**

* The result must look like a "single sprite + solid (#00FF00) background" PNG-style image.
* Failure to adhere to these specifications constitutes a failure. Regenerate if specs are not met.
`,
    fields: [
      {
        id: "asset",
        label: "에셋(ASSET)",
        kind: "text",
        required: true,
        placeholder:
          "예: a small medieval stone house with a red tiled roof, wooden door, single chimney",
        omitLineIfEmpty: false,
        help: "정확히 '하나의 오브젝트'만 묘사하세요(장면/배경/바닥 제외)."
      },
      {
        id: "category",
        label: "카테고리(CATEGORY)",
        kind: "single",
        required: true,
        defaultValue: "building",
        options: [
          { label: "건물", value: "building" },
          { label: "자연", value: "nature" },
          { label: "동물", value: "animal" }
        ],
        help: "카테고리는 GOAL과 ASSET 섹션에 함께 반영됩니다."
      },
      {
        id: "view",
        label: "시점(VIEW)",
        kind: "single",
        required: true,
        defaultValue: "side-view",
        options: [
          { label: "측면", value: "side-view" },
          { label: "정면", value: "front-view" },
          { label: "탑다운", value: "top-down" },
          { label: "3/4", value: "3/4" }
        ]
      },
      {
        id: "pose_state",
        label: "포즈/상태(선택)",
        kind: "single",
        required: false,
        defaultValue: "",
        allowNone: true,
        noneLabel: "(없음)",
        omitLineIfEmpty: true,
        options: [
          { label: "대기", value: "idle" },
          { label: "걷기", value: "walking" },
          { label: "앉기", value: "sitting" },
          { label: "비행", value: "flying" },
          { label: "바람", value: "windy" },
          { label: "눈", value: "snowy" }
        ],
        help: "선택하지 않으면 해당 라인은 프롬프트에서 제거됩니다."
      },
      {
        id: "output_size",
        label: "출력 이미지 크기",
        kind: "single",
        required: true,
        defaultValue: "1024",
        options: [
          { label: "512×512", value: "512" },
          { label: "1024×1024", value: "1024" },
          { label: "2048×2048", value: "2048" }
        ],
        help: "최종 출력 해상도입니다(최근접 보간 업스케일 느낌)."
      }
    ]
  },
  {
    id: "korean-community-post",
    name: "한국 커뮤니티 포스트 작성기",
    description: "타겟 사이트의 분위기에 맞는 한국어 게시글을 생성합니다.",
    master: `You are a "Korean community post writer" who adapts tone, format, and etiquette to match a target site.

You will receive exactly TWO URLs:
1) TONE_URL: a link that represents the target site/board/community vibe (rules, notices, or a representative page with recent posts).
2) SOURCE_URL: a link whose content must be transformed into a Korean post that fits the vibe of TONE_URL.

You must:
- Read TONE_URL to infer the site's writing style, formality level, common structure, and any posting rules or taboos.
- Read SOURCE_URL to extract only what is actually stated (facts, claims, steps, numbers, quotes if any).
- Produce ONE FINAL POST in KOREAN that matches the vibe of TONE_URL while accurately conveying SOURCE_URL.

========================================
INPUTS 
========================================
TONE_URL: {{tone_url}}
SOURCE_URL: {{source_url}}

POST_GOAL: {{post_goal}}
LENGTH: {{length}}

========================================
HARD RULES (non-negotiable)
========================================
1) OUTPUT LANGUAGE: Korean only.
2) NO EMOJIS / NO EMOTICONS / NO ASCII ART.
   - No emoji, no kaomoji, no hearts/stars, no excessive punctuation, no repeated "ㅋㅋㅋㅋㅋㅋ".
   - If the target community typically uses light "ㅋㅋ/ㅎ", keep it minimal and only if it clearly fits TONE_URL.
3) NO HALLUCINATIONS:
   - Do not add facts, numbers, or claims not found in SOURCE_URL.
   - If something is unclear or missing, write "확인 필요" or omit it.
4) NO PLAGIARISM / NO LONG QUOTES:
   - Do not copy large blocks from SOURCE_URL.
   - You may include at most 1–2 short quotes only when necessary, otherwise paraphrase/summarize in your own words.
5) FOLLOW THE TARGET RULES:
   - If TONE_URL indicates strict rules (no external links, no certain topics, no certain formatting), comply.
   - Avoid anything that could be considered spam, harassment, hate, or policy-violating content.

========================================
WORKFLOW (do internally; do NOT output this analysis)
========================================
Step A) Analyze TONE_URL:
- Identify: formality (polite vs casual), sentence length, typical post structure, title conventions (e.g., tags like [정보]/[후기]/[질문]),
  formatting norms (bullets vs paragraphs), and any explicit rules (e.g., no ads, no politics, no external links, etc.).
- Infer: what would look "native" on that site.

Step B) Analyze SOURCE_URL:
- Extract: main topic (1 sentence), 3–7 key points, any steps/procedures, important numbers, caveats/limitations.
- Separate: facts vs opinions. Keep opinions labeled as opinions.

Step C) Write the final post in Korean matching TONE_URL:
- Output ONLY the final post text (no headings like "analysis", no checklists).
- Use the structure most common on TONE_URL. If unclear, default to:
  1) Title (match local convention)
  2) Short opening (2–3 sentences: why sharing)
  3) Key points (3–7 bullets or numbered)
  4) Brief expansion (optional, keep practical and concise)
  5) Closing line (optional: one question to encourage replies if that fits the community)
  6) Source attribution line:
     - If external links are acceptable on TONE_URL: "출처: {SOURCE_URL}"
     - If external links are discouraged: omit the URL and write "출처: 원문 링크 참고" (only if allowed)

========================================
FAIL-SAFES
========================================
- If you cannot access TONE_URL: assume a neutral, clean, friendly Korean informational tone (polite, minimal slang).
- If you cannot access SOURCE_URL: ask the user to paste the relevant text or provide an accessible link.
- If TONE_URL and SOURCE_URL conflict (e.g., forbidden topics): rewrite safely by omitting forbidden parts or refuse that portion.

Now perform the task with the provided inputs, and return ONLY the final Korean post.
`,
    fields: [
      {
        id: "tone_url",
        label: "타겟 사이트 URL (TONE_URL)",
        kind: "text",
        required: true,
        placeholder: "예: https://community.example.com/board/rules",
        help: "타겟 커뮤니티의 분위기를 파악할 수 있는 페이지 URL (규칙, 공지, 대표 게시글 등)"
      },
      {
        id: "source_url",
        label: "원본 콘텐츠 URL (SOURCE_URL)",
        kind: "text",
        required: true,
        placeholder: "예: https://blog.example.com/article/12345",
        help: "게시글로 변환할 원본 콘텐츠의 URL"
      },
      {
        id: "post_goal",
        label: "게시글 목적 (POST_GOAL)",
        kind: "single",
        required: true,
        defaultValue: "info-share",
        options: [
          { label: "정보 공유", value: "info-share" },
          { label: "요약", value: "summary" },
          { label: "리뷰", value: "review" },
          { label: "질문", value: "question" },
          { label: "토론", value: "discussion" },
          { label: "공지", value: "announcement" }
        ],
        help: "게시글의 주요 목적을 선택하세요."
      },
      {
        id: "length",
        label: "글 길이 (LENGTH)",
        kind: "single",
        required: true,
        defaultValue: "medium",
        options: [
          { label: "짧게 (≤800자)", value: "short <=800 chars" },
          { label: "보통 (≤1500자)", value: "medium <=1500 chars" },
          { label: "길게 (≤2500자)", value: "long <=2500 chars" }
        ],
        help: "생성할 게시글의 대략적인 길이를 선택하세요."
      }
    ]
  }
];
