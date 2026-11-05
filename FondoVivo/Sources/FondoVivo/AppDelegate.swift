import AppKit
import SwiftUI

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    let library = VideoLibrary()
    let settings = AppSettings()
    let ui = UIState()
    private(set) lazy var wallpapers = WallpaperManager(library: library, settings: settings)

    private var statusItem: StatusItemController?
    private var libraryWindowController: LibraryWindowController?
    var libraryWindow: NSWindow? { libraryWindowController?.window }

    override init() {
        super.init()
        // Si todavía no hay fondo elegido, el primer video importado pasa a ser el fondo.
        library.onImport = { [weak self] added in
            guard let self, self.settings.defaultVideoID == nil, let first = added.first else { return }
            self.settings.defaultVideoID = first.id
        }
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        wallpapers.start()
        statusItem = StatusItemController(app: self)
        if !settings.hasLaunchedBefore || library.items.isEmpty {
            showLibrary()
        }
        settings.hasLaunchedBefore = true
        DebugSnapshot.runIfRequested(app: self)
    }

    /// Videos arrastrados al icono de la app o abiertos con «Abrir con».
    func application(_ sender: NSApplication, open urls: [URL]) {
        showLibrary(section: .library)
        Task { await library.importVideos(from: urls) }
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        showLibrary()
        return false
    }

    func showLibrary(section: SidebarSection? = nil) {
        if let section { ui.section = section }
        if libraryWindowController == nil {
            let root = RootView()
                .environmentObject(library)
                .environmentObject(settings)
                .environmentObject(ui)
                .environmentObject(wallpapers)
            libraryWindowController = LibraryWindowController(rootView: root)
        }
        // Mientras la biblioteca está abierta la app aparece en el Dock.
        NSApp.setActivationPolicy(.regular)
        libraryWindowController?.showWindow(nil)
        libraryWindow?.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }
}
