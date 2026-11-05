// Dibuja el icono de Fondo Vivo (1024×1024): atardecer con montañas y botón de reproducir.
// Uso: swift scripts/make_icon.swift <salida.png>
import AppKit

let outputPath = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "AppIcon.png"
let size = 1024
let colorSpace = CGColorSpace(name: CGColorSpace.sRGB)!
let ctx = CGContext(
    data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0,
    space: colorSpace, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!

func rgb(_ hex: UInt32, _ alpha: CGFloat = 1) -> CGColor {
    CGColor(srgbRed: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255, alpha: alpha)
}

func gradient(_ colors: [CGColor], _ locations: [CGFloat]) -> CGGradient {
    CGGradient(colorsSpace: colorSpace, colors: colors as CFArray, locations: locations)!
}

func polygon(_ points: [(CGFloat, CGFloat)]) -> CGPath {
    let path = CGMutablePath()
    path.move(to: CGPoint(x: points[0].0, y: points[0].1))
    for point in points.dropFirst() { path.addLine(to: CGPoint(x: point.0, y: point.1)) }
    path.closeSubpath()
    return path
}

func fill(_ path: CGPath, with gradient: CGGradient, from start: CGPoint, to end: CGPoint) {
    ctx.saveGState()
    ctx.addPath(path)
    ctx.clip()
    ctx.drawLinearGradient(gradient, start: start, end: end, options: [.drawsBeforeStartLocation, .drawsAfterEndLocation])
    ctx.restoreGState()
}

let tile = CGRect(x: 100, y: 100, width: 824, height: 824)
let tilePath = CGPath(roundedRect: tile, cornerWidth: 186, cornerHeight: 186, transform: nil)

// Sombra del icono
ctx.saveGState()
ctx.setShadow(offset: CGSize(width: 0, height: -12), blur: 28, color: rgb(0x000000, 0.35))
ctx.addPath(tilePath)
ctx.setFillColor(rgb(0x1E1B4B))
ctx.fillPath()
ctx.restoreGState()

ctx.saveGState()
ctx.addPath(tilePath)
ctx.clip()

// Cielo
ctx.drawLinearGradient(
    gradient([rgb(0x1E1B4B), rgb(0x4C1D95), rgb(0xA21CAF), rgb(0xF97316), rgb(0xFDBA74)], [0, 0.32, 0.6, 0.85, 1]),
    start: CGPoint(x: 512, y: 924), end: CGPoint(x: 512, y: 360),
    options: [.drawsBeforeStartLocation, .drawsAfterEndLocation])

// Estrellas
let stars: [(CGFloat, CGFloat, CGFloat)] = [
    (230, 850, 5), (330, 800, 3.5), (420, 872, 4), (612, 846, 3), (760, 868, 5),
    (826, 792, 3.5), (182, 768, 3), (690, 784, 2.5), (520, 812, 2.5),
]
for (x, y, r) in stars {
    ctx.setFillColor(rgb(0xFFFFFF, 0.85))
    ctx.fillEllipse(in: CGRect(x: x - r, y: y - r, width: r * 2, height: r * 2))
}

// Sol con halo
let sun = CGPoint(x: 512, y: 500)
ctx.drawRadialGradient(
    gradient([rgb(0xFDE68A, 0.6), rgb(0xFB923C, 0)], [0, 1]),
    startCenter: sun, startRadius: 0, endCenter: sun, endRadius: 340, options: [])
fill(CGPath(ellipseIn: CGRect(x: sun.x - 150, y: sun.y - 150, width: 300, height: 300), transform: nil),
     with: gradient([rgb(0xFEF3C7), rgb(0xFDBA74), rgb(0xF472B6)], [0, 0.55, 1]),
     from: CGPoint(x: sun.x, y: sun.y + 150), to: CGPoint(x: sun.x, y: sun.y - 150))

// Montañas del fondo
fill(polygon([(100, 360), (215, 480), (300, 430), (420, 600), (520, 480), (600, 530),
              (722, 650), (832, 512), (924, 570), (924, 100), (100, 100)]),
     with: gradient([rgb(0x8B5CF6), rgb(0x4C1D95)], [0, 1]),
     from: CGPoint(x: 512, y: 650), to: CGPoint(x: 512, y: 330))
// Nieve
ctx.addPath(polygon([(722, 650), (690, 614), (708, 618), (723, 604), (739, 620), (754, 612)]))
ctx.setFillColor(rgb(0xFFFFFF, 0.8))
ctx.fillPath()

// Montañas delanteras
fill(polygon([(100, 270), (240, 430), (330, 360), (470, 530), (600, 350), (700, 420),
              (790, 340), (924, 460), (924, 100), (100, 100)]),
     with: gradient([rgb(0x3B2A8C), rgb(0x1E1B4B), rgb(0x0F0A2E)], [0, 0.5, 1]),
     from: CGPoint(x: 512, y: 530), to: CGPoint(x: 512, y: 120))
ctx.addPath(polygon([(470, 530), (430, 482), (452, 487), (470, 470), (490, 488), (512, 480)]))
ctx.setFillColor(rgb(0xFFFFFF, 0.92))
ctx.fillPath()

// Botón de reproducir
let play = CGPoint(x: 512, y: 250)
ctx.setFillColor(rgb(0xFFFFFF, 0.16))
ctx.fillEllipse(in: CGRect(x: play.x - 92, y: play.y - 92, width: 184, height: 184))
ctx.setStrokeColor(rgb(0xFFFFFF, 0.38))
ctx.setLineWidth(4)
ctx.strokeEllipse(in: CGRect(x: play.x - 92, y: play.y - 92, width: 184, height: 184))
let triangle = polygon([(play.x - 24, play.y + 40), (play.x - 24, play.y - 40), (play.x + 44, play.y)])
ctx.addPath(triangle)
ctx.setFillColor(rgb(0xFFFFFF))
ctx.fillPath()
ctx.addPath(triangle)
ctx.setStrokeColor(rgb(0xFFFFFF))
ctx.setLineWidth(16)
ctx.setLineJoin(.round)
ctx.strokePath()

ctx.restoreGState()

// Brillo sutil en el borde
ctx.addPath(tilePath)
ctx.setStrokeColor(rgb(0xFFFFFF, 0.14))
ctx.setLineWidth(3)
ctx.strokePath()

let image = ctx.makeImage()!
let data = NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:])!
try! data.write(to: URL(fileURLWithPath: outputPath))
