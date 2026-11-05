import AppKit

/// Ventana sin bordes al nivel del escritorio: queda debajo de los iconos y de todas las ventanas.
final class WallpaperWindow: NSWindow {
    let playerView: WallpaperPlayerView
    var onOcclusionChange: (() -> Void)?

    init(screen: NSScreen) {
        playerView = WallpaperPlayerView(frame: NSRect(origin: .zero, size: screen.frame.size))
        super.init(contentRect: screen.frame, styleMask: [.borderless], backing: .buffered, defer: false)
        isReleasedWhenClosed = false
        level = NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.desktopWindow)))
        collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]
        ignoresMouseEvents = true
        isOpaque = false
        backgroundColor = .clear
        hasShadow = false
        animationBehavior = .none
        contentView = playerView
        setFrame(screen.frame, display: false)

        NotificationCenter.default.addObserver(
            self, selector: #selector(occlusionDidChange),
            name: NSWindow.didChangeOcclusionStateNotification, object: self)
    }

    /// `true` cuando otras ventanas (p. ej. una app a pantalla completa) tapan el escritorio.
    var isCovered: Bool { !occlusionState.contains(.visible) }

    override var canBecomeKey: Bool { false }
    override var canBecomeMain: Bool { false }

    @objc private func occlusionDidChange() {
        onOcclusionChange?()
    }
}

extension NSScreen {
    var displayID: CGDirectDisplayID {
        (deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber)?.uint32Value ?? 0
    }

    /// Identificador estable de la pantalla (se mantiene entre reinicios).
    var stableID: String {
        guard let uuid = CGDisplayCreateUUIDFromDisplayID(displayID)?.takeRetainedValue() else {
            return "display-\(displayID)"
        }
        return CFUUIDCreateString(nil, uuid) as String
    }
}
