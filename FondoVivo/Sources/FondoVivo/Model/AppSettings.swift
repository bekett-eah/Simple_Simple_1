import AVFoundation
import Foundation
import ServiceManagement

enum VideoScaling: String, CaseIterable, Identifiable {
    case fill, fit, stretch

    var id: String { rawValue }

    var title: String {
        switch self {
        case .fill: "Rellenar"
        case .fit: "Ajustar"
        case .stretch: "Estirar"
        }
    }

    var gravity: AVLayerVideoGravity {
        switch self {
        case .fill: .resizeAspectFill
        case .fit: .resizeAspect
        case .stretch: .resize
        }
    }
}

/// Preferencias de la app, guardadas en UserDefaults.
@MainActor
final class AppSettings: ObservableObject {
    private enum Keys {
        static let defaultVideo = "defaultVideoID"
        static let screenOverrides = "screenOverrides"
        static let paused = "isPaused"
        static let muted = "isMuted"
        static let volume = "volume"
        static let scaling = "scaling"
        static let rate = "playbackRate"
        static let pauseCovered = "pauseWhenCovered"
        static let pauseBattery = "pauseOnBattery"
        static let rotation = "rotationMinutes"
        static let shuffle = "rotationShuffle"
        static let launched = "hasLaunchedBefore"
    }

    private let defaults = UserDefaults.standard

    /// Video que se usa en todas las pantallas que no tienen uno propio.
    @Published var defaultVideoID: UUID? {
        didSet { defaults.set(defaultVideoID?.uuidString, forKey: Keys.defaultVideo) }
    }
    /// Video propio por pantalla (clave: UUID de la pantalla).
    @Published var screenOverrides: [String: UUID] {
        didSet { defaults.set(screenOverrides.mapValues(\.uuidString), forKey: Keys.screenOverrides) }
    }
    @Published var isPaused: Bool { didSet { defaults.set(isPaused, forKey: Keys.paused) } }
    @Published var isMuted: Bool { didSet { defaults.set(isMuted, forKey: Keys.muted) } }
    @Published var volume: Double { didSet { defaults.set(volume, forKey: Keys.volume) } }
    @Published var scaling: VideoScaling { didSet { defaults.set(scaling.rawValue, forKey: Keys.scaling) } }
    @Published var playbackRate: Double { didSet { defaults.set(playbackRate, forKey: Keys.rate) } }
    @Published var pauseWhenCovered: Bool { didSet { defaults.set(pauseWhenCovered, forKey: Keys.pauseCovered) } }
    @Published var pauseOnBattery: Bool { didSet { defaults.set(pauseOnBattery, forKey: Keys.pauseBattery) } }
    /// 0 = sin rotación automática.
    @Published var rotationMinutes: Int { didSet { defaults.set(rotationMinutes, forKey: Keys.rotation) } }
    @Published var rotationShuffle: Bool { didSet { defaults.set(rotationShuffle, forKey: Keys.shuffle) } }

    var hasLaunchedBefore: Bool {
        get { defaults.bool(forKey: Keys.launched) }
        set { defaults.set(newValue, forKey: Keys.launched) }
    }

    init() {
        let defaults = UserDefaults.standard
        defaults.register(defaults: [
            Keys.muted: true,
            Keys.volume: 0.5,
            Keys.rate: 1.0,
            Keys.pauseCovered: true,
            Keys.scaling: VideoScaling.fill.rawValue,
        ])
        defaultVideoID = defaults.string(forKey: Keys.defaultVideo).flatMap(UUID.init(uuidString:))
        screenOverrides = ((defaults.dictionary(forKey: Keys.screenOverrides) as? [String: String]) ?? [:])
            .compactMapValues(UUID.init(uuidString:))
        isPaused = defaults.bool(forKey: Keys.paused)
        isMuted = defaults.bool(forKey: Keys.muted)
        volume = defaults.double(forKey: Keys.volume)
        scaling = VideoScaling(rawValue: defaults.string(forKey: Keys.scaling) ?? "") ?? .fill
        playbackRate = defaults.double(forKey: Keys.rate)
        pauseWhenCovered = defaults.bool(forKey: Keys.pauseCovered)
        pauseOnBattery = defaults.bool(forKey: Keys.pauseBattery)
        rotationMinutes = defaults.integer(forKey: Keys.rotation)
        rotationShuffle = defaults.bool(forKey: Keys.shuffle)
    }

    func videoID(forScreen screenID: String) -> UUID? {
        screenOverrides[screenID] ?? defaultVideoID
    }

    func isInUse(_ id: UUID) -> Bool {
        defaultVideoID == id || screenOverrides.values.contains(id)
    }
}

enum LoginItem {
    static var isEnabled: Bool {
        [.enabled, .requiresApproval].contains(SMAppService.mainApp.status)
    }

    static func setEnabled(_ enabled: Bool) throws {
        if enabled {
            try SMAppService.mainApp.register()
        } else {
            try SMAppService.mainApp.unregister()
        }
    }
}
