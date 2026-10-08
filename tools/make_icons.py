# Draws the extension icon (green rounded square, white check) without any image library.
import struct, sys, zlib, os

def png(size, path):
    ss = 4  # supersampling for smooth edges
    n = size * ss
    r = n * 0.22
    def inside_rounded(x, y):
        cx = min(max(x, r), n - r); cy = min(max(y, r), n - r)
        return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
    # check mark as two thick segments
    pts = [(0.27, 0.53), (0.43, 0.69), (0.74, 0.35)]
    pts = [(a * n, b * n) for a, b in pts]
    w = n * 0.085
    def dist_seg(px, py, ax, ay, bx, by):
        dx, dy = bx - ax, by - ay
        t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
        return ((px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2) ** 0.5
    rows = []
    for Y in range(size):
        row = bytearray([0])
        for X in range(size):
            acc = [0, 0, 0, 0]
            for sy in range(ss):
                for sx in range(ss):
                    x = X * ss + sx + 0.5; y = Y * ss + sy + 0.5
                    if not inside_rounded(x, y):
                        continue
                    d = min(dist_seg(x, y, *pts[0], *pts[1]), dist_seg(x, y, *pts[1], *pts[2]))
                    c = (255, 255, 255) if d <= w else (31, 136, 61)
                    acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2]; acc[3] += 255
            k = ss * ss
            a = acc[3] // k
            if acc[3]:
                row += bytes([acc[0] * 255 // acc[3], acc[1] * 255 // acc[3], acc[2] * 255 // acc[3], a])
            else:
                row += bytes([0, 0, 0, 0])
        rows.append(bytes(row))
    raw = b''.join(rows)
    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    open(path, 'wb').write(data)

out = sys.argv[1]
for s in (16, 32, 48, 128):
    png(s, os.path.join(out, f'{s}.png'))
