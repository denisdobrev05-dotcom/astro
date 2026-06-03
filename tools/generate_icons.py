#!/usr/bin/env python3
"""Генератор на иконите за PWA — без външни зависимости (само zlib/struct).
Рисува космическа икона: тъмен градиент, златен зодиакален пръстен, полумесец и звезди."""
import math, struct, zlib, os, random

def png(path, w, h, pixels):
    raw = bytearray()
    for y in range(h):
        raw.append(0)  # филтър 0
        for x in range(w):
            r, g, b = pixels[y * w + x]
            raw += bytes((r, g, b))
    def chunk(tag, data):
        c = tag + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xffffffff)
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)  # 8-бит, truecolor
    idat = zlib.compress(bytes(raw), 9)
    with open(path, "wb") as f:
        f.write(sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b""))

def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))

def clamp(c):
    return tuple(max(0, min(255, int(round(v)))) for v in c)

def draw(size, safe=1.0):
    """safe<1.0 свива съдържанието навътре (за maskable икони)."""
    cx = cy = size / 2.0
    R = size * 0.5
    px = [(0, 0, 0)] * (size * size)

    center_col = (32, 22, 74)   # лилаво-синьо
    mid_col = (16, 12, 42)
    edge_col = (5, 3, 14)

    # фиксирани звезди (детерминирано)
    rnd = random.Random(7)
    stars = []
    for _ in range(46):
        a = rnd.random() * 2 * math.pi
        rr = (0.12 + rnd.random() * 0.86) * R * safe
        sx = cx + math.cos(a) * rr
        sy = cy + math.sin(a) * rr
        stars.append((sx, sy, rnd.random() * 1.3 + 0.6, 0.5 + rnd.random() * 0.5))

    ring_r = R * 0.80 * safe
    ring_w = max(1.5, size * 0.012)

    # 12 маркера по пръстена (за 12-те зодиакални знака)
    ticks = []
    for i in range(12):
        a = -math.pi / 2 + i * (2 * math.pi / 12)
        ticks.append((cx + math.cos(a) * ring_r, cy + math.sin(a) * ring_r))
    tick_r = max(2.0, size * 0.018)

    # допълнителна виолетова мъглявина (изместена)
    neb_x = cx + R * 0.22 * safe
    neb_y = cy + R * 0.24 * safe

    # полумесец
    moon_r = R * 0.30 * safe
    mx = cx - R * 0.12 * safe
    my = cy - R * 0.04 * safe
    cut_r = moon_r * 1.02
    cutx = mx + moon_r * 0.58
    cuty = my - moon_r * 0.12
    moon_col = (248, 226, 156)
    moon_glow = (214, 178, 64)

    for y in range(size):
        for x in range(size):
            dx = x - cx
            dy = y - cy
            d = math.sqrt(dx * dx + dy * dy)
            t = min(1.0, d / R)
            # фон: двустъпков радиален градиент
            if t < 0.5:
                col = list(lerp(center_col, mid_col, t / 0.5))
            else:
                col = list(lerp(mid_col, edge_col, (t - 0.5) / 0.5))

            # лек централен ореол
            glow = max(0.0, 1.0 - d / (R * 0.55)) * 0.25
            col[0] += int(70 * glow); col[1] += int(50 * glow); col[2] += int(120 * glow)

            # виолетова мъглявина
            nd = math.hypot(x - neb_x, y - neb_y)
            ng = max(0.0, 1.0 - nd / (R * 0.42 * safe)) ** 2 * 0.30
            col[0] += int(90 * ng); col[1] += int(40 * ng); col[2] += int(150 * ng)

            # зодиакален пръстен
            dr = abs(d - ring_r)
            if dr < ring_w:
                k = 1.0 - dr / ring_w
                col = list(lerp(tuple(col), (212, 177, 60), 0.6 * k))

            # маркери по пръстена
            for (tx, ty) in ticks:
                td = math.hypot(x - tx, y - ty)
                if td < tick_r:
                    k = (1.0 - td / tick_r) ** 0.8
                    col = list(lerp(tuple(clamp(col)), (244, 222, 150), 0.85 * k))

            # звезди
            for (sx, sy, sr, sb) in stars:
                sd = math.hypot(x - sx, y - sy)
                if sd < sr * 2.2:
                    k = max(0.0, 1.0 - sd / (sr * 2.2)) ** 1.5 * sb
                    col[0] += int(220 * k); col[1] += int(220 * k); col[2] += int(255 * k)

            # полумесец (диск минус изместен диск)
            md = math.hypot(x - mx, y - my)
            cd = math.hypot(x - cutx, y - cuty)
            if md < moon_r and cd > cut_r:
                edge = min(1.0, (moon_r - md) / (moon_r * 0.18))
                edge2 = min(1.0, (cd - cut_r) / (cut_r * 0.10))
                a = max(0.0, min(1.0, edge)) * max(0.0, min(1.0, edge2))
                base = lerp(moon_glow, moon_col, min(1.0, md / moon_r + 0.2))
                col = list(lerp(tuple(clamp(col)), base, a))
            elif md < moon_r * 1.18 and cd > cut_r:
                # мек ореол около луната
                k = max(0.0, 1.0 - (md - moon_r) / (moon_r * 0.18)) * 0.35
                if k > 0:
                    col[0] += int(120 * k); col[1] += int(100 * k); col[2] += int(40 * k)

            px[y * size + x] = clamp(col)
    return px

def main():
    here = os.path.dirname(os.path.abspath(__file__))
    out = os.path.join(here, "..", "icons")
    os.makedirs(out, exist_ok=True)
    for size, name, safe in [
        (512, "icon-512.png", 1.0),
        (192, "icon-192.png", 1.0),
        (180, "icon-180.png", 1.0),
        (512, "icon-maskable-512.png", 0.78),
    ]:
        png(os.path.join(out, name), size, size, draw(size, safe))
        print("записан", name)

if __name__ == "__main__":
    main()
