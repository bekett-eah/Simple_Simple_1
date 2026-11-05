import AppKit
import AVFoundation

/// Reproduce un video en bucle y hace un fundido cruzado al cambiar de video.
final class WallpaperPlayerView: NSView {
    private struct Slot {
        let url: URL
        let player: AVQueuePlayer
        let looper: AVPlayerLooper
        let layer: AVPlayerLayer
    }

    private var current: Slot?
    /// Video nuevo que espera su primer fotograma antes de aparecer.
    private var incoming: Slot?
    private var readyObservation: NSKeyValueObservation?

    private var gravity: AVLayerVideoGravity = .resizeAspectFill
    private var muted = true
    private var volume: Float = 0.5
    private var rate: Float = 1
    private var playing = false

    private var displayedURL: URL? { incoming?.url ?? current?.url }

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        wantsLayer = true
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) no está soportado")
    }

    override func layout() {
        super.layout()
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        for slot in [current, incoming].compactMap({ $0 }) {
            slot.layer.frame = bounds
        }
        CATransaction.commit()
    }

    func show(url: URL?) {
        guard url != displayedURL else { return }
        discardIncoming()
        guard url != current?.url else { return }
        guard let url else {
            fadeOutCurrent()
            return
        }

        let player = AVQueuePlayer()
        player.preventsDisplaySleepDuringVideoPlayback = false
        let looper = AVPlayerLooper(player: player, templateItem: AVPlayerItem(url: url))
        let playerLayer = AVPlayerLayer(player: player)
        playerLayer.frame = bounds
        playerLayer.backgroundColor = NSColor.black.cgColor
        playerLayer.opacity = 0
        layer?.addSublayer(playerLayer)

        let slot = Slot(url: url, player: player, looper: looper, layer: playerLayer)
        incoming = slot
        configure(slot)
        readyObservation = playerLayer.observe(\.isReadyForDisplay, options: [.initial, .new]) { [weak self] layer, _ in
            guard layer.isReadyForDisplay else { return }
            DispatchQueue.main.async { self?.promoteIncoming(url) }
        }
    }

    func configure(gravity: AVLayerVideoGravity, muted: Bool, volume: Float, rate: Float, playing: Bool) {
        self.gravity = gravity
        self.muted = muted
        self.volume = volume
        self.rate = rate
        self.playing = playing
        for slot in [current, incoming].compactMap({ $0 }) {
            configure(slot)
        }
    }

    private func configure(_ slot: Slot) {
        slot.layer.videoGravity = gravity
        slot.player.isMuted = muted
        slot.player.volume = volume
        slot.player.defaultRate = rate
        if playing {
            if slot.player.rate != rate { slot.player.rate = rate }
        } else if slot.player.rate != 0 {
            slot.player.pause()
        }
    }

    private func promoteIncoming(_ url: URL) {
        guard let slot = incoming, slot.url == url else { return }
        readyObservation = nil
        incoming = nil
        let previous = current
        current = slot

        CATransaction.begin()
        CATransaction.setAnimationDuration(0.9)
        CATransaction.setAnimationTimingFunction(CAMediaTimingFunction(name: .easeInEaseOut))
        CATransaction.setCompletionBlock {
            if let previous { Self.dispose(previous) }
        }
        slot.layer.opacity = 1
        CATransaction.commit()
    }

    private func fadeOutCurrent() {
        guard let slot = current else { return }
        current = nil
        CATransaction.begin()
        CATransaction.setAnimationDuration(0.6)
        CATransaction.setCompletionBlock { Self.dispose(slot) }
        slot.layer.opacity = 0
        CATransaction.commit()
    }

    private func discardIncoming() {
        readyObservation = nil
        if let incoming { Self.dispose(incoming) }
        incoming = nil
    }

    private static func dispose(_ slot: Slot) {
        slot.looper.disableLooping()
        slot.player.pause()
        slot.player.removeAllItems()
        slot.layer.player = nil
        slot.layer.removeFromSuperlayer()
    }

    var diagnostics: [String: Any] {
        guard let slot = current ?? incoming else { return ["video": "ninguno"] }
        return [
            "video": slot.url.lastPathComponent,
            "velocidad": slot.player.rate,
            "listoParaMostrar": slot.layer.isReadyForDisplay,
            "opacidad": slot.layer.opacity,
            "esperandoPrimerFotograma": incoming != nil,
        ]
    }
}
