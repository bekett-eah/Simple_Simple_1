import Foundation

struct VideoItem: Codable, Identifiable, Hashable {
    let id: UUID
    var name: String
    let fileName: String
    let addedAt: Date
    let duration: Double
    let width: Int
    let height: Int

    var durationText: String {
        let total = Int(duration.rounded())
        if total >= 3600 {
            return String(format: "%d:%02d:%02d", total / 3600, total / 60 % 60, total % 60)
        }
        return String(format: "%d:%02d", total / 60, total % 60)
    }

    var qualityLabel: String? {
        switch min(width, height) {
        case 2160...: "4K"
        case 1440..<2160: "QHD"
        case 1080..<1440: "Full HD"
        case 720..<1080: "HD"
        default: nil
        }
    }

    var resolutionText: String {
        [qualityLabel, "\(width)×\(height)"].compactMap { $0 }.joined(separator: " · ")
    }
}
