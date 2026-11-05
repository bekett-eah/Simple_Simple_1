import SwiftUI

enum SidebarSection: String, CaseIterable, Identifiable {
    case library, screens, settings

    var id: String { rawValue }

    var title: String {
        switch self {
        case .library: "Biblioteca"
        case .screens: "Pantallas"
        case .settings: "Ajustes"
        }
    }

    var icon: String {
        switch self {
        case .library: "square.grid.2x2.fill"
        case .screens: "display.2"
        case .settings: "gearshape.fill"
        }
    }
}

@MainActor
final class UIState: ObservableObject {
    @Published var section: SidebarSection = .library
}

struct RootView: View {
    @EnvironmentObject private var ui: UIState

    var body: some View {
        HStack(spacing: 0) {
            SidebarView()
                .frame(width: 216)
                .frame(maxHeight: .infinity)
                .background(VisualEffectBackground(material: .sidebar))
            Divider()
            Group {
                switch ui.section {
                case .library: LibraryView()
                case .screens: ScreensView()
                case .settings: SettingsView()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color(nsColor: .windowBackgroundColor))
        }
        .ignoresSafeArea()
        .frame(minWidth: 860, minHeight: 560)
        .tint(Theme.violet)
    }
}

private struct SidebarView: View {
    @EnvironmentObject private var ui: UIState

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 10) {
                Image(nsImage: NSApp.applicationIconImage)
                    .resizable()
                    .frame(width: 36, height: 36)
                VStack(alignment: .leading, spacing: 0) {
                    Text("Fondo Vivo").font(.system(size: 15, weight: .bold))
                    Text("Fondos animados").font(.caption).foregroundStyle(.secondary)
                }
            }
            .padding(.top, 50)
            .padding(.bottom, 18)
            .padding(.horizontal, 4)

            ForEach(SidebarSection.allCases) { section in
                SidebarRow(section: section, isSelected: ui.section == section) {
                    ui.section = section
                }
            }

            Spacer()
            NowPlayingCard()
        }
        .padding(.horizontal, 12)
        .padding(.bottom, 14)
    }
}

private struct SidebarRow: View {
    let section: SidebarSection
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                Image(systemName: section.icon)
                    .font(.system(size: 13, weight: .semibold))
                    .frame(width: 20)
                Text(section.title).font(.system(size: 13, weight: isSelected ? .semibold : .regular))
                Spacer()
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .foregroundStyle(isSelected ? Theme.violet : .primary)
            .background(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(isSelected ? Theme.violet.opacity(0.16) : .clear))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

private struct NowPlayingCard: View {
    @EnvironmentObject private var library: VideoLibrary
    @EnvironmentObject private var settings: AppSettings
    @EnvironmentObject private var wallpapers: WallpaperManager

    var body: some View {
        let current = library.item(withID: settings.defaultVideoID)
        VStack(alignment: .leading, spacing: 9) {
            Text("EN EL ESCRITORIO")
                .font(.system(size: 10, weight: .semibold))
                .tracking(0.6)
                .foregroundStyle(.secondary)

            ThumbnailView(image: current.flatMap(library.thumbnail(for:)))
                .aspectRatio(16 / 9, contentMode: .fit)
                .overlay {
                    if current == nil {
                        Text("Sin fondo").font(.caption).foregroundStyle(.white.opacity(0.7))
                    } else if settings.isPaused {
                        Image(systemName: "pause.fill").font(.title3).foregroundStyle(.white.opacity(0.85))
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))

            Text(current?.name ?? "Elige un video de la biblioteca")
                .font(.system(size: 12, weight: .medium))
                .lineLimit(1)

            HStack(spacing: 8) {
                CircleIconButton(
                    systemName: settings.isPaused ? "play.fill" : "pause.fill",
                    help: settings.isPaused ? "Reanudar" : "Pausar"
                ) { settings.isPaused.toggle() }
                CircleIconButton(systemName: "forward.fill", help: "Siguiente fondo") {
                    wallpapers.nextWallpaper()
                }
                .disabled(library.items.count < 2)
                CircleIconButton(
                    systemName: settings.isMuted ? "speaker.slash.fill" : "speaker.wave.2.fill",
                    help: settings.isMuted ? "Activar sonido" : "Silenciar"
                ) { settings.isMuted.toggle() }
                Spacer()
            }
        }
        .padding(12)
        .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Color.primary.opacity(0.05)))
    }
}
