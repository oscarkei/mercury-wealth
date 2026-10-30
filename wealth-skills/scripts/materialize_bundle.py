#!/usr/bin/env python3
"""Restore a reviewed Mercury source bundle into a new/empty local directory."""
import hashlib
import json
import sys
from pathlib import Path, PurePosixPath


def materialize(bundle_path, destination):
    bundle = json.loads(bundle_path.read_text(encoding="utf-8"))
    if bundle.get("bundle_format") != "mercury-text-source-bundle/1":
        raise ValueError("Unsupported bundle format")
    if destination.is_symlink():
        raise ValueError("Destination cannot be a symlink")
    if destination.exists() and (not destination.is_dir() or any(destination.iterdir())):
        raise ValueError("Destination must be new or empty")
    files = bundle.get("files")
    if not isinstance(files, list) or not files:
        raise ValueError("Bundle has no files")
    prepared = []
    seen = set()
    for item in files:
        raw = item["path"]
        if not isinstance(raw, str) or not raw or "\\" in raw:
            raise ValueError("Invalid relative file path")
        path = PurePosixPath(raw)
        if path.is_absolute() or any(part in (".", "..") for part in raw.split("/")) or path.as_posix() != raw:
            raise ValueError("Unsafe relative file path")
        if raw in seen:
            raise ValueError("Duplicate file path")
        seen.add(raw)
        if item.get("encoding") != "utf-8" or not isinstance(item.get("content"), str):
            raise ValueError("Only UTF-8 text files are supported")
        data = item["content"].encode("utf-8")
        if hashlib.sha256(data).hexdigest() != item["sha256"]:
            raise ValueError("Content digest mismatch: " + raw)
        prepared.append((raw, data))
    # Validate every input before writing; this performs no network or app calls.
    destination.mkdir(parents=True, exist_ok=True)
    for raw, data in prepared:
        target = destination.joinpath(*PurePosixPath(raw).parts)
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open("xb") as handle:
            handle.write(data)
    return len(prepared)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("Usage: materialize_bundle.py BUNDLE.json NEW_OR_EMPTY_DIRECTORY")
    count = materialize(Path(sys.argv[1]), Path(sys.argv[2]))
    print(json.dumps({"status": "materialized", "files": count}))
