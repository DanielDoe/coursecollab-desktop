#!/usr/bin/env python3
"""Build CourseCollab desktop icons (png / icns / ico / favicon / tray) from the brand mark."""

from __future__ import annotations

import shutil
import struct
import subprocess
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "brand" / "course-collab-mark-1024.png"
BUILD = ROOT / "build"
PUBLIC = ROOT / "public"
BRAND = PUBLIC / "brand"

ICONSET_SIZES = {
    "icon_16x16.png": 16,
    "icon_16x16@2x.png": 32,
    "icon_32x32.png": 32,
    "icon_32x32@2x.png": 64,
    "icon_128x128.png": 128,
    "icon_128x128@2x.png": 256,
    "icon_256x256.png": 256,
    "icon_256x256@2x.png": 512,
    "icon_512x512.png": 512,
    "icon_512x512@2x.png": 1024,
}

ICO_SIZES = (16, 24, 32, 48, 64, 128, 256)
# Squircle tile size on the 1024 master canvas — macOS dock icons need outer transparent
# padding or they render larger than system apps (Chrome, Phone, etc.).
DOCK_TILE_SCALE = 0.82
# Mark size relative to the inset tile, not the full canvas.
APP_ICON_SCALE = 0.72
TILE_COLOR = (248, 247, 252, 255)
SQUIRCLE_RADIUS = 0.223


def resize(image: Image.Image, size: int) -> Image.Image:
    return image.resize((size, size), Image.Resampling.LANCZOS)


def isolate_mark(image: Image.Image) -> Image.Image:
    mark = image.convert("RGBA")
    pixels = mark.load()
    assert pixels is not None
    width, height = mark.size
    for y in range(height):
        for x in range(width):
            red, green, blue, alpha = pixels[x, y]
            if alpha < 12 or red + green + blue < 36:
                pixels[x, y] = (0, 0, 0, 0)
    return mark


