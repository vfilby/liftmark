import Foundation

// MARK: - YAML Parser
// Lightweight YAML parser handling the subset used by E2E scenario files:
// mappings, sequences, strings, booleans, integers. No anchors/aliases/flow style.

enum YAMLValue {
    case string(String)
    case int(Int)
    case bool(Bool)
    case array([YAMLValue])
    case dictionary([(String, YAMLValue)])  // ordered pairs
    case null

    var stringValue: String? {
        switch self {
        case .string(let s): return s
        case .int(let i): return String(i)
        case .bool(let b): return b ? "true" : "false"
        default: return nil
        }
    }

    var intValue: Int? {
        if case .int(let i) = self { return i }
        return nil
    }

    var boolValue: Bool? {
        if case .bool(let b) = self { return b }
        return nil
    }

    var arrayValue: [YAMLValue]? {
        if case .array(let a) = self { return a }
        return nil
    }

    var dictionaryValue: [(String, YAMLValue)]? {
        if case .dictionary(let d) = self { return d }
        return nil
    }

    subscript(key: String) -> YAMLValue? {
        guard case .dictionary(let pairs) = self else { return nil }
        return pairs.first(where: { $0.0 == key })?.1
    }
}

struct YAMLParser {

    static func parse(_ text: String) -> YAMLValue {
        var lines = text.components(separatedBy: "\n")
        // Strip trailing empty lines
        while lines.last?.trimmingCharacters(in: .whitespaces).isEmpty == true {
            lines.removeLast()
        }
        var index = 0
        return parseValue(lines: lines, index: &index, baseIndent: 0)
    }

    // MARK: - Private

    private static func indentLevel(_ line: String) -> Int {
        var count = 0
        for ch in line {
            if ch == " " { count += 1 }
            else { break }
        }
        return count
    }

    private static func isComment(_ line: String) -> Bool {
        line.trimmingCharacters(in: .whitespaces).hasPrefix("#")
    }

    private static func isBlankOrComment(_ line: String) -> Bool {
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        return trimmed.isEmpty || trimmed.hasPrefix("#")
    }

    private static func skipBlanksAndComments(lines: [String], index: inout Int) {
        while index < lines.count && isBlankOrComment(lines[index]) {
            index += 1
        }
    }

    private static func parseValue(lines: [String], index: inout Int, baseIndent: Int) -> YAMLValue {
        skipBlanksAndComments(lines: lines, index: &index)
        guard index < lines.count else { return .null }

        let line = lines[index]
        let trimmed = line.trimmingCharacters(in: .whitespaces)

        // Check if this is a sequence item at this level
        if trimmed.hasPrefix("- ") || trimmed == "-" {
            return parseArray(lines: lines, index: &index, baseIndent: indentLevel(line))
        }

        // Check if this is a mapping
        if trimmed.contains(": ") || trimmed.hasSuffix(":") {
            return parseDictionary(lines: lines, index: &index, baseIndent: indentLevel(line))
        }

        // Scalar
        index += 1
        return parseScalar(trimmed)
    }

    private static func parseScalar(_ text: String) -> YAMLValue {
        // Remove surrounding quotes
        var s = text
        if (s.hasPrefix("\"") && s.hasSuffix("\"")) || (s.hasPrefix("'") && s.hasSuffix("'")) {
            s = String(s.dropFirst().dropLast())
        }

        // Booleans
        let lower = s.lowercased()
        if lower == "true" || lower == "yes" { return .bool(true) }
        if lower == "false" || lower == "no" { return .bool(false) }

        // Integers
        if let i = Int(s) { return .int(i) }

        // Null
        if lower == "null" || lower == "~" || s.isEmpty { return .null }

        return .string(s)
    }

