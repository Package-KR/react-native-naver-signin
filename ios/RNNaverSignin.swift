import Foundation
import NaverThirdPartyLogin

@objc(RNNaverSignin)
class RNNaverSignin: NSObject {

  private var pendingResolve: RCTPromiseResolveBlock?
  private var pendingReject: RCTPromiseRejectBlock?

  public override init() {
    super.init()
    configureNaverSdk()
  }

  @objc static func requiresMainQueueSetup() -> Bool { true }

  // SDK 초기화
  private func configureNaverSdk() {
    guard let conn = NaverThirdPartyLoginConnection.getSharedInstance() else { return }
    conn.isNaverAppOauthEnable = true
    conn.isInAppOauthEnable = true

    let clientId = Bundle.main.object(forInfoDictionaryKey: "NAVER_CLIENT_ID") as? String
    let configuredScheme = Bundle.main.object(forInfoDictionaryKey: "NAVER_URL_SCHEME") as? String

    if let clientId {
      conn.consumerKey = clientId
    }
    if let clientSecret = Bundle.main.object(forInfoDictionaryKey: "NAVER_CLIENT_SECRET") as? String {
      conn.consumerSecret = clientSecret
    }
    if let appName = resolveAppName() {
      conn.appName = appName
    }
    if let scheme = resolveServiceUrlScheme(configuredScheme: configuredScheme, clientId: clientId) {
      conn.serviceUrlScheme = scheme
    }
  }

  private func resolveServiceUrlScheme(configuredScheme: String?, clientId: String?) -> String? {
    if let configuredScheme,
       !configuredScheme.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
      return configuredScheme
    }

    guard let urlTypes = Bundle.main.object(forInfoDictionaryKey: "CFBundleURLTypes") as? [[String: Any]] else {
      return nil
    }

    let expectedScheme = clientId.map { "naverlogin\($0)" }

    for urlType in urlTypes {
      guard let schemes = urlType["CFBundleURLSchemes"] as? [String] else {
        continue
      }

      if let urlName = urlType["CFBundleURLName"] as? String,
         urlName.caseInsensitiveCompare("NAVER") == .orderedSame,
         let namedScheme = schemes.first {
        return namedScheme
      }

      if let expectedScheme, let matchingScheme = schemes.first(where: { $0 == expectedScheme }) {
        return matchingScheme
      }

      if let fallbackScheme = schemes.first(where: { $0.hasPrefix("naver") }) {
        return fallbackScheme
      }
    }

    return nil
  }

  private func resolveAppName() -> String? {
    let infoDictionaryKeys = ["NAVER_APP_NAME", "CFBundleDisplayName", "CFBundleName"]

    for key in infoDictionaryKeys {
      if let value = Bundle.main.object(forInfoDictionaryKey: key) as? String,
         !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
        return value
      }
    }

    return nil
  }

  // 네이버 로그인 URL 처리
  @objc(handleOpenUrl:)
  static func handleOpenUrl(_ url: URL) -> Bool {
    let result = NaverThirdPartyLoginConnection.getSharedInstance()?.receiveAccessToken(url)
    return result?.rawValue == 0
  }

  // 로그인
  @objc(login:reject:)
  func login(_ resolve: @escaping RCTPromiseResolveBlock,
             reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      self.pendingResolve = resolve
      self.pendingReject = reject
      let conn = NaverThirdPartyLoginConnection.getSharedInstance()
      conn?.delegate = self
      conn?.requestThirdPartyLogin()
    }
  }

  // 로그아웃
  @objc(logout:reject:)
  func logout(_ resolve: @escaping RCTPromiseResolveBlock,
              reject: @escaping RCTPromiseRejectBlock) {
    NaverThirdPartyLoginConnection.getSharedInstance()?.resetToken()
    resolve("Successfully logged out")
  }

  // 회원탈퇴
  @objc(deleteAccount:reject:)
  func deleteAccount(_ resolve: @escaping RCTPromiseResolveBlock,
                     reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      self.pendingResolve = resolve
      self.pendingReject = reject
      let conn = NaverThirdPartyLoginConnection.getSharedInstance()
      conn?.delegate = self
      conn?.requestDeleteToken()
    }
  }

  // 프로필 조회
  @objc(getProfile:reject:)
  func getProfile(_ resolve: @escaping RCTPromiseResolveBlock,
                  reject: @escaping RCTPromiseRejectBlock) {
    guard let accessToken = NaverThirdPartyLoginConnection.getSharedInstance()?.accessToken else {
      reject("E_NOT_LOGGED_IN", "Not logged in", nil)
      return
    }

    guard let url = URL(string: "https://openapi.naver.com/v1/nid/me") else {
      reject("E_INVALID_URL", "Invalid URL", nil)
      return
    }

    var request = URLRequest(url: url)
    request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")

    URLSession.shared.dataTask(with: request) { data, _, error in
      if let error = error {
        reject("E_PROFILE_ERROR", error.localizedDescription, error)
        return
      }

      guard let data = data,
            let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let res = json["response"] as? [String: Any] else {
        reject("E_PROFILE_FAILED", "Failed to parse profile", nil)
        return
      }

      let profile: [String: Any?] = [
        "id": res["id"] as? String,
        "nickname": res["nickname"] as? String,
        "name": res["name"] as? String,
        "email": res["email"] as? String,
        "profileImage": res["profile_image"] as? String,
        "gender": res["gender"] as? String,
        "age": res["age"] as? String,
        "birthday": res["birthday"] as? String,
        "birthyear": res["birthyear"] as? String,
        "mobile": res["mobile"] as? String,
      ]
      resolve(profile)
    }.resume()
  }

  // 콜백 초기화
  private func clearCallbacks() {
    pendingResolve = nil
    pendingReject = nil
  }
}

// MARK: - NaverThirdPartyLoginConnectionDelegate
extension RNNaverSignin: NaverThirdPartyLoginConnectionDelegate {

  // 로그인 성공 (신규 토큰)
  func oauth20ConnectionDidFinishRequestACTokenWithAuthCode() {
    guard let conn = NaverThirdPartyLoginConnection.getSharedInstance() else { return }
    pendingResolve?(tokenToDict(conn))
    clearCallbacks()
  }

  // 로그인 성공 (토큰 갱신)
  func oauth20ConnectionDidFinishRequestACTokenWithRefreshToken() {
    guard let conn = NaverThirdPartyLoginConnection.getSharedInstance() else { return }
    pendingResolve?(tokenToDict(conn))
    clearCallbacks()
  }

  // 회원탈퇴 성공
  func oauth20ConnectionDidFinishDeleteToken() {
    pendingResolve?("Successfully deleted account")
    clearCallbacks()
  }

  // 오류
  func oauth20Connection(_ oauthConnection: NaverThirdPartyLoginConnection!, didFailWithError error: Error!) {
    pendingReject?("E_NAVER_ERROR", error?.localizedDescription ?? "Unknown error", error)
    clearCallbacks()
  }

  private func tokenToDict(_ conn: NaverThirdPartyLoginConnection) -> [String: Any] {
    return [
      "accessToken": conn.accessToken ?? "",
      "refreshToken": conn.refreshToken ?? "",
      "tokenType": conn.tokenType ?? "",
      "expiresAt": conn.accessTokenExpireDate?.description ?? "",
    ]
  }
}
