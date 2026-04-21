import SwiftUI

@main
struct SafeBoxApp: App {
    @StateObject private var coordinator = AppCoordinator(environment: .unconfigured)

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(coordinator)
        }
    }
}

struct RootView: View {
    @EnvironmentObject private var coordinator: AppCoordinator

    var body: some View {
        Group {
            switch coordinator.phase {
            case .signedOut:
                LoginView()
            case .locked:
                UnlockView()
            case .loading:
                LoadingView(message: coordinator.statusMessage)
            case .unlocked:
                VaultListView()
            }
        }
        .animation(.easeInOut(duration: 0.22), value: coordinator.phase)
    }
}

private struct LoadingView: View {
    let message: String

    var body: some View {
        VStack(spacing: 16) {
            ProgressView()
            Text(message)
                .font(.headline)
                .foregroundStyle(.secondary)
        }
        .padding()
    }
}
