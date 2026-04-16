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

    if let clientId = Bundle.main.object(forInfoDictionaryKey: "NAVER_CLIENT_ID") as? String {
      conn.consumerKey = clientId
      conn.serviceUrlScheme = "naverlogin\(clientId)"
    }
    if let clientSecret = Bundle.main.object(forInfoDictionaryKey: "NAVER_CLIENT_SECRET") as? String {
      conn.consumerSecret = clientSecret
    }
    if let appName = Bundle.main.object(forInfoDictionaryKey: "NAVER_APP_NAME") as? String {
      conn.appName = appName
    }
  }

  // 네이버 로그인 URL 처리
  @objc(handleOpenUrl:)
  static func handleOpenUrl(_ url: URL) -> Bool {
    return NaverThirdPartyLoginConnection.getSharedInstance()?.receiveAccessToken(url) ?? false
  }

  // 로그인
  @objc(login:rejecter:)
  func login(_ resolve: @escaping RCTPromiseResolveBlock,
             rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      self.pendingResolve = resolve
      self.pendingReject = reject
      let conn = NaverThirdPartyLoginConnection.getSharedInstance()
      conn?.delegate = self
      conn?.requestThirdPartyLogin()
    }
  }

  // 로그아웃
  @objc(logout:rejecter:)
  func logout(_ resolve: @escaping RCTPromiseResolveBlock,
              rejecter reject: @escaping RCTPromiseRejectBlock) {
    NaverThirdPartyLoginConnection.getSharedInstance()?.resetToken()
    resolve("Successfully logged out")
  }

  // 회원탈퇴
  @objc(deleteAccount:rejecter:)
  func deleteAccount(_ resolve: @escaping RCTPromiseResolveBlock,
                     rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      self.pendingResolve = resolve
      self.pendingReject = reject
      let conn = NaverThirdPartyLoginConnection.getSharedInstance()
      conn?.delegate = self
      conn?.requestDeleteToken()
    }
  }

  // 프로필 조회
  @objc(getProfile:rejecter:)
  func getProfile(_ resolve: @escaping RCTPromiseResolveBlock,
                  rejecter reject: @escaping RCTPromiseRejectBlock) {
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