    private static func parseDictionary(lines: [String], index: inout Int, baseIndent: Int) -> YAMLValue {
        var pairs: [(String, YAMLValue)] = []

        while index < lines.count {
            skipBlanksAndComments(lines: lines, index: &index)
            guard index < lines.count else { break }

            let line = lines[index]
            let indent = indentLevel(line)
            if indent < baseIndent { break }
            if indent != baseIndent { break }

            let trimmed = line.trimmingCharacters(in: .whitespaces)

            // Must be a key: value or key:
            guard let colonRange = findMappingColon(trimmed) else { break }

            let key = String(trimmed[trimmed.startIndex..<colonRange.lowerBound])
                .trimmingCharacters(in: .whitespaces)
            let afterColon = String(trimmed[colonRange.upperBound...])
                .trimmingCharacters(in: .whitespaces)

            if afterColon.isEmpty {
                // Value is on subsequent indented lines
                index += 1
                skipBlanksAndComments(lines: lines, index: &index)
                if index < lines.count {
                    let nextIndent = indentLevel(lines[index])
                    if nextIndent > baseIndent {
                        let value = parseValue(lines: lines, index: &index, baseIndent: nextIndent)
                        pairs.append((key, value))
                    } else {
                        pairs.append((key, .null))
                    }
                } else {
                    pairs.append((key, .null))
                }
            } else if afterColon.hasPrefix("[") && afterColon.hasSuffix("]") {
                // Inline array like tags: ["smoke", "import"]
                index += 1
                let inner = String(afterColon.dropFirst().dropLast())
                if inner.trimmingCharacters(in: .whitespaces).isEmpty {
                    pairs.append((key, .array([])))
                } else {
                    let items = splitFlowArray(inner).map { parseScalar($0.trimmingCharacters(in: .whitespaces)) }
                    pairs.append((key, .array(items)))
                }
            } else {
                // Inline scalar value
                index += 1
                pairs.append((key, parseScalar(afterColon)))
            }
        }

        return .dictionary(pairs)
    }

    private static func parseArray(lines: [String], index: inout Int, baseIndent: Int) -> YAMLValue {
        var items: [YAMLValue] = []

        while index < lines.count {
            skipBlanksAndComments(lines: lines, index: &index)
            guard index < lines.count else { break }

            let line = lines[index]
            let indent = indentLevel(line)
            if indent < baseIndent { break }
            if indent != baseIndent { break }

            let trimmed = line.trimmingCharacters(in: .whitespaces)
            guard trimmed.hasPrefix("- ") || trimmed == "-" else { break }

            // Content after "- "
            let afterDash: String
            if trimmed == "-" {
                afterDash = ""
            } else {
                afterDash = String(trimmed.dropFirst(2))
            }

            if afterDash.isEmpty {
                // Block value on next lines
                index += 1
                skipBlanksAndComments(lines: lines, index: &index)
                if index < lines.count {
                    let nextIndent = indentLevel(lines[index])
                    if nextIndent > baseIndent {
                        let value = parseValue(lines: lines, index: &index, baseIndent: nextIndent)
                        items.append(value)
                    } else {
                        items.append(.null)
                    }
                } else {
                    items.append(.null)
                }
            } else if afterDash.contains(": ") || afterDash.hasSuffix(":") {
                // Inline mapping starting on this line (e.g., "- action: tap")
                // Treat the "- " prefix as extra indent; parse a mapping block
                let itemIndent = baseIndent + 2  // after "- "

                // Rewrite current line without the "- " to parse as mapping
                // But we can parse it more simply: the first key:value is on this line,
                // and subsequent keys at itemIndent follow.
                let key: String
                let afterColon: String
                if let colonRange = findMappingColon(afterDash) {
                    key = String(afterDash[afterDash.startIndex..<colonRange.lowerBound])
                        .trimmingCharacters(in: .whitespaces)
                    afterColon = String(afterDash[colonRange.upperBound...])
                        .trimmingCharacters(in: .whitespaces)
                } else {
                    // Not a mapping, treat as scalar
                    index += 1
                    items.append(parseScalar(afterDash))
                    continue
                }

                var pairs: [(String, YAMLValue)] = []

                if afterColon.isEmpty {
                    // Value on subsequent lines
                    index += 1
                    skipBlanksAndComments(lines: lines, index: &index)
                    if index < lines.count {
                        let nextIndent = indentLevel(lines[index])
                        if nextIndent > itemIndent {
                            let value = parseValue(lines: lines, index: &index, baseIndent: nextIndent)
                            pairs.append((key, value))
                        } else {
                            pairs.append((key, .null))
                        }
                    } else {
                        pairs.append((key, .null))
                    }
                } else if afterColon.hasPrefix("[") && afterColon.hasSuffix("]") {
                    index += 1
                    let inner = String(afterColon.dropFirst().dropLast())
                    if inner.trimmingCharacters(in: .whitespaces).isEmpty {
                        pairs.append((key, .array([])))
                    } else {
                        let arrayItems = splitFlowArray(inner).map { parseScalar($0.trimmingCharacters(in: .whitespaces)) }
                        pairs.append((key, .array(arrayItems)))
                    }
                } else {
                    index += 1
                    pairs.append((key, parseScalar(afterColon)))
                }

                // Continue reading more keys at itemIndent
                while index < lines.count {
                    skipBlanksAndComments(lines: lines, index: &index)
                    guard index < lines.count else { break }
                    let nextLine = lines[index]
                    let nextIndent = indentLevel(nextLine)
                    if nextIndent != itemIndent { break }

                    let nextTrimmed = nextLine.trimmingCharacters(in: .whitespaces)

                    // If it starts with "- ", it's the next array item, not a mapping key
                    if nextTrimmed.hasPrefix("- ") || nextTrimmed == "-" { break }

                    guard let nextColonRange = findMappingColon(nextTrimmed) else { break }

                    let nextKey = String(nextTrimmed[nextTrimmed.startIndex..<nextColonRange.lowerBound])
                        .trimmingCharacters(in: .whitespaces)
                    let nextAfterColon = String(nextTrimmed[nextColonRange.upperBound...])
                        .trimmingCharacters(in: .whitespaces)

                    if nextAfterColon.isEmpty {
                        index += 1
                        skipBlanksAndComments(lines: lines, index: &index)
                        if index < lines.count {
                            let subIndent = indentLevel(lines[index])
                            if subIndent > itemIndent {
                                let value = parseValue(lines: lines, index: &index, baseIndent: subIndent)
                                pairs.append((nextKey, value))
                            } else {
                                pairs.append((nextKey, .null))
                            }
                        } else {
                            pairs.append((nextKey, .null))
                        }
                    } else if nextAfterColon.hasPrefix("[") && nextAfterColon.hasSuffix("]") {
                        index += 1
                        let inner = String(nextAfterColon.dropFirst().dropLast())
                        if inner.trimmingCharacters(in: .whitespaces).isEmpty {
                            pairs.append((nextKey, .array([])))
                        } else {
                            let arrayItems = splitFlowArray(inner).map { parseScalar($0.trimmingCharacters(in: .whitespaces)) }
                            pairs.append((nextKey, .array(arrayItems)))
                        }
                    } else {
                        index += 1
                        pairs.append((nextKey, parseScalar(nextAfterColon)))
                    }
                }

                items.append(.dictionary(pairs))
            } else {
                // Simple scalar item
                index += 1
                items.append(parseScalar(afterDash))
            }
        }

        return .array(items)
    }

