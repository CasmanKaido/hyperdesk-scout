from math import hypot
from pathlib import Path

SIZE = 512
pixels = bytearray(SIZE * SIZE * 3)


def blend(x, y, color, alpha):
    if not (0 <= x < SIZE and 0 <= y < SIZE):
        return
    index = (y * SIZE + x) * 3
    inverse = 1.0 - alpha
    pixels[index] = round(pixels[index] * inverse + color[0] * alpha)
    pixels[index + 1] = round(pixels[index + 1] * inverse + color[1] * alpha)
    pixels[index + 2] = round(pixels[index + 2] * inverse + color[2] * alpha)


def circle(cx, cy, radius, color, opacity=1.0):
    minimum_x = max(0, int(cx - radius - 1))
    maximum_x = min(SIZE, int(cx + radius + 2))
    minimum_y = max(0, int(cy - radius - 1))
    maximum_y = min(SIZE, int(cy + radius + 2))
    for y in range(minimum_y, maximum_y):
        for x in range(minimum_x, maximum_x):
            distance = hypot(x + 0.5 - cx, y + 0.5 - cy)
            coverage = max(0.0, min(1.0, radius + 0.75 - distance))
            if coverage:
                blend(x, y, color, coverage * opacity)


def cubic(point0, point1, point2, point3, t):
    inverse = 1 - t
    return (
        inverse ** 3 * point0[0]
        + 3 * inverse ** 2 * t * point1[0]
        + 3 * inverse * t ** 2 * point2[0]
        + t ** 3 * point3[0],
        inverse ** 3 * point0[1]
        + 3 * inverse ** 2 * t * point1[1]
        + 3 * inverse * t ** 2 * point2[1]
        + t ** 3 * point3[1],
    )


def stroke(points, radius, color):
    for index in range(401):
        t = index / 400
        x, y = cubic(*points, t)
        circle(x, y, radius, color)


for y in range(SIZE):
    for x in range(SIZE):
        distance = hypot(x - SIZE / 2, y - SIZE / 2) / (SIZE / 2)
        lift = max(0.0, 1.0 - distance) * 8
        index = (y * SIZE + x) * 3
        pixels[index:index + 3] = bytes((round(9 + lift), round(10 + lift), round(9 + lift * 0.75)))

olive = (118, 145, 60)
cyan = (49, 218, 196)
near_white = (238, 244, 235)

stroke(((124, 174), (164, 88), (370, 92), (390, 244)), 20, olive)
stroke(((390, 244), (408, 370), (292, 421), (216, 375)), 20, olive)
stroke(((388, 338), (330, 440), (126, 421), (119, 264)), 14, cyan)
stroke(((119, 264), (112, 178), (166, 130), (245, 132)), 14, cyan)

circle(390, 244, 8, near_white)
circle(119, 264, 6, near_white)

output = Path(__file__).resolve().parents[1] / "assets" / "liquidflux-avatar.ppm"
with output.open("wb") as file:
    file.write(f"P6\n{SIZE} {SIZE}\n255\n".encode())
    file.write(pixels)
