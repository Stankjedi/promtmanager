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
  }
];
