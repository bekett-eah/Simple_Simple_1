import AppKit

/// Diagnóstico: `FondoVivo --snapshot <carpeta>` guarda capturas de la ventana de la biblioteca,
/// de cada fondo y un JSON con el estado de los reproductores.
@MainActor
enum DebugSnapshot {
    static func runIfRequested(app: AppDelegate) {
        let arguments = CommandLine.arguments
        guard let index = arguments.firstIndex(of: "--snapshot"), index + 1 < arguments.count else { return }
        let folder = URL(fileURLWithPath: arguments[index + 1], isDirectory: true)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)

        Task { @MainActor in
            try? await Task.sleep(for: .seconds(4))
            for section in SidebarSection.allCases {
                app.showLibrary(section: section)
                try? await Task.sleep(for: .seconds(1.5))
                if let window = app.libraryWindow {
                    capture(window.windowNumber, to: folder.appendingPathComponent("ventana-\(section.rawValue).png"))
                }
            }
            app.showLibrary(section: .library)
            for (index, number) in app.wallpapers.windowNumbers.enumerated() {
                capture(number, to: folder.appendingPathComponent("fondo-\(index).png"))
            }
            let state: [String: Any] = [
                "videos": app.library.items.map(\.name),
                "fondoGeneral": app.library.item(withID: app.settings.defaultVideoID)?.name ?? "ninguno",
                "pantallas": app.wallpapers.diagnostics,
            ]
            if let data = try? JSONSerialization.data(withJSONObject: state, options: [.prettyPrinted, .sortedKeys]) {
                try? data.write(to: folder.appendingPathComponent("estado.json"))
            }
        }
    }

    private static func capture(_ windowNumber: Int, to url: URL) {
        guard let image = CGWindowListCreateImage(
            .null, .optionIncludingWindow, CGWindowID(windowNumber), [.boundsIgnoreFraming, .bestResolution])
        else { return }
        try? NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:])?.write(to: url)
    }
}
