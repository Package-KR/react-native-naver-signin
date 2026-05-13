import Foundation

enum RNNaverError {
  typealias ParsedError = (code: String, message: String, sdkMessage: String?)

  // 에러 코드
  private enum Code {
    static let agreementFailed = "NAVER_AGREEMENT_FAILED"
    static let deleteFailed = "NAVER_DELETE_FAILED"
    static let invalidClient = "NAVER_INVALID_CLIENT"
    static let loginFailed = "NAVER_LOGIN_FAILED"
    static let misconfigured = "NAVER_MISCONFIGURED"
    static let notLoggedIn = "NAVER_NOT_LOGGED_IN"
    static let profileFailed = "NAVER_PROFILE_FAILED"
    static let requestInProgress = "NAVER_REQUEST_IN_PROGRESS"
    static let requestTimeout = "NAVER_REQUEST_TIMEOUT"
    static let unknown = "NAVER_ERROR"
  }

  // 에러 메시지
  private enum Message {
    static let agreementFailed = "Failed to fetch the Naver agreement information."
    static let deleteFailed = "Failed to delete the Naver account connection."
    static let invalidClient = "The Naver iOS app configuration is invalid. Please check client ID, client secret, URL scheme, and bundle ID settings."
    static let loginFailed = "Naver login failed."
    static let misconfigured = "The Naver iOS configuration is invalid. Please check NAVER_CLIENT_ID, NAVER_CLIENT_SECRET, NAVER_URL_SCHEME, and URL Types."
    static let notLoggedIn = "Sign-in is required."
    static let profileFailed = "Failed to fetch the Naver profile."
    static let requestInProgress = "A Naver request is already in progress."
    static let requestTimeout = "The Naver request timed out."
    static let unknown = "An error occurred while processing the Naver request."
  }

  // 설정 누락
  static func misconfigured() -> ParsedError {
    return make(Code.misconfigured, Message.misconfigured)
  }

  // 로그인 필요
  static func notLoggedIn() -> ParsedError {
    return make(Code.notLoggedIn, Message.notLoggedIn)
  }

  // 로그인 실패
  static func loginFailed(_ message: String?) -> ParsedError {
    return make(Code.loginFailed, Message.loginFailed, normalized(message))
  }

  // 앱 설정 오류
  static func invalidClient(_ message: String?) -> ParsedError {
    return make(Code.invalidClient, Message.invalidClient, normalized(message))
  }

  // 연결 해제 실패
  static func deleteFailed(_ message: String?) -> ParsedError {
    return make(Code.deleteFailed, Message.deleteFailed, normalized(message))
  }

  // 프로필 조회 실패
  static func profileFailed(_ message: String?) -> ParsedError {
    return make(Code.profileFailed, Message.profileFailed, normalized(message))
  }

  // 동의 항목 조회 실패
  static func agreementFailed(_ message: String?) -> ParsedError {
    return make(Code.agreementFailed, Message.agreementFailed, normalized(message))
  }

  // 진행 중 요청
  static func requestInProgress() -> ParsedError {
    return make(Code.requestInProgress, Message.requestInProgress)
  }

  // 요청 타임아웃
  static func requestTimeout() -> ParsedError {
    return make(Code.requestTimeout, Message.requestTimeout)
  }

  // SDK 에러 해석
  static func parse(_ error: Error?, fallback: ParsedError) -> ParsedError {
    guard let error = error else {
      return fallback
    }

    let ns = error as NSError
    let sdkMessage = normalized(ns.localizedDescription)
    let code = resolveCode(ns, sdkMessage)
    let message = code == Code.invalidClient ? Message.invalidClient : fallback.message

    return make(code, message, sdkMessage)
  }

  // SDK 원문 에러를 라이브러리 에러 코드로 변환
  private static func resolveCode(_ error: NSError, _ sdkMessage: String?) -> String {
    let lowercased = sdkMessage?.lowercased() ?? ""

    if lowercased.contains("client") ||
       lowercased.contains("bundle") ||
       lowercased.contains("scheme") ||
       lowercased.contains("redirect") {
      return Code.invalidClient
    }

    return "\(Code.unknown)_\(error.code)"
  }

  // 에러 생성
  private static func make(_ code: String, _ message: String, _ sdkMessage: String? = nil) -> ParsedError {
    return (code: code, message: message, sdkMessage: sdkMessage)
  }

  private static func normalized(_ value: String?) -> String? {
    guard let value = value else {
      return nil
    }

    let normalized = value.trimmingCharacters(in: .whitespacesAndNewlines)
    return normalized.isEmpty ? nil : normalized
  }
}