    /// Find the first `: ` or trailing `:` that represents a mapping separator.
    /// Skips colons inside quoted strings.
    private static func findMappingColon(_ text: String) -> Range<String.Index>? {
        var inSingleQuote = false
        var inDoubleQuote = false
        var i = text.startIndex

        while i < text.endIndex {
            let ch = text[i]

            if ch == "'" && !inDoubleQuote {
                inSingleQuote.toggle()
            } else if ch == "\"" && !inSingleQuote {
                inDoubleQuote.toggle()
            } else if ch == ":" && !inSingleQuote && !inDoubleQuote {
                let next = text.index(after: i)
                if next == text.endIndex {
                    // Trailing colon
                    return i..<next
                } else if text[next] == " " {
                    // ": " separator
                    return i..<text.index(next, offsetBy: 1)
                }
            }

            i = text.index(after: i)
        }

        return nil
    }

    /// Split a flow-style array string (contents between [ and ]) respecting quotes.
    private static func splitFlowArray(_ text: String) -> [String] {
        var items: [String] = []
        var current = ""
        var inSingleQuote = false
        var inDoubleQuote = false

        for ch in text {
            if ch == "'" && !inDoubleQuote {
                inSingleQuote.toggle()
                current.append(ch)
            } else if ch == "\"" && !inSingleQuote {
                inDoubleQuote.toggle()
                current.append(ch)
            } else if ch == "," && !inSingleQuote && !inDoubleQuote {
                items.append(current)
                current = ""
            } else {
                current.append(ch)
            }
        }
        if !current.trimmingCharacters(in: .whitespaces).isEmpty {
            items.append(current)
        }
        return items
    }
}
