import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var settings: AppSettings
    @EnvironmentObject private var library: VideoLibrary

    @State private var launchAtLogin = LoginItem.isEnabled
    @State private var loginError: String?
    @State private var diskUsage = "Calculando…"

    private let rates: [Double] = [0.5, 0.75, 1, 1.25, 1.5, 2]
    private let rotationOptions: [(minutes: Int, title: String)] = [
        (0, "Nunca"), (5, "Cada 5 minutos"), (15, "Cada 15 minutos"),
        (30, "Cada 30 minutos"), (60, "Cada hora"), (180, "Cada 3 horas"),
    ]

    var body: some View {
        VStack(spacing: 0) {
            PageHeader(title: "Ajustes", subtitle: "Cómo se reproducen tus fondos")

            Form {
                Section("Reproducción") {
                    Picker("Ajuste del video", selection: $settings.scaling) {
                        ForEach(VideoScaling.allCases) { Text($0.title).tag($0) }
                    }
                    .pickerStyle(.segmented)

                    Picker("Velocidad", selection: $settings.playbackRate) {
                        ForEach(rates, id: \.self) { rate in
                            Text("\(rate.formatted(.number.precision(.fractionLength(0...2))))×").tag(rate)
                        }
                    }

                    Toggle("Silenciar audio", isOn: $settings.isMuted)
                    LabeledContent("Volumen") {
                        HStack {
                            Image(systemName: "speaker.fill").foregroundStyle(.secondary)
                            Slider(value: $settings.volume, in: 0...1)
                            Image(systemName: "speaker.wave.3.fill").foregroundStyle(.secondary)
                        }
                    }
                    .disabled(settings.isMuted)
                }

                Section {
                    Picker("Cambiar de fondo", selection: $settings.rotationMinutes) {
                        ForEach(rotationOptions, id: \.minutes) { Text($0.title).tag($0.minutes) }
                    }
                    Toggle("Orden aleatorio", isOn: $settings.rotationShuffle)
                        .disabled(settings.rotationMinutes == 0)
                } header: {
                    Text("Rotación automática")
                } footer: {
                    Text("Recorre los videos de tu biblioteca como fondo general.")
                        .foregroundStyle(.secondary)
                }

                Section {
                    Toggle("Pausar cuando las ventanas tapan el escritorio", isOn: $settings.pauseWhenCovered)
                    Toggle("Pausar al usar la batería", isOn: $settings.pauseOnBattery)
                } header: {
                    Text("Ahorro de energía")
                } footer: {
                    Text("El video también se pausa solo cuando la pantalla se apaga o bloqueas la sesión.")
                        .foregroundStyle(.secondary)
                }

                Section {
                    Toggle("Abrir Fondo Vivo al iniciar sesión", isOn: $launchAtLogin)
                    LabeledContent("Biblioteca") {
                        HStack(spacing: 10) {
                            Text(diskUsage).foregroundStyle(.secondary)
                            Button("Mostrar en Finder") { NSWorkspace.shared.open(library.folderURL) }
                        }
                    }
                } header: {
                    Text("General")
                } footer: {
                    if let loginError {
                        Text(loginError).foregroundStyle(Theme.orange)
                    }
                }
            }
            .formStyle(.grouped)
            .scrollContentBackground(.hidden)
            .padding(.horizontal, 12)
        }
        .onChange(of: launchAtLogin) { _, enabled in
            guard enabled != LoginItem.isEnabled else { return }
            do {
                try LoginItem.setEnabled(enabled)
                loginError = nil
            } catch {
                loginError = "No se pudo cambiar el inicio automático: \(error.localizedDescription)"
                launchAtLogin = LoginItem.isEnabled
            }
        }
        .task(id: library.items.count) {
            let folder = library.folderURL
            let bytes = await Task.detached { VideoLibrary.folderSize(folder) }.value
            diskUsage = ByteCountFormatter.string(fromByteCount: bytes, countStyle: .file)
        }
    }
}
