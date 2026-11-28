#!/usr/bin/env python3
"""
Linux packager for My Music.
Generates:
  1. dist/My.Music.1.1.8.tar.gz (Universal portable bundle for Arch, Fedora, Debian, Ubuntu with 1-click desktop installer)
  2. dist/My.Music.1.1.8.deb (Native Debian/Ubuntu package in valid standard ar format)
  3. dist/arch/PKGBUILD, .SRCINFO, mymusic.desktop (Arch Linux native pacman build files)
"""

import os
import sys
import io
import time
import gzip
import tarfile
import hashlib
import shutil
from pathlib import Path

ROOT_DIR = Path(r"C:\Users\induw\OneDrive\Documents\programs\personal\mymusic")
DIST_DIR = ROOT_DIR / "dist"
UNPACKED_DIR = DIST_DIR / "linux-unpacked"
ICON_SRC = ROOT_DIR / "build" / "icon.png"
VERSION = "1.1.9"
PKG_NAME = "mymusic"
ARCH = "amd64"

DESKTOP_ENTRY = f"""[Desktop Entry]
Name=My Music
Comment=Modern, lightweight local music player
Exec=/opt/mymusic/mymusic %U
Icon=mymusic
Terminal=false
Type=Application
StartupNotify=true
Categories=AudioVideo;Audio;Player;Music;
MimeType=audio/mpeg;audio/flac;audio/ogg;audio/wav;audio/x-wav;audio/aac;audio/mp4;audio/x-m4a;audio/webm;
StartupWMClass=mymusic
"""

PORTABLE_LAUNCHER = """#!/usr/bin/env bash
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Ensure executables have permission
chmod +x "${SCRIPT_DIR}/mymusic" 2>/dev/null || true
chmod +x "${SCRIPT_DIR}/chrome-sandbox" 2>/dev/null || true
chmod +x "${SCRIPT_DIR}/chrome_crashpad_handler" 2>/dev/null || true
chmod +x "${SCRIPT_DIR}/resources/bin/yt-dlp" 2>/dev/null || true

exec "${SCRIPT_DIR}/mymusic" "$@"
"""

INSTALL_DESKTOP_SCRIPT = """#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${SCRIPT_DIR}"
EXECUTABLE="${APP_DIR}/mymusic"
ICON_SRC="${APP_DIR}/mymusic.png"

echo "==> Installing My Music desktop launcher..."

chmod +x "${EXECUTABLE}" 2>/dev/null || true
chmod +x "${APP_DIR}/My-Music.sh" 2>/dev/null || true
chmod +x "${APP_DIR}/chrome-sandbox" 2>/dev/null || true
chmod +x "${APP_DIR}/chrome_crashpad_handler" 2>/dev/null || true
chmod +x "${APP_DIR}/resources/bin/yt-dlp" 2>/dev/null || true

DESKTOP_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
ICON_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/icons/hicolor/512x512/apps"

mkdir -p "${DESKTOP_DIR}"
mkdir -p "${ICON_DIR}"

if [ -f "${ICON_SRC}" ]; then
  cp -f "${ICON_SRC}" "${ICON_DIR}/mymusic.png"
fi

DESKTOP_FILE="${DESKTOP_DIR}/mymusic.desktop"
cat <<EOF > "${DESKTOP_FILE}"
[Desktop Entry]
Name=My Music
Comment=Modern, lightweight local music player
Exec="${EXECUTABLE}" %U
Icon=mymusic
Terminal=false
Type=Application
StartupNotify=true
Categories=AudioVideo;Audio;Player;Music;
MimeType=audio/mpeg;audio/flac;audio/ogg;audio/wav;audio/x-wav;audio/aac;audio/mp4;audio/x-m4a;audio/webm;
StartupWMClass=mymusic
EOF

chmod +x "${DESKTOP_FILE}" 2>/dev/null || true

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "${DESKTOP_DIR}" 2>/dev/null || true
fi

if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  gtk-update-icon-cache -q -t -f "${XDG_DATA_HOME:-$HOME/.local/share}/icons/hicolor" 2>/dev/null || true
fi

echo "==> Installation complete! My Music is ready to run from your application menu."
echo "    Executable location: ${EXECUTABLE}"
"""

