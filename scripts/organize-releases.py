#!/usr/bin/env python3
"""
Organizes all compiled Windows and Linux release artifacts for My Music.
Prepares clean distribution folders for:
  - dist/1.1.7/ (Windows + Linux release assets)
  - dist/1.1.8/ (Windows + Linux release assets)
Generates SHA256SUMS.txt for each release folder.
"""

import os
import sys
import shutil
import hashlib
from pathlib import Path

ROOT_DIR = Path(r"C:\Users\induw\OneDrive\Documents\programs\personal\mymusic")
DIST_DIR = ROOT_DIR / "dist"
SCRIPTS_DIR = ROOT_DIR / "scripts"

sys.path.insert(0, str(SCRIPTS_DIR))
import importlib.util
spec = importlib.util.spec_from_file_location("pack_linux", str(SCRIPTS_DIR / "pack-linux.py"))
pack_linux = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pack_linux)


def compute_sha256(filepath: Path) -> str:
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def generate_checksum_file(folder: Path):
    checksum_lines = []
    for item in sorted(folder.iterdir()):
        if item.is_file() and item.name != "SHA256SUMS.txt":
            sha = compute_sha256(item)
            checksum_lines.append(f"{sha}  {item.name}")
    (folder / "SHA256SUMS.txt").write_text("\n".join(checksum_lines) + "\n", encoding="utf-8")
    print(f"  Generated SHA256SUMS.txt in {folder.name}")


def organize_118():
    print("\n==> Organizing 1.1.8 Release Assets...")
    out_dir = DIST_DIR / "1.1.8"
    out_dir.mkdir(parents=True, exist_ok=True)

    files_to_copy = [
        "My.Music.Setup.1.1.8.exe",
        "My.Music.Portable.1.1.8.exe",
        "My Music-1.1.8-win.zip",
        "My.Music.1.1.8.deb",
        "My.Music.1.1.8.tar.gz",
        "latest.yml",
    ]

    for fname in files_to_copy:
        src = DIST_DIR / fname
        if src.exists():
            shutil.copy2(src, out_dir / fname)
            print(f"  Copied {fname} -> dist/1.1.8/")
        else:
            print(f"  [WARN] Source file missing: {src}")

    # Copy install.sh
    install_sh = SCRIPTS_DIR / "install.sh"
    if install_sh.exists():
        shutil.copy2(install_sh, out_dir / "install.sh")
        print("  Copied install.sh -> dist/1.1.8/")

    # Copy arch directory
    arch_src = DIST_DIR / "arch"
    arch_dest = out_dir / "arch"
    if arch_src.exists():
        if arch_dest.exists():
            shutil.rmtree(arch_dest)
        shutil.copytree(arch_src, arch_dest)
        print("  Copied arch/ packaging specs -> dist/1.1.8/arch/")

    generate_checksum_file(out_dir)


def organize_117():
    print("\n==> Organizing 1.1.7 Release Assets (Adding Linux Packages)...")
    out_dir = DIST_DIR / "1.1.7"
    out_dir.mkdir(parents=True, exist_ok=True)

    # 1. Build 1.1.7 Linux packages if not yet generated
    deb_117 = out_dir / "My.Music.1.1.7.deb"
    tar_117 = out_dir / "My.Music.1.1.7.tar.gz"

    orig_version = pack_linux.VERSION
    try:
        pack_linux.VERSION = "1.1.7"
        if not tar_117.exists():
            print("  Building My.Music.1.1.7.tar.gz...")
            pack_linux.create_universal_tarball(tar_117)
        if not deb_117.exists():
            print("  Building My.Music.1.1.7.deb...")
            pack_linux.create_deb_package(deb_117)
            pack_linux.verify_deb(deb_117)
    finally:
        pack_linux.VERSION = orig_version

    # Copy install.sh
    install_sh = SCRIPTS_DIR / "install.sh"
    if install_sh.exists():
        shutil.copy2(install_sh, out_dir / "install.sh")
        print("  Copied install.sh -> dist/1.1.7/")

    # Create arch directory for 1.1.7
    arch_dest = out_dir / "arch"
    arch_dest.mkdir(parents=True, exist_ok=True)
    orig_version = pack_linux.VERSION
    try:
        pack_linux.VERSION = "1.1.7"
        (arch_dest / "PKGBUILD").write_text(pack_linux.ARCH_PKGBUILD, encoding="utf-8")
        (arch_dest / ".SRCINFO").write_text(pack_linux.ARCH_SRCINFO, encoding="utf-8")
        (arch_dest / "mymusic.desktop").write_text(pack_linux.DESKTOP_ENTRY, encoding="utf-8")
        (arch_dest / "README.md").write_text(pack_linux.ARCH_README, encoding="utf-8")
        shutil.copy2(pack_linux.ICON_SRC, arch_dest / "mymusic.png")
        print("  Created arch/ packaging specs -> dist/1.1.7/arch/")
    finally:
        pack_linux.VERSION = orig_version

    generate_checksum_file(out_dir)


def print_summary():
    print("\n" + "=" * 70)
    print("RELEASE PACKAGES SUMMARY")
    print("=" * 70)
    for ver in ["1.1.7", "1.1.8"]:
        folder = DIST_DIR / ver
        if not folder.exists():
            continue
        print(f"\n[{ver}] {folder}:")
        for item in sorted(folder.iterdir()):
            if item.is_file():
                size_mb = item.stat().st_size / (1024 * 1024)
                print(f"  - {item.name:<32} ({size_mb:>6.2f} MB)")
            elif item.is_dir():
                print(f"  - {item.name}/ ({len(list(item.iterdir()))} items)")
    print("=" * 70)


def main():
    organize_117()
    organize_118()
    print_summary()


if __name__ == "__main__":
    main()
