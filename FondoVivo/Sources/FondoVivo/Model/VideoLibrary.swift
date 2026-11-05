import AppKit
import AVFoundation
import UniformTypeIdentifiers

enum LibraryError: LocalizedError {
    case notPlayable
    case noVideoTrack
    case thumbnailFailed
    case frameFailed

    var errorDescription: String? {
        switch self {
        case .notPlayable: "El archivo no se puede reproducir."
        case .noVideoTrack: "El archivo no contiene video."
        case .thumbnailFailed: "No se pudo generar la miniatura."
        case .frameFailed: "No se pudo extraer el fotograma."
        }
    }
}

/// Biblioteca de videos: guarda una copia de cada video en
/// ~/Library/Application Support/FondoVivo junto con su miniatura.
@MainActor
final class VideoLibrary: ObservableObject {
    @Published private(set) var items: [VideoItem] = []
    @Published private(set) var importingCount = 0
    @Published var lastError: String?

    /// Se llama con los videos recién importados.
    var onImport: (([VideoItem]) -> Void)?

    let folderURL: URL
    private let videosURL: URL
    private let thumbnailsURL: URL
    private var indexURL: URL { folderURL.appendingPathComponent("biblioteca.json") }
    private var thumbnailCache: [UUID: NSImage] = [:]

    init() {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        folderURL = support.appendingPathComponent("FondoVivo", isDirectory: true)
        videosURL = folderURL.appendingPathComponent("Videos", isDirectory: true)
        thumbnailsURL = folderURL.appendingPathComponent("Miniaturas", isDirectory: true)
        for url in [videosURL, thumbnailsURL] {
            try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        }
        load()
    }

    func videoURL(for item: VideoItem) -> URL {
        videosURL.appendingPathComponent(item.fileName)
    }

    func thumbnailURL(for item: VideoItem) -> URL {
        thumbnailsURL.appendingPathComponent("\(item.id.uuidString).jpg")
    }

    func item(withID id: UUID?) -> VideoItem? {
        guard let id else { return nil }
        return items.first { $0.id == id }
    }

    func thumbnail(for item: VideoItem) -> NSImage? {
        if let cached = thumbnailCache[item.id] { return cached }
        let image = NSImage(contentsOf: thumbnailURL(for: item))
        thumbnailCache[item.id] = image
        return image
    }

    // MARK: - Importar

    @discardableResult
    func importVideos(from urls: [URL]) async -> [VideoItem] {
        let sources = Self.expandVideoURLs(urls)
        guard !sources.isEmpty else {
            if !urls.isEmpty { lastError = "Ninguno de los archivos es un video compatible." }
            return []
        }
        importingCount += sources.count
        var added: [VideoItem] = []
        for source in sources {
            do {
                let item = try await Self.makeItem(from: source, videosURL: videosURL, thumbnailsURL: thumbnailsURL)
                items.insert(item, at: 0)
                added.append(item)
                save()
            } catch {
                lastError = "No se pudo importar «\(source.lastPathComponent)»: \(error.localizedDescription)"
            }
            importingCount -= 1
        }
        if !added.isEmpty { onImport?(added) }
        return added
    }

    /// Acepta archivos sueltos o carpetas (se importan los videos que contengan).
    nonisolated static func expandVideoURLs(_ urls: [URL]) -> [URL] {
        var result: [URL] = []
        for url in urls {
            var isDirectory: ObjCBool = false
            if FileManager.default.fileExists(atPath: url.path, isDirectory: &isDirectory), isDirectory.boolValue {
                let contents = (try? FileManager.default.contentsOfDirectory(
                    at: url, includingPropertiesForKeys: nil, options: [.skipsHiddenFiles])) ?? []
                result += contents
                    .filter(isVideo)
                    .sorted { $0.lastPathComponent.localizedStandardCompare($1.lastPathComponent) == .orderedAscending }
            } else if isVideo(url) {
                result.append(url)
            }
        }
        return result
    }

    nonisolated static func isVideo(_ url: URL) -> Bool {
        guard let type = UTType(filenameExtension: url.pathExtension) else { return false }
        return type.conforms(to: .movie)
    }