UNINSTALL_DESKTOP_SCRIPT = """#!/usr/bin/env bash
DESKTOP_FILE="${XDG_DATA_HOME:-$HOME/.local/share}/applications/mymusic.desktop"
ICON_FILE="${XDG_DATA_HOME:-$HOME/.local/share}/icons/hicolor/512x512/apps/mymusic.png"

echo "==> Removing My Music desktop launcher..."
rm -f "${DESKTOP_FILE}"
rm -f "${ICON_FILE}"

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "${XDG_DATA_HOME:-$HOME/.local/share}/applications" 2>/dev/null || true
fi

echo "==> Desktop integration removed."
"""

ARCH_PKGBUILD = f"""# Maintainer: Induwara Hansajith <induwarahansajith10@gmail.com>
pkgname=mymusic-bin
pkgver={VERSION}
pkgrel=1
pkgdesc="Modern, lightweight local music player with YouTube streaming and offline caching"
arch=('x86_64')
url="https://github.com/Induwara-Hansajith/mymusic"
license=('MIT')
depends=('alsa-lib' 'gtk3' 'nss' 'libxss' 'libnotify' 'libxtst' 'mesa')
optdepends=(
    'ffmpeg: external media decoding fallback'
)
provides=('mymusic')
conflicts=('mymusic')
source=("My.Music.{VERSION}.tar.gz" "mymusic.desktop")
sha256sums=('SKIP' 'SKIP')

package() {{
    install -d "${{pkgdir}}/opt/mymusic"
    cp -a "${{srcdir}}/My.Music.{VERSION}/." "${{pkgdir}}/opt/mymusic/"
    chmod 755 "${{pkgdir}}/opt/mymusic/mymusic"
    chmod 755 "${{pkgdir}}/opt/mymusic/chrome-sandbox" 2>/dev/null || true
    chmod 755 "${{pkgdir}}/opt/mymusic/resources/bin/yt-dlp"

    install -d "${{pkgdir}}/usr/bin"
    ln -s "/opt/mymusic/mymusic" "${{pkgdir}}/usr/bin/mymusic"

    install -Dm644 "${{srcdir}}/mymusic.desktop" "${{pkgdir}}/usr/share/applications/mymusic.desktop"
    install -Dm644 "${{pkgdir}}/opt/mymusic/mymusic.png" "${{pkgdir}}/usr/share/icons/hicolor/512x512/apps/mymusic.png"
}}
"""

ARCH_SRCINFO = f"""pkgbase = mymusic-bin
	pkgdesc = Modern, lightweight local music player with YouTube streaming and offline caching
	pkgver = {VERSION}
	pkgrel = 1
	url = https://github.com/Induwara-Hansajith/mymusic
	arch = x86_64
	license = MIT
	depends = alsa-lib
	depends = gtk3
	depends = nss
	depends = libxss
	depends = libnotify
	depends = libxtst
	depends = mesa
	optdepends = ffmpeg: external media decoding fallback
	provides = mymusic
	conflicts = mymusic
	source = My.Music.{VERSION}.tar.gz
	source = mymusic.desktop
	sha256sums = SKIP
	sha256sums = SKIP

pkgname = mymusic-bin
"""

ARCH_README = f"""# Arch Linux / Manjaro Installation Guide for My Music v{VERSION}

### Option 1: 1-Line Universal Installer (Recommended)
Run in terminal (no root required, auto-updates):
```bash
curl -fsSL https://raw.githubusercontent.com/Induwara-Hansajith/mymusic/main/scripts/install.sh | bash
```

### Option 2: Native Pacman Package
1. Ensure `base-devel` is installed:
   ```bash
   sudo pacman -S --needed base-devel
   ```
2. Copy `My.Music.{VERSION}.tar.gz` from `dist/` into this directory:
   ```bash
   cp ../My.Music.{VERSION}.tar.gz .
   ```
3. Build and install via `makepkg`:
   ```bash
   makepkg -si
   ```
4. Launch My Music:
   ```bash
   mymusic
   ```

### Option 3: Standalone Portable Run
Extract `My.Music.{VERSION}.tar.gz` anywhere and run:
```bash
./install.sh           # Installs desktop launcher and CLI command
./My-Music.sh          # Or run directly without installation
```
"""


