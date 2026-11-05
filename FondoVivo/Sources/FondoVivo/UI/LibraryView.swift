import SwiftUI

struct LibraryView: View {
    @EnvironmentObject private var library: VideoLibrary
    @EnvironmentObject private var settings: AppSettings

    @State private var search = ""
    @State private var isDropTargeted = false
    @State private var renaming: VideoItem?
    @State private var renameText = ""
    @State private var deleting: VideoItem?

    private var filteredItems: [VideoItem] {
        let query = search.trimmingCharacters(in: .whitespaces)
        guard !query.isEmpty else { return library.items }
        return library.items.filter { $0.name.localizedCaseInsensitiveContains(query) }
    }

    private var subtitle: String {
        switch library.items.count {
        case 0: "Añade tus videos para usarlos como fondo de pantalla"
        case 1: "1 video · haz clic para usarlo como fondo"
        default: "\(library.items.count) videos · haz clic en uno para usarlo como fondo"
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            PageHeader(title: "Biblioteca", subtitle: subtitle) {
                if !library.items.isEmpty {
                    SearchField(text: $search).frame(width: 200)
                }
                Button(action: pickVideos) {
                    Label("Añadir videos", systemImage: "plus")
                }
                .buttonStyle(GradientButtonStyle())
            }

            if let error = library.lastError {
                ErrorBanner(text: error) { library.lastError = nil }
                    .padding(.horizontal, 28)
                    .padding(.bottom, 12)
            }

            if library.items.isEmpty && library.importingCount == 0 {
                EmptyLibraryView(isTargeted: isDropTargeted, onAdd: pickVideos)
                    .padding([.horizontal, .bottom], 28)
            } else {
                grid
            }
        }
        .onDrop(of: [.fileURL], isTargeted: $isDropTargeted) { providers in
            importDropped(providers)
            return true
        }
        .alert("Renombrar video", isPresented: Binding(
            get: { renaming != nil },
            set: { if !$0 { renaming = nil } }
        )) {
            TextField("Nombre", text: $renameText)
            Button("Cancelar", role: .cancel) { renaming = nil }
            Button("Guardar") {
                if let renaming { library.rename(renaming, to: renameText) }
                renaming = nil
            }
        }
        .confirmationDialog(
            "¿Eliminar este video de la biblioteca?",
            isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }),
            titleVisibility: .visible,
            presenting: deleting
        ) { item in
            Button("Eliminar «\(item.name)»", role: .destructive) {
                library.remove(item)
                deleting = nil
            }
        } message: { _ in
            Text("Su copia irá a la Papelera. El archivo original no se toca.")
        }
    }

    private var grid: some View {
        ScrollView {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 230, maximum: 380), spacing: 20)], spacing: 22) {
                if library.importingCount > 0 {
                    ImportingCard(count: library.importingCount)
                }
                ForEach(filteredItems) { item in
                    VideoCard(item: item, isActive: settings.isInUse(item.id)) {
                        settings.defaultVideoID = item.id
                    }
                    .contextMenu { contextMenu(for: item) }
                }
            }
            .padding(.horizontal, 28)
            .padding(.top, 4)
            .padding(.bottom, 28)

            if filteredItems.isEmpty && !search.isEmpty {
                Text("No hay videos que coincidan con «\(search)»")
                    .foregroundStyle(.secondary)
                    .padding(.top, 40)
            }
        }
        .overlay {
            if isDropTargeted { DropOverlay() }
        }
    }

    @ViewBuilder
    private func contextMenu(for item: VideoItem) -> some View {
        Button("Usar como fondo general") { settings.defaultVideoID = item.id }
        let screens = NSScreen.screens
        if screens.count > 1 {
            Menu("Usar solo en…") {
                ForEach(screens, id: \.stableID) { screen in
                    Button(screen.localizedName) { settings.screenOverrides[screen.stableID] = item.id }
                }
            }
        }
        Divider()
        Button("Renombrar…") {
            renameText = item.name
            renaming = item
        }
        Button("Mostrar en Finder") { library.revealInFinder(item) }
        Button("Guardar fotograma como imagen…") { saveFrame(item) }
        Divider()
        Button("Eliminar de la biblioteca…", role: .destructive) { deleting = item }
    }

    private func pickVideos() {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.movie]
        panel.allowsMultipleSelection = true
        panel.canChooseDirectories = true
        panel.prompt = "Añadir"
        panel.message = "Elige videos (o carpetas con videos) para tu biblioteca"
        guard panel.runModal() == .OK else { return }
        let urls = panel.urls
        Task { await library.importVideos(from: urls) }
    }

    private func saveFrame(_ item: VideoItem) {
        let panel = NSSavePanel()
        panel.allowedContentTypes = [.png]
        panel.nameFieldStringValue = "\(item.name).png"
        panel.message = "Guarda una imagen fija del video para usarla en la pantalla de bloqueo"
        panel.prompt = "Guardar"
        guard panel.runModal() == .OK, let url = panel.url else { return }
        Task { await library.exportFrame(of: item, to: url) }
    }

    private func importDropped(_ providers: [NSItemProvider]) {
        Task {
            var urls: [URL] = []
            for provider in providers {
                if let url = await provider.loadFileURL() { urls.append(url) }
            }
            await library.importVideos(from: urls)
        }
    }
}

// MARK: - Tarjeta de video

private struct VideoCard: View {
    @EnvironmentObject private var library: VideoLibrary

    let item: VideoItem
    let isActive: Bool
    let onSelect: () -> Void

