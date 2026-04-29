import SafeBoxCrypto
import SwiftUI

struct VaultItemFormView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var draft: VaultCredentialDraft
    let mode: Mode
    let onSave: (VaultCredentialDraft) async -> Void

    enum Mode {
        case create
        case edit

        var title: String {
            switch self {
            case .create:
                return "Novo item"
            case .edit:
                return "Editar item"
            }
        }
    }

    init(mode: Mode, draft: VaultCredentialDraft, onSave: @escaping (VaultCredentialDraft) async -> Void) {
        self.mode = mode
        self._draft = State(initialValue: draft)
        self.onSave = onSave
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Identificacao") {
                    TextField("Titulo", text: $draft.title)
                        .textContentType(.name)
                    TextField("Usuario", text: $draft.username)
                        .textContentType(.username)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled(true)
                    TextField("Site", text: $draft.website)
                        .textContentType(.URL)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled(true)
                }

                Section("Senha") {
                    SecureField("Senha", text: $draft.password)
                        .textContentType(.password)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled(true)
                } footer: {
                    Text("A senha fica criptografada dentro do cofre antes de sair do aparelho.")
                }

                Section("Notas") {
                    TextEditor(text: $draft.notes)
                        .frame(minHeight: 96)
                        .textInputAutocapitalization(.sentences)
                }
            }
            .navigationTitle(mode.title)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Salvar") {
                        Task {
                            await onSave(draft)
                            dismiss()
                        }
                    }
                    .disabled(!draft.isValidForSave)
                }
            }
        }
    }
}