def is_executable(path_str: str) -> bool:
    posix_path = path_str.replace("\\", "/").lower()
    exec_names = ["mymusic", "chrome-sandbox", "chrome_crashpad_handler", "yt-dlp"]
    base = os.path.basename(posix_path)
    if base in exec_names:
        return True
    if base.endswith(".sh") or base.endswith(".so") or ".so." in base:
        return True
    return False


def build_ar_header(name: str, size: int, mode: int = 0o100644, mtime: int = 0, uid: int = 0, gid: int = 0) -> bytes:
    """Builds standard 60-byte Unix ar archive header."""
    oct_mode = oct(mode)[2:]
    header_str = f"{name:<16}{mtime:<12}{uid:<6}{gid:<6}{oct_mode:<8}{size:<10}`\n"
    header_bytes = header_str.encode("ascii")
    if len(header_bytes) != 60:
        raise ValueError(f"Header length must be 60 bytes, got {len(header_bytes)} for {name}")
    return header_bytes


def create_deb_package(out_deb_path: Path):
    print("==> Building native Debian package (.deb)...")
    
    # 1. Compute installed size of unpacked dir
    total_bytes = 0
    for root, _, files in os.walk(UNPACKED_DIR):
        for f in files:
            total_bytes += os.path.getsize(os.path.join(root, f))
    total_bytes += ICON_SRC.stat().st_size
    installed_size_kb = (total_bytes + 1023) // 1024

    # 2. Build control.tar.gz
    control_content = f"""Package: {PKG_NAME}
Version: {VERSION}
Section: sound
Priority: optional
Architecture: {ARCH}
Maintainer: Induwara Hansajith <induwarahansajith10@gmail.com>
Installed-Size: {installed_size_kb}
Depends: libasound2, libnss3, libgbm1, libnotify4, xdg-utils
Homepage: https://github.com/Induwara-Hansajith/mymusic
Description: Modern, lightweight local music player
 My Music is an Electron-based desktop music player with YouTube streaming,
 offline caching, playlist management, and responsive audio playback.
""".replace("\r\n", "\n").encode("utf-8")

    postinst_content = """#!/bin/sh
set -e
if [ "$1" = "configure" ]; then
    which update-desktop-database >/dev/null 2>&1 && update-desktop-database -q || true
    which gtk-update-icon-cache >/dev/null 2>&1 && gtk-update-icon-cache -q -t -f /usr/share/icons/hicolor || true
fi
""".replace("\r\n", "\n").encode("utf-8")

    postrm_content = """#!/bin/sh
set -e
if [ "$1" = "remove" ] || [ "$1" = "purge" ]; then
    which update-desktop-database >/dev/null 2>&1 && update-desktop-database -q || true
    which gtk-update-icon-cache >/dev/null 2>&1 && gtk-update-icon-cache -q -t -f /usr/share/icons/hicolor || true
fi
""".replace("\r\n", "\n").encode("utf-8")

    control_buf = io.BytesIO()
    with tarfile.open(fileobj=control_buf, mode="w:gz", format=tarfile.PAX_FORMAT) as tar:
        # Directory ./
        ti = tarfile.TarInfo("./")
        ti.type = tarfile.DIRTYPE
        ti.mode = 0o755
        ti.mtime = 0
        tar.addfile(ti)

        # control
        ti = tarfile.TarInfo("./control")
        ti.size = len(control_content)
        ti.mode = 0o644
        ti.mtime = 0
        tar.addfile(ti, io.BytesIO(control_content))

        # postinst
        ti = tarfile.TarInfo("./postinst")
        ti.size = len(postinst_content)
        ti.mode = 0o755
        ti.mtime = 0
        tar.addfile(ti, io.BytesIO(postinst_content))

        # postrm
        ti = tarfile.TarInfo("./postrm")
        ti.size = len(postrm_content)
        ti.mode = 0o755
        ti.mtime = 0
        tar.addfile(ti, io.BytesIO(postrm_content))

    control_tar_gz = control_buf.getvalue()

    # 3. Build data.tar.gz
    data_buf = io.BytesIO()
    with tarfile.open(fileobj=data_buf, mode="w:gz", format=tarfile.PAX_FORMAT) as tar:
        # Add standard directories
        dirs = [
            "./",
            "./opt/",
            "./opt/mymusic/",
            "./usr/",
            "./usr/bin/",
            "./usr/share/",
            "./usr/share/applications/",
            "./usr/share/icons/",
            "./usr/share/icons/hicolor/",
            "./usr/share/icons/hicolor/512x512/",
            "./usr/share/icons/hicolor/512x512/apps/",
        ]
        for d in dirs:
            ti = tarfile.TarInfo(d)
            ti.type = tarfile.DIRTYPE
            ti.mode = 0o755
            ti.mtime = 0
            tar.addfile(ti)

        # Add unpacked files to /opt/mymusic
        for root, dnames, fnames in os.walk(UNPACKED_DIR):
            for d in dnames:
                rel = os.path.relpath(os.path.join(root, d), UNPACKED_DIR).replace("\\", "/")
                ti = tarfile.TarInfo(f"./opt/mymusic/{rel}/")
                ti.type = tarfile.DIRTYPE
                ti.mode = 0o755
                ti.mtime = 0
                tar.addfile(ti)

            for f in fnames:
                full_path = Path(root) / f
                rel = os.path.relpath(full_path, UNPACKED_DIR).replace("\\", "/")
                target_path = f"./opt/mymusic/{rel}"
                with open(full_path, "rb") as fh:
                    file_bytes = fh.read()
                ti = tarfile.TarInfo(target_path)
                ti.size = len(file_bytes)
                ti.mtime = 0
                ti.mode = 0o755 if is_executable(rel) else 0o644
                tar.addfile(ti, io.BytesIO(file_bytes))

        # Add icon to /opt/mymusic/mymusic.png
        icon_bytes = ICON_SRC.read_bytes()
        ti = tarfile.TarInfo("./opt/mymusic/mymusic.png")
        ti.size = len(icon_bytes)
        ti.mode = 0o644
        ti.mtime = 0
        tar.addfile(ti, io.BytesIO(icon_bytes))

        # Add icon to /usr/share/icons/hicolor/512x512/apps/mymusic.png
        ti = tarfile.TarInfo("./usr/share/icons/hicolor/512x512/apps/mymusic.png")
        ti.size = len(icon_bytes)
        ti.mode = 0o644
        ti.mtime = 0
        tar.addfile(ti, io.BytesIO(icon_bytes))

        # Add desktop file to /usr/share/applications/mymusic.desktop
        desktop_bytes = DESKTOP_ENTRY.replace("\r\n", "\n").encode("utf-8")
        ti = tarfile.TarInfo("./usr/share/applications/mymusic.desktop")
        ti.size = len(desktop_bytes)
        ti.mode = 0o644
        ti.mtime = 0
        tar.addfile(ti, io.BytesIO(desktop_bytes))

        # Add version.txt and update.sh to /opt/mymusic/
        install_sh_path = ROOT_DIR / "scripts" / "install.sh"
        install_sh_bytes = install_sh_path.read_bytes().replace(b"\r\n", b"\n") if install_sh_path.exists() else b""

        ti = tarfile.TarInfo("./opt/mymusic/version.txt")
        ti.size = len(f"{VERSION}\n".encode("utf-8"))
        ti.mode = 0o644
        ti.mtime = 0
        tar.addfile(ti, io.BytesIO(f"{VERSION}\n".encode("utf-8")))

        if install_sh_bytes:
            ti = tarfile.TarInfo("./opt/mymusic/update.sh")
            ti.size = len(install_sh_bytes)
            ti.mode = 0o755
            ti.mtime = 0
            tar.addfile(ti, io.BytesIO(install_sh_bytes))

        # Add launcher wrapper to /usr/bin/mymusic
        bin_wrapper = b"#!/bin/sh\nexec /opt/mymusic/mymusic \"$@\"\n"
        ti = tarfile.TarInfo("./usr/bin/mymusic")
        ti.size = len(bin_wrapper)
        ti.mode = 0o755
        ti.mtime = 0
        tar.addfile(ti, io.BytesIO(bin_wrapper))

    data_tar_gz = data_buf.getvalue()

    # 4. Construct Debian ar package
    debian_binary = b"2.0\n"

    with open(out_deb_path, "wb") as deb:
        deb.write(b"!<arch>\n")

        # Member 1: debian-binary
        deb.write(build_ar_header("debian-binary", len(debian_binary)))
        deb.write(debian_binary)
        if len(debian_binary) % 2 != 0:
            deb.write(b"\n")

        # Member 2: control.tar.gz
        deb.write(build_ar_header("control.tar.gz", len(control_tar_gz)))
        deb.write(control_tar_gz)
        if len(control_tar_gz) % 2 != 0:
            deb.write(b"\n")

        # Member 3: data.tar.gz
        deb.write(build_ar_header("data.tar.gz", len(data_tar_gz)))
        deb.write(data_tar_gz)
        if len(data_tar_gz) % 2 != 0:
            deb.write(b"\n")

    print(f"==> Successfully generated: {out_deb_path} ({out_deb_path.stat().st_size:,} bytes)")


