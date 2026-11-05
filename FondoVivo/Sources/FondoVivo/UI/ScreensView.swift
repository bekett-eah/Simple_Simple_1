import SwiftUI

struct ScreenInfo: Identifiable {
    let id: String
    let name: String
    let resolution: String
    let isPrimary: Bool
    let aspectRatio: CGFloat

    @MainActor
    static func all() -> [ScreenInfo] {
        NSScreen.screens.enumerated().map { index, screen in
            let size = screen.frame.size
            let scale = screen.backingScaleFactor
            return ScreenInfo(
                id: screen.stableID,
                name: screen.localizedName,
                resolution: "\(Int(size.width * scale))×\(Int(size.height * scale))",
                isPrimary: index == 0,
                aspectRatio: size.width / max(size.height, 1))
        }
    }
}

struct ScreensView: View {
    @EnvironmentObject private var library: VideoLibrary
    @EnvironmentObject private var settings: AppSettings
    @State private var screens = ScreenInfo.all()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                PageHeader(
                    title: "Pantallas",
                    subtitle: "Usa el fondo general en todas o elige uno distinto para cada monitor.")

                VStack(alignment: .leading, spacing: 16) {
                    ScreenRow(
                        title: "Fondo general",
                        subtitle: "Se usa en todas las pantallas sin fondo propio",
                        badge: nil,
                        aspectRatio: 16 / 10,
                        selection: $settings.defaultVideoID,
                        emptyOption: "Ninguno (fondo de macOS)")

                    Text("TUS PANTALLAS")
                        .font(.system(size: 11, weight: .semibold))
                        .tracking(0.6)
                        .foregroundStyle(.secondary)
                        .padding(.top, 10)

                    ForEach(screens) { screen in
                        ScreenRow(
                            title: screen.name,
                            subtitle: screen.resolution,
                            badge: screen.isPrimary ? "Principal" : nil,
                            aspectRatio: screen.aspectRatio,
                            selection: overrideBinding(for: screen.id),
                            emptyOption: "Igual que el fondo general")
                    }
                }
                .padding(.horizontal, 28)
                .padding(.bottom, 28)
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: NSApplication.didChangeScreenParametersNotification)) { _ in
            screens = ScreenInfo.all()
        }
    }

    private func overrideBinding(for screenID: String) -> Binding<UUID?> {
        Binding(
            get: { settings.screenOverrides[screenID] },
            set: { settings.screenOverrides[screenID] = $0 })
    }
}

private struct ScreenRow: View {
    @EnvironmentObject private var library: VideoLibrary
    @EnvironmentObject private var settings: AppSettings

    let title: String
    let subtitle: String
    let badge: String?
    let aspectRatio: CGFloat
    @Binding var selection: UUID?
    let emptyOption: String

    /// Lo que se ve realmente en la pantalla (si no tiene fondo propio, el general).
    private var shownVideo: VideoItem? {
        library.item(withID: selection ?? settings.defaultVideoID)
    }

    var body: some View {
        HStack(spacing: 22) {
            MonitorPreview(image: shownVideo.flatMap(library.thumbnail(for:)), aspectRatio: aspectRatio)
                .frame(width: 190)

            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 8) {
                    Text(title).font(.headline)
                    if let badge {
                        Text(badge)
                            .font(.system(size: 10, weight: .semibold))
                            .padding(.horizontal, 7)
                            .padding(.vertical, 2)
                            .background(Capsule().fill(Theme.violet.opacity(0.15)))
                            .foregroundStyle(Theme.violet)
                    }
                }
                Text(subtitle).font(.callout).foregroundStyle(.secondary)
                Picker("Fondo", selection: $selection) {
                    Text(emptyOption).tag(UUID?.none)
                    if !library.items.isEmpty { Divider() }
                    ForEach(library.items) { item in
                        Text(item.name).tag(UUID?.some(item.id))
                    }
                }
                .labelsHidden()
                .frame(maxWidth: 320)
            }
            Spacer(minLength: 0)
        }
        .padding(16)
        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color.primary.opacity(0.04)))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Color.primary.opacity(0.07)))
    }
}

private struct MonitorPreview: View {
    let image: NSImage?
    let aspectRatio: CGFloat

    var body: some View {
        VStack(spacing: 0) {
            ThumbnailView(image: image)
                .aspectRatio(aspectRatio, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: 4, style: .continuous))
                .padding(5)
                .background(RoundedRectangle(cornerRadius: 8, style: .continuous).fill(Color(white: 0.12)))
            Rectangle()
                .fill(Color(white: 0.55))
                .frame(width: 26, height: 12)
            Capsule()
                .fill(Color(white: 0.45))
                .frame(width: 64, height: 5)
        }
    }
}
