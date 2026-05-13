import Foundation
import NaverThirdPartyLogin

@objc(RNNaverSignin)
class RNNaverSignin: NSObject {
  private static var isConfigured = false
  private static let configurationQueue = DispatchQueue(label: "kr.packagekr.naver.signin.configuration")
  // URL 콜백 브리지
  private static let openUrlReceiveTypeNotification = Notification.Name("RNNaverSigninReceiveType")
  private static let profileEndpoint = URL(string: "https://openapi.naver.com/v1/nid/me")
  private static let agreementEndpoint = URL(string: "https://openapi.naver.com/v1/nid/agreement")

  // 현재 인증 작업 상태
  private enum PendingOperation {
    case login
    case deleteAccount
  }

  private var pendingResolve: RCTPromiseResolveBlock?
  private var pendingReject: RCTPromiseRejectBlock?
  private var pendingOperation: PendingOperation?
  private var pendingTimeout: DispatchWorkItem?

  // 모듈 초기화
  public override init() {
    super.init()
    Self.configureNaverSdkIfNeeded()
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(handleOpenUrlReceiveType(_:)),
      name: Self.openUrlReceiveTypeNotification,
      object: nil
    )
  }

  deinit {
    NotificationCenter.default.removeObserver(self)
  }

  // SDK 초기화
  @discardableResult
  private static func configureNaverSdkIfNeeded() -> Bool {
    return configurationQueue.sync {
      if isConfigured {
        return true
      }

      guard let conn = NaverThirdPartyLoginConnection.getSharedInstance(),
            let clientId = Bundle.main.object(forInfoDictionaryKey: "NAVER_CLIENT_ID") as? String,
            !clientId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
            let clientSecret = Bundle.main.object(forInfoDictionaryKey: "NAVER_CLIENT_SECRET") as? String,
            !clientSecret.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
            let scheme = RNNaverSigninHelper.resolveServiceUrlScheme(
              configuredScheme: Bundle.main.object(forInfoDictionaryKey: "NAVER_URL_SCHEME") as? String,
              clientId: clientId
            )
      else {
        return false
      }

      // 네이버 앱 인증 옵션
      conn.isNaverAppOauthEnable = !RNNaverSigninHelper.resolveBool("NAVER_DISABLE_NAVER_APP_AUTH_IOS")
      conn.isInAppOauthEnable = true
      conn.consumerKey = clientId
      conn.consumerSecret = clientSecret

      if let appName = RNNaverSigninHelper.resolveAppName() {
        conn.appName = appName
      }
      conn.serviceUrlScheme = scheme

      isConfigured = true
      return true
    }
  }

  // 메인 큐 초기화
  @objc static func requiresMainQueueSetup() -> Bool { true }

  // 네이버 로그인 URL 확인
  @objc(isNaverLoginUrl:)
  static func isNaverLoginUrl(_ url: URL) -> Bool {
    guard let clientId = Bundle.main.object(forInfoDictionaryKey: "NAVER_CLIENT_ID") as? String,
          let scheme = RNNaverSigninHelper.resolveServiceUrlScheme(
            configuredScheme: Bundle.main.object(forInfoDictionaryKey: "NAVER_URL_SCHEME") as? String,
            clientId: clientId
          ) else { return false }

    return url.scheme == scheme
  }

  // 네이버 로그인 URL 처리
  @objc(handleOpenUrl:)
  static func handleOpenUrl(_ url: URL) -> Bool {
    guard isNaverLoginUrl(url), configureNaverSdkIfNeeded() else { return false }

    let result = NaverThirdPartyLoginConnection.getSharedInstance()?.receiveAccessToken(url)
    if let rawValue = result?.rawValue, rawValue != 0 {
      NotificationCenter.default.post(
        name: openUrlReceiveTypeNotification,
        object: nil,
        userInfo: ["rawValue": rawValue]
      )
    }

    return true
  }

  // 로그인
  @objc(login:reject:)
  func login(_ resolve: @escaping RCTPromiseResolveBlock,
             reject: @escaping RCTPromiseRejectBlock) {
    runConfiguredOnMain(reject) {
      guard self.beginOperation(.login, resolve, reject) else { return }

      let conn = NaverThirdPartyLoginConnection.getSharedInstance()
      conn?.delegate = self
      conn?.requestThirdPartyLogin()
    }
  }

  // 로그아웃
  @objc(logout:reject:)
  func logout(_ resolve: @escaping RCTPromiseResolveBlock,
              reject: @escaping RCTPromiseRejectBlock) {
    runConfiguredOnMain(reject) {
      guard self.ensureNoPendingOperation(reject) else { return }

      NaverThirdPartyLoginConnection.getSharedInstance()?.resetToken()
      resolve("Successfully logged out")
    }
  }

  // 회원탈퇴
  @objc(deleteAccount:reject:)
  func deleteAccount(_ resolve: @escaping RCTPromiseResolveBlock,
                     reject: @escaping RCTPromiseRejectBlock) {
    runConfiguredOnMain(reject) {
      guard self.beginOperation(.deleteAccount, resolve, reject) else { return }

      let conn = NaverThirdPartyLoginConnection.getSharedInstance()
      conn?.delegate = self
      conn?.requestDeleteToken()
    }
  }

  // 프로필 조회
  @objc(getProfile:reject:)
  func getProfile(_ resolve: @escaping RCTPromiseResolveBlock,
                  reject: @escaping RCTPromiseRejectBlock) {
    runConfiguredOnMain(reject) {
      guard self.ensureNoPendingOperation(reject) else { return }

      guard let accessToken = RNNaverSigninHelper.normalized(
        NaverThirdPartyLoginConnection.getSharedInstance()?.accessToken
      ) else {
        self.rejectParsed(reject, RNNaverError.notLoggedIn())
        return
      }

      self.requestProfile(accessToken: accessToken, resolve: resolve, reject: reject)
    }
  }

  // 동의 항목 조회
  @objc(getAgreement:reject:)
  func getAgreement(_ resolve: @escaping RCTPromiseResolveBlock,
                    reject: @escaping RCTPromiseRejectBlock) {
    runConfiguredOnMain(reject) {
      guard self.ensureNoPendingOperation(reject) else { return }

      guard let accessToken = RNNaverSigninHelper.normalized(
        NaverThirdPartyLoginConnection.getSharedInstance()?.accessToken
      ) else {
        self.rejectParsed(reject, RNNaverError.notLoggedIn())
        return
      }

      self.requestAgreement(accessToken: accessToken, resolve: resolve, reject: reject)
    }
  }

  // 설정 확인 후 메인 스레드 실행
  private func runConfiguredOnMain(
    _ reject: @escaping RCTPromiseRejectBlock,
    _ action: @escaping () -> Void
  ) {
    DispatchQueue.main.async {
      guard Self.configureNaverSdkIfNeeded() else {
        self.rejectParsed(reject, RNNaverError.misconfigured())
        return
      }

      action()
    }
  }

  // 프로필 REST API 요청
  private func requestProfile(
    accessToken: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let url = Self.profileEndpoint else {
      rejectParsed(reject, RNNaverError.profileFailed("Invalid URL"))
      return
    }

    var request = URLRequest(url: url)
    request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")

    URLSession.shared.dataTask(with: request) { data, response, error in
      self.handleProfileResponse(data: data, response: response, error: error, resolve: resolve, reject: reject)
    }.resume()
  }

  // 동의 항목 REST API 요청
  private func requestAgreement(
    accessToken: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let url = Self.agreementEndpoint else {
      rejectParsed(reject, RNNaverError.agreementFailed("Invalid URL"))
      return
    }

    var request = URLRequest(url: url)
    request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")

    URLSession.shared.dataTask(with: request) { data, response, error in
      self.handleAgreementResponse(data: data, response: response, error: error, resolve: resolve, reject: reject)
    }.resume()
  }

  // 프로필 응답 처리
  private func handleProfileResponse(
    data: Data?,
    response: URLResponse?,
    error: Error?,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    if let error = error {
      DispatchQueue.main.async {
        self.rejectParsed(reject, RNNaverError.profileFailed(error.localizedDescription), error)
      }
      return
    }

    guard let httpResponse = response as? HTTPURLResponse,
          200..<300 ~= httpResponse.statusCode else {
      DispatchQueue.main.async {
        self.rejectParsed(reject, RNNaverError.profileFailed("HTTP \((response as? HTTPURLResponse)?.statusCode ?? -1)"))
      }
      return
    }

    guard let data = data,
          let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
      DispatchQueue.main.async {
        self.rejectParsed(reject, RNNaverError.profileFailed("Failed to parse profile"))
      }
      return
    }

    if let resultCode = json["resultcode"] as? String,
       !resultCode.isEmpty,
       resultCode != "00" {
      let message = (json["message"] as? String) ?? "Naver profile API returned resultcode \(resultCode)"
      DispatchQueue.main.async {
        self.rejectParsed(reject, RNNaverError.profileFailed(message))
      }
      return
    }

    guard let res = json["response"] as? [String: Any] else {
      DispatchQueue.main.async {
        self.rejectParsed(reject, RNNaverError.profileFailed("Failed to parse profile"))
      }
      return
    }

    DispatchQueue.main.async {
      resolve(RNNaverSigninHelper.profileToDict(res))
    }
  }

  // 동의 항목 응답 처리
  private func handleAgreementResponse(
    data: Data?,
    response: URLResponse?,
    error: Error?,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    if let error = error {
      DispatchQueue.main.async {
        self.rejectParsed(reject, RNNaverError.agreementFailed(error.localizedDescription), error)
      }
      return
    }

    guard let httpResponse = response as? HTTPURLResponse,
          200..<300 ~= httpResponse.statusCode else {
      let statusCode = (response as? HTTPURLResponse)?.statusCode ?? -1
      let responseBody = data.flatMap { String(data: $0, encoding: .utf8) }
      let message = RNNaverSigninHelper.normalized(responseBody).map {
        "HTTP \(statusCode): \($0)"
      } ?? "HTTP \(statusCode)"

      DispatchQueue.main.async {
        self.rejectParsed(reject, RNNaverError.agreementFailed(message))
      }
      return
    }

    guard let data = data,
          let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
      DispatchQueue.main.async {
        self.rejectParsed(reject, RNNaverError.agreementFailed("Failed to parse agreement"))
      }
      return
    }

    if let result = json["result"] as? String,
       !result.isEmpty,
       result.lowercased() != "success" {
      DispatchQueue.main.async {
        self.rejectParsed(reject, RNNaverError.agreementFailed("Naver agreement API returned result \(result)"))
      }
      return
    }

    DispatchQueue.main.async {
      resolve(RNNaverSigninHelper.agreementToDict(json))
    }
  }

  // 진행 중 요청 시작
  // delegate 콜백 경합 방지
  private func beginOperation(
    _ operation: PendingOperation,
    _ resolve: @escaping RCTPromiseResolveBlock,
    _ reject: @escaping RCTPromiseRejectBlock
  ) -> Bool {
    if pendingReject != nil {
      rejectParsed(reject, RNNaverError.requestInProgress())
      return false
    }

    pendingOperation = operation
    pendingResolve = resolve
    pendingReject = reject
    scheduleOperationTimeout(reject)
    return true
  }

  // 진행 중 요청 확인
  private func ensureNoPendingOperation(_ reject: RCTPromiseRejectBlock) -> Bool {
    if pendingReject != nil {
      rejectParsed(reject, RNNaverError.requestInProgress())
      return false
    }

    return true
  }

  // 콜백 초기화
  private func clearCallbacks() {
    pendingTimeout?.cancel()
    pendingTimeout = nil
    pendingResolve = nil
    pendingReject = nil
    pendingOperation = nil
  }

  // SDK 콜백 타임아웃
  private func scheduleOperationTimeout(_ reject: @escaping RCTPromiseRejectBlock) {
    pendingTimeout?.cancel()

    let timeout = DispatchWorkItem { [weak self] in
      guard let self = self, self.pendingReject != nil else { return }

      self.rejectParsed(reject, RNNaverError.requestTimeout())
      self.clearCallbacks()
    }

    pendingTimeout = timeout
    DispatchQueue.main.asyncAfter(deadline: .now() + 120, execute: timeout)
  }

  // AppDelegate URL 콜백 실패 처리
  // URL 콜백 실패 reject
  @objc private func handleOpenUrlReceiveType(_ notification: Notification) {
    let rawValue = (notification.userInfo?["rawValue"] as? NSNumber)?.intValue
      ?? notification.userInfo?["rawValue"] as? Int

    guard let rawValue = rawValue,
          rawValue != 0,
          let pendingReject = pendingReject else {
      return
    }

    let parsedError = authorizationFailedError(rawValue)

    rejectParsed(pendingReject, parsedError)
    clearCallbacks()
  }

  // SDK receive type 에러 변환
  private func authorizationFailedError(_ rawValue: Int) -> RNNaverError.ParsedError {
    let sdkMessage = "Authorization failed: \(rawValue)"

    if rawValue == 8 {
      return RNNaverError.invalidClient(sdkMessage)
    }

    if pendingOperation == .deleteAccount {
      return RNNaverError.deleteFailed(sdkMessage)
    }

    return RNNaverError.loginFailed(sdkMessage)
  }

  // 에러 응답 변환
  private func rejectParsed(_ reject: RCTPromiseRejectBlock, _ error: RNNaverError.ParsedError) {
    rejectParsed(reject, error, nil)
  }

  private func rejectParsed(
    _ reject: RCTPromiseRejectBlock,
    _ error: RNNaverError.ParsedError,
    _ cause: Error?
  ) {
    var userInfo: [String: Any] = [NSLocalizedDescriptionKey: error.message]

    if let sdkMessage = error.sdkMessage {
      userInfo["sdkMessage"] = sdkMessage
    }

    let nativeError = NSError(domain: "RNNaverSignin", code: 0, userInfo: userInfo)
    reject(error.code, error.message, cause ?? nativeError)
  }
}