    @State private var hovering = false
    @State private var showPreview = false
    @State private var previewTask: Task<Void, Never>?

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            ThumbnailView(image: library.thumbnail(for: item))
                .aspectRatio(16 / 9, contentMode: .fit)
                .overlay {
                    if showPreview {
                        LoopingVideoView(url: library.videoURL(for: item))
                            .transition(.opacity)
                    }
                }
                .overlay { overlayContent }
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .strokeBorder(isActive ? AnyShapeStyle(Theme.gradient) : AnyShapeStyle(Color.primary.opacity(0.08)),
                                      lineWidth: isActive ? 3 : 1))
                .shadow(color: .black.opacity(hovering ? 0.28 : 0.12), radius: hovering ? 14 : 6, y: hovering ? 7 : 3)
                .scaleEffect(hovering ? 1.02 : 1)

            VStack(alignment: .leading, spacing: 2) {
                Text(item.name)
                    .font(.system(size: 13, weight: .semibold))
                    .lineLimit(1)
                Text(item.resolutionText)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 2)
        }
        .contentShape(Rectangle())
        .onTapGesture(perform: onSelect)
        .onHover(perform: updateHover)
        .onDisappear { previewTask?.cancel() }
    }

    private var overlayContent: some View {
        ZStack {
            LinearGradient(colors: [.clear, .black.opacity(0.5)], startPoint: .center, endPoint: .bottom)
            VStack {
                HStack {
                    if isActive {
                        Label("En uso", systemImage: "sparkles")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Capsule().fill(Theme.gradient))
                    }
                    Spacer()
                }
                Spacer()
                HStack {
                    Spacer()
                    Text(item.durationText)
                        .font(.system(size: 11, weight: .semibold).monospacedDigit())
                        .foregroundStyle(.white)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Capsule().fill(.black.opacity(0.45)))
                }
            }
            .padding(9)

            if hovering && !isActive {
                Label("Usar como fondo", systemImage: "play.fill")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 7)
                    .background(Capsule().fill(.black.opacity(0.35)))
                    .background(Capsule().fill(.ultraThinMaterial))
                    .transition(.opacity.combined(with: .scale(scale: 0.9)))
            }
        }
    }

    private func updateHover(_ inside: Bool) {
        withAnimation(.easeOut(duration: 0.18)) { hovering = inside }
        previewTask?.cancel()
        guard inside else {
            showPreview = false
            return
        }
        previewTask = Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(350))
            guard !Task.isCancelled else { return }
            withAnimation(.easeIn(duration: 0.25)) { showPreview = true }
        }
    }
}

// MARK: - Piezas auxiliares

private struct ImportingCard: View {
    let count: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color.primary.opacity(0.05))
                .aspectRatio(16 / 9, contentMode: .fit)
                .overlay {
                    VStack(spacing: 10) {
                        ProgressView().controlSize(.regular)
                        Text(count == 1 ? "Importando video…" : "Importando \(count) videos…")
                            .font(.callout)
                            .foregroundStyle(.secondary)
                    }
                }
            Text(" ").font(.system(size: 13))
        }
    }
}

private struct EmptyLibraryView: View {
    let isTargeted: Bool
    let onAdd: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            ZStack {
                Circle()
                    .fill(Theme.gradient)
                    .opacity(0.14)
                    .frame(width: 116, height: 116)
                Image(systemName: "film.stack")
                    .font(.system(size: 46, weight: .light))
                    .foregroundStyle(Theme.gradient)
            }
            Text("Arrastra tus videos aquí")
                .font(.title2.weight(.semibold))
            Text("MP4, MOV o M4V (también carpetas completas).\nSe guarda una copia en tu biblioteca para usarla como fondo animado.")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
            Button(action: onAdd) {
                Label("Elegir videos…", systemImage: "plus")
            }
            .buttonStyle(GradientButtonStyle())
            .padding(.top, 6)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(isTargeted ? Theme.violet.opacity(0.07) : Color.clear))
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .strokeBorder(isTargeted ? Theme.violet : Color.secondary.opacity(0.35),
                              style: StrokeStyle(lineWidth: 2, dash: [8, 6])))
        .animation(.easeOut(duration: 0.15), value: isTargeted)
    }
}

private struct DropOverlay: View {
    var body: some View {
        RoundedRectangle(cornerRadius: 18, style: .continuous)
            .fill(Theme.violet.opacity(0.08))
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .strokeBorder(Theme.violet, style: StrokeStyle(lineWidth: 2, dash: [8, 6])))
            .overlay {
                Label("Suelta para añadir a la biblioteca", systemImage: "square.and.arrow.down")
                    .font(.headline)
                    .foregroundStyle(Theme.violet)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(Capsule().fill(.regularMaterial))
            }
            .padding(16)
            .allowsHitTesting(false)
    }
}

private struct SearchField: View {
    @Binding var text: String

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
            TextField("Buscar", text: $text).textFieldStyle(.plain)
            if !text.isEmpty {
                Button { text = "" } label: {
                    Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(RoundedRectangle(cornerRadius: 8, style: .continuous).fill(Color.primary.opacity(0.06)))
    }
}

private struct ErrorBanner: View {
    let text: String
    let onClose: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(Theme.orange)
            Text(text).font(.callout)
            Spacer()
            Button(action: onClose) {
                Image(systemName: "xmark").font(.system(size: 11, weight: .bold))
            }
            .buttonStyle(.plain)
            .foregroundStyle(.secondary)
        }
        .padding(12)
        .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Theme.orange.opacity(0.12)))
    }
}
