import AVFoundation
import SwiftUI
import UniformTypeIdentifiers

enum Theme {
    static let violet = Color(red: 0.49, green: 0.30, blue: 0.96)
    static let pink = Color(red: 0.86, green: 0.30, blue: 0.68)
    static let orange = Color(red: 0.98, green: 0.52, blue: 0.24)
    static let gradient = LinearGradient(colors: [violet, pink, orange], startPoint: .topLeading, endPoint: .bottomTrailing)
}

struct VisualEffectBackground: NSViewRepresentable {
    var material: NSVisualEffectView.Material = .sidebar

    func makeNSView(context: Context) -> NSVisualEffectView {
        let view = NSVisualEffectView()
        view.material = material
        view.blendingMode = .behindWindow
        view.state = .followsWindowActiveState
        return view
    }

    func updateNSView(_ view: NSVisualEffectView, context: Context) {
        view.material = material
    }
}

struct GradientButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(.white)
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .background(Capsule().fill(Theme.gradient))
            .shadow(color: Theme.violet.opacity(0.35), radius: 8, y: 3)
            .opacity(configuration.isPressed ? 0.85 : 1)
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

struct CircleIconButton: View {
    let systemName: String
    let help: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: 11, weight: .semibold))
                .frame(width: 28, height: 28)
                .background(Circle().fill(Color.primary.opacity(0.08)))
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .help(help)
    }
}

struct PageHeader<Trailing: View>: View {
    let title: String
    let subtitle: String
    @ViewBuilder var trailing: Trailing

    var body: some View {
        HStack(alignment: .center, spacing: 14) {
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.system(size: 26, weight: .bold))
                Text(subtitle).font(.callout).foregroundStyle(.secondary)
            }
            Spacer(minLength: 12)
            trailing
        }
        .padding(.horizontal, 28)
        .padding(.top, 40)
        .padding(.bottom, 18)
    }
}

extension PageHeader where Trailing == EmptyView {
    init(title: String, subtitle: String) {
        self.init(title: title, subtitle: subtitle) { EmptyView() }
    }
}

/// Miniatura que rellena su marco (recortando lo que sobre).
struct ThumbnailView: View {
    let image: NSImage?

    var body: some View {
        Color.black
            .overlay {
                if let image {
                    Image(nsImage: image).resizable().scaledToFill()
                } else {
                    Image(systemName: "film")
                        .font(.system(size: 22))
                        .foregroundStyle(.white.opacity(0.35))
                }
            }
            .clipped()
    }
}

/// Reproductor silencioso en bucle para las vistas previas.
struct LoopingVideoView: NSViewRepresentable {
    let url: URL

    func makeNSView(context: Context) -> LoopingPlayerNSView {
        let view = LoopingPlayerNSView()
        view.play(url: url)
        return view
    }

    func updateNSView(_ view: LoopingPlayerNSView, context: Context) {
        view.play(url: url)
    }

    static func dismantleNSView(_ view: LoopingPlayerNSView, coordinator: ()) {
        view.stop()
    }
}

final class LoopingPlayerNSView: NSView {
    private let playerLayer = AVPlayerLayer()
    private var player: AVQueuePlayer?
    private var looper: AVPlayerLooper?
    private var url: URL?

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        wantsLayer = true
        playerLayer.videoGravity = .resizeAspectFill
        layer?.addSublayer(playerLayer)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) no está soportado")
    }

    override func layout() {
        super.layout()
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        playerLayer.frame = bounds
        CATransaction.commit()
    }

    func play(url: URL) {
        guard url != self.url else { return }
        stop()
        self.url = url
        let player = AVQueuePlayer()
        player.isMuted = true
        player.preventsDisplaySleepDuringVideoPlayback = false
        looper = AVPlayerLooper(player: player, templateItem: AVPlayerItem(url: url))
        playerLayer.player = player
        self.player = player
        player.play()
    }

    func stop() {
        looper?.disableLooping()
        player?.pause()
        playerLayer.player = nil
        player = nil
        looper = nil
        url = nil
    }
}

extension NSItemProvider {
    func loadFileURL() async -> URL? {
        await withCheckedContinuation { continuation in
            loadItem(forTypeIdentifier: UTType.fileURL.identifier, options: nil) { item, _ in
                if let data = item as? Data {
                    continuation.resume(returning: URL(dataRepresentation: data, relativeTo: nil))
                } else {
                    continuation.resume(returning: item as? URL)
                }
            }
        }
    }
}