def create_universal_tarball(out_tar_path: Path):
    print("==> Building Universal portable Linux archive (Arch, Fedora, Debian)...")
    
    prefix = f"My.Music.{VERSION}"
    icon_bytes = ICON_SRC.read_bytes()

    with tarfile.open(out_tar_path, mode="w:gz", format=tarfile.PAX_FORMAT) as tar:
        # Add root directory
        ti = tarfile.TarInfo(f"{prefix}/")
        ti.type = tarfile.DIRTYPE
        ti.mode = 0o755
        ti.mtime = 0
        tar.addfile(ti)

        # Add unpacked directory contents
        for root, dnames, fnames in os.walk(UNPACKED_DIR):
            for d in dnames:
                rel = os.path.relpath(os.path.join(root, d), UNPACKED_DIR).replace("\\", "/")
                ti = tarfile.TarInfo(f"{prefix}/{rel}/")
                ti.type = tarfile.DIRTYPE
                ti.mode = 0o755
                ti.mtime = 0
                tar.addfile(ti)

            for f in fnames:
                full_path = Path(root) / f
                rel = os.path.relpath(full_path, UNPACKED_DIR).replace("\\", "/")
                target_path = f"{prefix}/{rel}"
                with open(full_path, "rb") as fh:
                    file_bytes = fh.read()
                ti = tarfile.TarInfo(target_path)
                ti.size = len(file_bytes)
                ti.mtime = 0
                ti.mode = 0o755 if is_executable(rel) else 0o644
                tar.addfile(ti, io.BytesIO(file_bytes))

        # Add helper files
        install_sh_path = ROOT_DIR / "scripts" / "install.sh"
        install_sh_bytes = install_sh_path.read_bytes().replace(b"\r\n", b"\n") if install_sh_path.exists() else b""

        helpers = [
            ("version.txt", f"{VERSION}\n".encode("utf-8"), 0o644),
            ("install.sh", install_sh_bytes, 0o755),
            ("update.sh", install_sh_bytes, 0o755),
            ("mymusic.png", icon_bytes, 0o644),
            ("My-Music.sh", PORTABLE_LAUNCHER.replace("\r\n", "\n").encode("utf-8"), 0o755),
            ("install-desktop.sh", INSTALL_DESKTOP_SCRIPT.replace("\r\n", "\n").encode("utf-8"), 0o755),
            ("uninstall-desktop.sh", UNINSTALL_DESKTOP_SCRIPT.replace("\r\n", "\n").encode("utf-8"), 0o755),
            ("mymusic.desktop", DESKTOP_ENTRY.replace("\r\n", "\n").encode("utf-8"), 0o644),
        ]

        for fname, fbytes, mode in helpers:
            ti = tarfile.TarInfo(f"{prefix}/{fname}")
            ti.size = len(fbytes)
            ti.mode = mode
            ti.mtime = 0
            tar.addfile(ti, io.BytesIO(fbytes))

    print(f"==> Successfully generated: {out_tar_path} ({out_tar_path.stat().st_size:,} bytes)")


