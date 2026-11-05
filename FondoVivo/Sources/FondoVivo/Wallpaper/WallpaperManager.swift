import AppKit
import Combine
import IOKit.ps

extension Notification.Name {
    static let powerSourceDidChange = Notification.Name("FondoVivoPowerSourceDidChange")
}

/// Mantiene una ventana de fondo por pantalla y decide qué video reproduce cada una y cuándo pausar.
@MainActor
final class WallpaperManager: ObservableObject {
    private let library: VideoLibrary
    private let settings: AppSettings
    private var windows: [String: WallpaperWindow] = [:]
    private var cancellables = Set<AnyCancellable>()

    private var screensAsleep = false
    private var sessionActive = true
    private var onBattery = false
    private var powerSource: CFRunLoopSource?
    private var rotationTimer: Timer?
    private var activeRotationMinutes = 0

    init(library: VideoLibrary, settings: AppSettings) {
        self.library = library
        self.settings = settings
    }

    func start() {
        settings.objectWillChange
            .merge(with: library.objectWillChange)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in self?.apply() }
            .store(in: &cancellables)

        library.$items
            .receive(on: DispatchQueue.main)
            .sink { [weak self] items in self?.forgetMissingVideos(items) }
            .store(in: &cancellables)

        NotificationCenter.default.publisher(for: NSApplication.didChangeScreenParametersNotification)
            .sink { [weak self] _ in self?.apply() }
            .store(in: &cancellables)
        NotificationCenter.default.publisher(for: .powerSourceDidChange)
            .sink { [weak self] _ in self?.updatePowerState() }
            .store(in: &cancellables)

        let workspace = NSWorkspace.shared.notificationCenter
        observe(workspace, NSWorkspace.screensDidSleepNotification) { $0.screensAsleep = true }
        observe(workspace, NSWorkspace.screensDidWakeNotification) { $0.screensAsleep = false }
        observe(workspace, NSWorkspace.sessionDidResignActiveNotification) { $0.sessionActive = false }
        observe(workspace, NSWorkspace.sessionDidBecomeActiveNotification) { $0.sessionActive = true }

        startPowerMonitoring()
        apply()
    }

    func nextWallpaper() {
        let items = library.items
        guard items.count > 1 else { return }
        if settings.rotationShuffle {
            settings.defaultVideoID = items.filter { $0.id != settings.defaultVideoID }.randomElement()?.id
        } else {
            let index = items.firstIndex { $0.id == settings.defaultVideoID } ?? -1
            settings.defaultVideoID = items[(index + 1) % items.count].id
        }
    }

    // MARK: - Aplicar estado

    private func apply() {
        syncWindows()
        let primaryID = NSScreen.screens.first?.stableID
        for (screenID, window) in windows {
            let url = library.item(withID: settings.videoID(forScreen: screenID)).map(library.videoURL(for:))
            window.playerView.show(url: url)
            window.playerView.configure(
                gravity: settings.scaling.gravity,
                // El audio solo suena en la pantalla principal para no duplicarlo.
                muted: settings.isMuted || screenID != primaryID,
                volume: Float(settings.volume),
                rate: Float(settings.playbackRate),
                playing: shouldPlay(window))
        }
        updateRotationTimer()
    }

    private func shouldPlay(_ window: WallpaperWindow) -> Bool {
        !settings.isPaused
            && !screensAsleep
            && sessionActive
            && !(settings.pauseOnBattery && onBattery)
            && !(settings.pauseWhenCovered && window.isCovered)
    }

    private func syncWindows() {
        let screens = NSScreen.screens
        let screenIDs = Set(screens.map(\.stableID))
        for (id, window) in windows where !screenIDs.contains(id) {
            window.playerView.show(url: nil)
            window.close()
            windows[id] = nil
        }
        for screen in screens {
            let id = screen.stableID
            if let window = windows[id] {
                if window.frame != screen.frame { window.setFrame(screen.frame, display: true) }
            } else {
                let window = WallpaperWindow(screen: screen)
                window.onOcclusionChange = { [weak self] in self?.apply() }
                window.orderFrontRegardless()
                windows[id] = window
            }
        }
    }

    private func forgetMissingVideos(_ items: [VideoItem]) {
        let ids = Set(items.map(\.id))
        if let id = settings.defaultVideoID, !ids.contains(id) {
            settings.defaultVideoID = nil
        }
        let overrides = settings.screenOverrides.filter { ids.contains($0.value) }
        if overrides != settings.screenOverrides {
            settings.screenOverrides = overrides
        }
    }

    private func updateRotationTimer() {
        let minutes = settings.rotationMinutes
        guard minutes != activeRotationMinutes else { return }
        activeRotationMinutes = minutes
        rotationTimer?.invalidate()
        rotationTimer = nil
        guard minutes > 0 else { return }
        rotationTimer = Timer.scheduledTimer(withTimeInterval: TimeInterval(minutes * 60), repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self, !self.settings.isPaused else { return }
                self.nextWallpaper()
            }
        }
    }

    // MARK: - Eventos del sistema

    private func observe(
        _ center: NotificationCenter, _ name: Notification.Name,
        update: @escaping @MainActor (WallpaperManager) -> Void
    ) {
        center.publisher(for: name)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                guard let self else { return }
                update(self)
                self.apply()
            }
            .store(in: &cancellables)
    }

    private func startPowerMonitoring() {
        guard powerSource == nil,
              let source = IOPSNotificationCreateRunLoopSource({ _ in
                  NotificationCenter.default.post(name: .powerSourceDidChange, object: nil)
              }, nil)?.takeRetainedValue()
        else { return }
        CFRunLoopAddSource(CFRunLoopGetMain(), source, .commonModes)
        powerSource = source
        updatePowerState()
    }

    private func updatePowerState() {
        var isOnBattery = false
        if let info = IOPSCopyPowerSourcesInfo()?.takeRetainedValue(),
           let type = IOPSGetProvidingPowerSourceType(info)?.takeUnretainedValue() {
            isOnBattery = (type as String) == kIOPSBatteryPowerValue
        }
        guard isOnBattery != onBattery else { return }
        onBattery = isOnBattery
        apply()
    }

    // MARK: - Diagnóstico

    var windowNumbers: [Int] { windows.values.map(\.windowNumber) }

    var diagnostics: [[String: Any]] {
        windows.map { id, window in
            var info: [String: Any] = [
                "pantalla": id,
                "marco": NSStringFromRect(window.frame),
                "nivel": window.level.rawValue,
                "visible": window.isVisible,
                "tapada": window.isCovered,
                "reproduciendo": shouldPlay(window),
            ]
            info.merge(window.playerView.diagnostics) { old, _ in old }
            return info
        }
    }
}
