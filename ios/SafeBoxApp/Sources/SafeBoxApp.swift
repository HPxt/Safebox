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
    @Environment(\.scenePhase) private var scenePhase
    @State private var privacyShieldVisible = false

    private let inactivityPoll = Timer.publish(every: 30, on: .main, in: .common).autoconnect()

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
                    .onReceive(inactivityPoll) { _ in
                        coordinator.checkInactivityLock()
                    }
            }
        }
        .overlay {
            if privacyShieldVisible {
                PrivacyShieldView()
            }
        }
        .animation(.easeInOut(duration: 0.22), value: coordinator.phase)
        .onChange(of: scenePhase) { newPhase in
            if newPhase == .active {
                privacyShieldVisible = false
                coordinator.handleSceneBecameActive()
            } else if newPhase == .inactive {
                privacyShieldVisible = coordinator.phase != .signedOut
            } else if newPhase == .background {
                privacyShieldVisible = true
                coordinator.handleSceneMovedToBackground()
            }
        }
    }
}

private struct PrivacyShieldView: View {
    var body: some View {
        ZStack {
            Color(.systemBackground)
                .ignoresSafeArea()
            VStack(spacing: 12) {
                Image(systemName: "lock.shield.fill")
                    .font(.system(size: 44, weight: .semibold))
                    .foregroundStyle(.blue)
                Text("SafeBox")
                    .font(.system(.title2, design: .rounded, weight: .bold))
                    .foregroundStyle(.primary)
            }
        }
        .accessibilityHidden(true)
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
