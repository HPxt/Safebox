import Foundation

extension Data {
    init?(hex: String) {
        guard hex.count % 2 == 0 else {
            return nil
        }

        var bytes: [UInt8] = []
        bytes.reserveCapacity(hex.count / 2)
        var index = hex.startIndex
        while index < hex.endIndex {
            let next = hex.index(index, offsetBy: 2)
            let chunk = hex[index..<next]
            guard let byte = UInt8(chunk, radix: 16) else {
                return nil
            }
            bytes.append(byte)
            index = next
        }
        self.init(bytes)
    }
}