    nonisolated private static func makeItem(from source: URL, videosURL: URL, thumbnailsURL: URL) async throws -> VideoItem {
        let id = UUID()
        let fileExtension = source.pathExtension.isEmpty ? "mov" : source.pathExtension.lowercased()
        let fileName = "\(id.uuidString).\(fileExtension)"
        let destination = videosURL.appendingPathComponent(fileName)

        try FileManager.default.copyItem(at: source, to: destination)
        do {
            let asset = AVURLAsset(url: destination)
            guard try await asset.load(.isPlayable) else { throw LibraryError.notPlayable }
            guard let track = try await asset.loadTracks(withMediaType: .video).first else {
                throw LibraryError.noVideoTrack
            }
            let duration = try await asset.load(.duration).seconds
            let (naturalSize, transform) = try await track.load(.naturalSize, .preferredTransform)
            let size = CGRect(origin: .zero, size: naturalSize).applying(transform).size

            try await writeThumbnail(
                of: asset, duration: duration,
                to: thumbnailsURL.appendingPathComponent("\(id.uuidString).jpg"))

            return VideoItem(
                id: id,
                name: source.deletingPathExtension().lastPathComponent,
                fileName: fileName,
                addedAt: Date(),
                duration: duration.isFinite ? duration : 0,
                width: Int(abs(size.width)),
                height: Int(abs(size.height)))
        } catch {
            try? FileManager.default.removeItem(at: destination)
            throw error
        }
    }

    nonisolated private static func writeThumbnail(of asset: AVAsset, duration: Double, to url: URL) async throws {
        let generator = AVAssetImageGenerator(asset: asset)
        generator.appliesPreferredTrackTransform = true
        generator.maximumSize = CGSize(width: 960, height: 960)
        let seconds = duration.isFinite && duration > 0 ? min(duration * 0.25, 3) : 0
        let image = try await generator.image(at: CMTime(seconds: seconds, preferredTimescale: 600)).image
        guard let data = NSBitmapImageRep(cgImage: image)
            .representation(using: .jpeg, properties: [.compressionFactor: 0.82]) else {
            throw LibraryError.thumbnailFailed
        }
        try data.write(to: url)
    }

    // MARK: - Gestionar

    func rename(_ item: VideoItem, to newName: String) {
        let trimmed = newName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, let index = items.firstIndex(where: { $0.id == item.id }) else { return }
        items[index].name = trimmed
        save()
    }

    /// Quita el video de la biblioteca y manda su copia a la Papelera (el original no se toca).
    func remove(_ item: VideoItem) {
        try? FileManager.default.trashItem(at: videoURL(for: item), resultingItemURL: nil)
        try? FileManager.default.removeItem(at: thumbnailURL(for: item))
        thumbnailCache[item.id] = nil
        items.removeAll { $0.id == item.id }
        save()
    }

    func revealInFinder(_ item: VideoItem) {
        NSWorkspace.shared.activateFileViewerSelecting([videoURL(for: item)])
    }

    /// Guarda un fotograma (a mitad del video, a tamaño completo) como PNG,
    /// para usarlo como imagen fija en la pantalla de bloqueo.
    func exportFrame(of item: VideoItem, to destination: URL) async {
        do {
            try await Self.writeFrame(from: videoURL(for: item), to: destination)
            NSWorkspace.shared.activateFileViewerSelecting([destination])
        } catch {
            lastError = "No se pudo guardar el fotograma: \(error.localizedDescription)"
        }
    }

    nonisolated private static func writeFrame(from source: URL, to destination: URL) async throws {
        let asset = AVURLAsset(url: source)
        let duration = try await asset.load(.duration).seconds
        let generator = AVAssetImageGenerator(asset: asset)
        generator.appliesPreferredTrackTransform = true
        let seconds = duration.isFinite && duration > 0 ? duration / 2 : 0
        let image = try await generator.image(at: CMTime(seconds: seconds, preferredTimescale: 600)).image
        guard let data = NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:]) else {
            throw LibraryError.frameFailed
        }
        try data.write(to: destination)
    }

    nonisolated static func folderSize(_ folder: URL) -> Int64 {
        let enumerator = FileManager.default.enumerator(at: folder, includingPropertiesForKeys: [.totalFileAllocatedSizeKey])
        var total: Int64 = 0
        while let url = enumerator?.nextObject() as? URL {
            total += Int64((try? url.resourceValues(forKeys: [.totalFileAllocatedSizeKey]))?.totalFileAllocatedSize ?? 0)
        }
        return total
    }

    // MARK: - Persistencia

    private func load() {
        guard let data = try? Data(contentsOf: indexURL) else { return }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let stored = (try? decoder.decode([VideoItem].self, from: data)) ?? []
        items = stored.filter { FileManager.default.fileExists(atPath: videoURL(for: $0).path) }
    }

    private func save() {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted]
        guard let data = try? encoder.encode(items) else { return }
        try? data.write(to: indexURL, options: .atomic)
    }
}
