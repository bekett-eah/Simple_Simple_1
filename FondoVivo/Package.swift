// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "FondoVivo",
    platforms: [.macOS(.v14)],
    targets: [
        .executableTarget(
            name: "FondoVivo",
            path: "Sources/FondoVivo"
        )
    ]
)
