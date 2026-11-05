import AppKit

/// Icono de la barra de menús con acceso rápido a los fondos.
@MainActor
final class StatusItemController: NSObject, NSMenuDelegate {
    private let statusItem: NSStatusItem
    private unowned let app: AppDelegate
    private let maxVideosInMenu = 12

    init(app: AppDelegate) {
        self.app = app
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        super.init()
        if let button = statusItem.button {
            let image = NSImage(systemSymbolName: "mountain.2.fill", accessibilityDescription: "Fondo Vivo")
            image?.isTemplate = true
            button.image = image
        }
        let menu = NSMenu()
        menu.delegate = self
        statusItem.menu = menu
    }

    func menuNeedsUpdate(_ menu: NSMenu) {
        menu.removeAllItems()
        let library = app.library
        let settings = app.settings
        let current = library.item(withID: settings.defaultVideoID)
        let hasWallpaper = current != nil || !settings.screenOverrides.isEmpty

        let header = NSMenuItem(title: current.map { "Fondo: \($0.name)" } ?? "Sin fondo animado", action: nil, keyEquivalent: "")
        header.isEnabled = false
        menu.addItem(header)

        if hasWallpaper {
            menu.addItem(item(settings.isPaused ? "Reanudar" : "Pausar", action: #selector(togglePause), key: "p"))
        }
        if library.items.count > 1 {
            menu.addItem(item("Siguiente fondo", action: #selector(nextWallpaper), key: "n"))
        }
        let mute = item("Silenciar", action: #selector(toggleMute))
        mute.state = settings.isMuted ? .on : .off
        menu.addItem(mute)

        if !library.items.isEmpty {
            menu.addItem(.separator())
            menu.addItem(.sectionHeader(title: "Tus fondos"))
            for video in library.items.prefix(maxVideosInMenu) {
                let entry = item(video.name, action: #selector(selectVideo(_:)))
                entry.representedObject = video.id
                entry.state = settings.defaultVideoID == video.id ? .on : .off
                entry.image = library.thumbnail(for: video)?.menuThumbnail()
                menu.addItem(entry)
            }
            if library.items.count > maxVideosInMenu {
                menu.addItem(item("Ver todos…", action: #selector(openLibrary)))
            }
            if current != nil {
                menu.addItem(item("Quitar fondo animado", action: #selector(clearWallpaper)))
            }
        }

        menu.addItem(.separator())
        menu.addItem(item("Abrir biblioteca…", action: #selector(openLibrary), key: "l"))
        menu.addItem(item("Ajustes…", action: #selector(openSettings), key: ","))
        menu.addItem(.separator())
        menu.addItem(item("Salir de Fondo Vivo", action: #selector(quit), key: "q"))
    }

    private func item(_ title: String, action: Selector, key: String = "") -> NSMenuItem {
        let item = NSMenuItem(title: title, action: action, keyEquivalent: key)
        item.target = self
        return item
    }

    @objc private func togglePause() { app.settings.isPaused.toggle() }
    @objc private func toggleMute() { app.settings.isMuted.toggle() }
    @objc private func nextWallpaper() { app.wallpapers.nextWallpaper() }
    @objc private func clearWallpaper() { app.settings.defaultVideoID = nil }
    @objc private func openLibrary() { app.showLibrary(section: .library) }
    @objc private func openSettings() { app.showLibrary(section: .settings) }
    @objc private func quit() { NSApp.terminate(nil) }

    @objc private func selectVideo(_ sender: NSMenuItem) {
        guard let id = sender.representedObject as? UUID else { return }
        app.settings.defaultVideoID = id
    }
}

private extension NSImage {
    /// Miniatura 16:9 con esquinas redondeadas para el menú.
    func menuThumbnail() -> NSImage {
        let target = NSSize(width: 43, height: 24)
        return NSImage(size: target, flipped: false) { rect in
            NSBezierPath(roundedRect: rect, xRadius: 4, yRadius: 4).addClip()
            let scale = max(rect.width / self.size.width, rect.height / self.size.height)
            let drawSize = NSSize(width: self.size.width * scale, height: self.size.height * scale)
            let origin = NSPoint(x: (rect.width - drawSize.width) / 2, y: (rect.height - drawSize.height) / 2)
            self.draw(in: NSRect(origin: origin, size: drawSize))
            return true
        }
    }
}
