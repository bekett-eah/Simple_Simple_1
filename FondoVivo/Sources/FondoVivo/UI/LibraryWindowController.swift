import AppKit
import SwiftUI

final class LibraryWindowController: NSWindowController, NSWindowDelegate {
    convenience init<Content: View>(rootView: Content) {
        let hosting = NSHostingController(rootView: rootView)
        hosting.sizingOptions = []
        let window = NSWindow(contentViewController: hosting)
        window.title = "Fondo Vivo"
        window.styleMask = [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView]
        window.titlebarAppearsTransparent = true
        window.titleVisibility = .hidden
        window.isReleasedWhenClosed = false
        window.minSize = NSSize(width: 860, height: 560)
        window.setContentSize(NSSize(width: 1060, height: 700))
        window.center()
        window.setFrameAutosaveName("FondoVivoBiblioteca")
        self.init(window: window)
        window.delegate = self
    }

    func windowWillClose(_ notification: Notification) {
        // Al cerrar la biblioteca la app vuelve a vivir solo en la barra de menús.
        NSApp.setActivationPolicy(.accessory)
    }
}