def setup_arch_dist():
    print("==> Setting up Arch Linux packaging files in dist/arch...")
    arch_dir = DIST_DIR / "arch"
    arch_dir.mkdir(parents=True, exist_ok=True)

    (arch_dir / "PKGBUILD").write_text(ARCH_PKGBUILD, encoding="utf-8")
    (arch_dir / ".SRCINFO").write_text(ARCH_SRCINFO, encoding="utf-8")
    (arch_dir / "mymusic.desktop").write_text(DESKTOP_ENTRY, encoding="utf-8")
    (arch_dir / "README.md").write_text(ARCH_README, encoding="utf-8")
    shutil.copy2(ICON_SRC, arch_dir / "mymusic.png")
    print(f"==> Created Arch files in {arch_dir}")


def verify_deb(deb_path: Path):
    print("==> Verifying Debian package structure...")
    with open(deb_path, "rb") as f:
        magic = f.read(8)
        assert magic == b"!<arch>\n", f"Invalid magic: {magic}"
        
        members = []
        while True:
            hdr = f.read(60)
            if not hdr:
                break
            name = hdr[:16].decode("ascii").strip()
            size = int(hdr[48:58].decode("ascii").strip())
            trailer = hdr[58:60]
            assert trailer == b"`\n", f"Invalid trailer for {name}"
            content = f.read(size)
            if size % 2 != 0:
                pad = f.read(1)
                assert pad == b"\n" or pad == b"", f"Invalid pad byte"
            members.append((name, size, content))

    names = [m[0] for m in members]
    print(f"  ar members found: {names}")
    assert names == ["debian-binary", "control.tar.gz", "data.tar.gz"], f"Unexpected members: {names}"

    # Verify control.tar.gz
    ctrl_data = [m[2] for m in members if m[0] == "control.tar.gz"][0]
    with tarfile.open(fileobj=io.BytesIO(ctrl_data), mode="r:gz") as tar:
        ctrl_names = tar.getnames()
        print(f"  control.tar.gz contents: {ctrl_names}")
        assert "./control" in ctrl_names
        assert "./postinst" in ctrl_names
        assert "./postrm" in ctrl_names

    # Verify data.tar.gz
    data_data = [m[2] for m in members if m[0] == "data.tar.gz"][0]
    with tarfile.open(fileobj=io.BytesIO(data_data), mode="r:gz") as tar:
        data_names = tar.getnames()
        print(f"  data.tar.gz has {len(data_names)} entries")
        assert "./opt/mymusic/mymusic" in data_names
        assert "./opt/mymusic/resources/bin/yt-dlp" in data_names
        assert "./usr/bin/mymusic" in data_names
        assert "./usr/share/applications/mymusic.desktop" in data_names
        assert "./usr/share/icons/hicolor/512x512/apps/mymusic.png" in data_names

    print("==> Debian package verification PASSED!")


def main():
    if not UNPACKED_DIR.exists():
        print(f"ERROR: {UNPACKED_DIR} does not exist. Run electron-builder first.")
        sys.exit(1)

    deb_path = DIST_DIR / f"My.Music.{VERSION}.deb"
    tar_path = DIST_DIR / f"My.Music.{VERSION}.tar.gz"

    create_universal_tarball(tar_path)
    create_deb_package(deb_path)
    setup_arch_dist()
    verify_deb(deb_path)

    print("\n" + "=" * 60)
    print(f"Linux Release {VERSION} Build Summary:")
    for path in [tar_path, deb_path]:
        sha256 = hashlib.sha256(path.read_bytes()).hexdigest()
        size_mb = path.stat().st_size / (1024 * 1024)
        print(f"  - {path.name} ({size_mb:.2f} MB)")
        print(f"    SHA-256: {sha256}")
    print("=" * 60)


if __name__ == "__main__":
    main()