// 네이버 SDK delegate
extension RNNaverSignin: NaverThirdPartyLoginConnectionDelegate {

  // 로그인 성공 (신규 토큰)
  func oauth20ConnectionDidFinishRequestACTokenWithAuthCode() {
    let conn = NaverThirdPartyLoginConnection.getSharedInstance()
    pendingResolve?(RNNaverSigninHelper.tokenToDict(conn))
    clearCallbacks()
  }

  // 로그인 성공 (토큰 갱신)
  func oauth20ConnectionDidFinishRequestACTokenWithRefreshToken() {
    let conn = NaverThirdPartyLoginConnection.getSharedInstance()
    pendingResolve?(RNNaverSigninHelper.tokenToDict(conn))
    clearCallbacks()
  }

  // 회원탈퇴 성공
  func oauth20ConnectionDidFinishDeleteToken() {
    pendingResolve?("Successfully deleted account")
    clearCallbacks()
  }

  // 오류
  func oauth20Connection(_ oauthConnection: NaverThirdPartyLoginConnection!, didFailWithError error: Error!) {
    let fallback = pendingOperation == .deleteAccount
      ? RNNaverError.deleteFailed(error?.localizedDescription)
      : RNNaverError.loginFailed(error?.localizedDescription)
    let parsedError = RNNaverError.parse(error, fallback: fallback)
    if let pendingReject = pendingReject {
      rejectParsed(pendingReject, parsedError, error)
    }
    clearCallbacks()
  }

  func oauth20Connection(
    _ oauthConnection: NaverThirdPartyLoginConnection!,
    didFailAuthorizationWithReceive receiveType: THIRDPARTYLOGIN_RECEIVE_TYPE
  ) {
    if let pendingReject = pendingReject {
      let parsedError = authorizationFailedError(Int(receiveType.rawValue))
      rejectParsed(pendingReject, parsedError)
    }
    clearCallbacks()
  }

}