def squircle_mask(size: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    radius = max(1, int(size * SQUIRCLE_RADIUS))
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    return mask


def inset_app_icon(
    image: Image.Image,
    size: int = 1024,
    scale: float = APP_ICON_SCALE,
    tile_scale: float = DOCK_TILE_SCALE,
) -> Image.Image:
    """Squircle tile on a transparent canvas. tile_scale < 1 leaves macOS dock padding."""
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    tile_size = max(1, int(size * tile_scale))
    tile = Image.new("RGBA", (tile_size, tile_size), TILE_COLOR)
    tile.putalpha(squircle_mask(tile_size))
    mark_size = max(1, int(tile_size * scale))
    mark = resize(isolate_mark(image), mark_size)
    offset = (tile_size - mark_size) // 2
    tile.alpha_composite(mark, (offset, offset))
    inset = (size - tile_size) // 2
    canvas.alpha_composite(tile, (inset, inset))
    return canvas


def windows_app_icon(image: Image.Image, size: int = 256) -> Image.Image:
    """Full-canvas branded tile — Windows taskbar/tray ignore heavily padded PNG-in-ICO."""
    return inset_app_icon(image, size=size, scale=0.78, tile_scale=1.0)


def _and_mask(img: Image.Image) -> bytes:
    """1-bit AND mask, rows padded to 32 bits, bottom-up (ICO DIB)."""
    w, h = img.size
    pixels = img.load()
    assert pixels is not None
    row_bytes = ((w + 31) // 32) * 4
    out = bytearray()
    for y in range(h - 1, -1, -1):
        row = bytearray(row_bytes)
        bit = 0
        for x in range(w):
            if pixels[x, y][3] < 12:
                row[bit // 8] |= 0x80 >> (bit % 8)
            bit += 1
        out.extend(row)
    return bytes(out)


def _ico_bmp_dib(img: Image.Image) -> bytes:
    """32-bit BGRA XOR + AND mask. Windows Explorer needs BMP frames for 16–64px."""
    img = img.convert("RGBA")
    w, h = img.size
    pixels = img.load()
    assert pixels is not None
    xor = bytearray()
    for y in range(h - 1, -1, -1):
        for x in range(w):
            red, green, blue, alpha = pixels[x, y]
            xor.extend((blue, green, red, alpha))
    and_mask = _and_mask(img)
    header = struct.pack(
        "<IiiHHIIiiII",
        40,
        w,
        h * 2,
        1,
        32,
        0,
        len(xor),
        0,
        0,
        0,
        0,
    )
    return header + xor + and_mask


def write_windows_ico(img: Image.Image, path: Path, sizes: tuple[int, ...] = ICO_SIZES) -> None:
    """Write a Windows-shell-safe ICO: BMP for ≤128px, PNG only for 256px."""
    entries: list[tuple[int, int, bytes]] = []
    for size in sizes:
        frame = resize(img, size)
        if size >= 256:
            buf = BytesIO()
            frame.save(buf, format="PNG")
            data = buf.getvalue()
        else:
            data = _ico_bmp_dib(frame)
        entries.append((size, size if size < 256 else 0, data))

    count = len(entries)
    offset = 6 + 16 * count
    parts = [struct.pack("<HHH", 0, 1, count)]
    payloads = []
    for width, height, data in entries:
        parts.append(
            struct.pack(
                "<BBBBHHII",
                width & 0xFF,
                height & 0xFF,
                0,
                0,
                1,
                32,
                len(data),
                offset,
            )
        )
        payloads.append(data)
        offset += len(data)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b"".join(parts) + b"".join(payloads))


def make_template(image: Image.Image, size: int) -> Image.Image:
    """White-on-transparent mark for the macOS menu-bar tray."""
    icon = resize(image, size).convert("RGBA")
    pixels = icon.load()
    assert pixels is not None
    for y in range(size):
        for x in range(size):
            red, green, blue, alpha = pixels[x, y]
            if alpha < 12 or red + green + blue < 36:
                pixels[x, y] = (255, 255, 255, 0)
                continue
            luminance = min(255, int(0.299 * red + 0.587 * green + 0.114 * blue))
            pixels[x, y] = (255, 255, 255, max(alpha, luminance))
    return icon


def write_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="PNG")


def build_icns(master: Image.Image) -> None:
    iconset = BUILD / "icon.iconset"
    if iconset.exists():
        shutil.rmtree(iconset)
    iconset.mkdir(parents=True)
    for name, size in ICONSET_SIZES.items():
        write_png(resize(master, size), iconset / name)
    icns = BUILD / "icon.icns"
    subprocess.run(["iconutil", "-c", "icns", str(iconset), "-o", str(icns)], check=True)
    shutil.rmtree(iconset)


BADGE_BG = (220, 38, 38, 255)
BADGE_FG = (255, 255, 255, 255)


def build_badge(label: str, size: int = 32) -> Image.Image:
    """Taskbar overlay badge for Windows, which has no dock badge of its own."""
    badge = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(badge)
    draw.ellipse((0, 0, size - 1, size - 1), fill=BADGE_BG)

    font = None
    for candidate in (
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ):
        if Path(candidate).exists():
            try:
                font = ImageFont.truetype(candidate, int(size * (0.52 if len(label) > 1 else 0.62)))
                break
            except OSError:
                continue
    if font is None:
        font = ImageFont.load_default()

    left, top, right, bottom = draw.textbbox((0, 0), label, font=font)
    draw.text(
        ((size - (right - left)) / 2 - left, (size - (bottom - top)) / 2 - top),
        label,
        font=font,
        fill=BADGE_FG,
    )
    return badge


def build_badges() -> None:
    badges = BUILD / "badges"
    badges.mkdir(parents=True, exist_ok=True)
    for count in range(1, 10):
        write_png(build_badge(str(count)), badges / f"badge-{count}.png")
    write_png(build_badge("9+"), badges / "badge-more.png")


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"Missing brand mark: {SOURCE}")

    source = Image.open(SOURCE).convert("RGBA")
    app_icon = inset_app_icon(source)
    BUILD.mkdir(parents=True, exist_ok=True)

    write_png(app_icon, BUILD / "icon.png")
    write_png(resize(app_icon, 512), BUILD / "icon-512.png")
    # macOS menu bar: white template (Electron setTemplateImage)
    write_png(make_template(source, 32), BUILD / "tray-icon.png")
    write_png(make_template(source, 64), BUILD / "tray-icon@2x.png")
    # Windows/Linux tray: full-bleed colored tile — padded Mac dock icons vanish at 16–32px
    win_icon = windows_app_icon(source, 256)
    write_png(resize(win_icon, 32), BUILD / "tray-icon-win.png")
    write_png(resize(win_icon, 64), BUILD / "tray-icon-win@2x.png")
    write_png(resize(win_icon, 32), BUILD / "tray-icon-win-tile.png")

    write_png(resize(app_icon, 180), BRAND / "apple-icon.png")
    write_png(resize(app_icon, 180), PUBLIC / "apple-icon.png")
    write_png(resize(app_icon, 512), PUBLIC / "icon.png")
    write_png(resize(app_icon, 32), PUBLIC / "icon-light-32x32.png")
    write_png(resize(app_icon, 32), PUBLIC / "icon-dark-32x32.png")

    write_windows_ico(win_icon, BUILD / "icon.ico")
    write_windows_ico(win_icon, PUBLIC / "favicon.ico", sizes=(16, 32, 48))

    build_icns(app_icon)
    build_badges()
    print(
        f"Prepared CourseCollab desktop icons "
        f"({int(DOCK_TILE_SCALE * 100)}% tile / {int(APP_ICON_SCALE * 100)}% mark) in build/ and public/"
    )


if __name__ == "__main__":
    main()
