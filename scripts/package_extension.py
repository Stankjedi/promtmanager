#!/usr/bin/env python3

from __future__ import annotations

import json
import zipfile
from pathlib import Path


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    ext_dir = root / "promptgen-extension"
    manifest_path = ext_dir / "manifest.json"

    if not ext_dir.exists():
        raise SystemExit(f"Extension directory not found: {ext_dir}")
    if not manifest_path.exists():
        raise SystemExit(f"Manifest not found: {manifest_path}")

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    version = str(manifest.get("version") or "0.0.0").strip() or "0.0.0"

    dist_dir = root / "dist"
    dist_dir.mkdir(parents=True, exist_ok=True)

    out_zip = dist_dir / f"promptgen-extension-v{version}.zip"
    if out_zip.exists():
        out_zip.unlink()

    ignore_names = {".DS_Store", "Thumbs.db"}

    with zipfile.ZipFile(out_zip, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for p in ext_dir.rglob("*"):
            if p.is_dir():
                continue
            if p.name in ignore_names:
                continue
            arcname = p.relative_to(root).as_posix()
            zf.write(p, arcname)

    print(out_zip.as_posix())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

