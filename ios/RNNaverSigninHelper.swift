import Foundation

import NaverThirdPartyLogin

// 공통 헬퍼
enum RNNaverSigninHelper {

  // 토큰 응답 변환
  static func tokenToDict(_ conn: NaverThirdPartyLoginConnection?) -> [String: Any] {
    guard let conn = conn else { return [:] }
    return [
      "accessToken": normalized(conn.accessToken) ?? "",
      "refreshToken": normalized(conn.refreshToken) ?? "",
      "tokenType": normalized(conn.tokenType) ?? "",
      "expiresAt": conn.accessTokenExpireDate.map { String(Int($0.timeIntervalSince1970)) } ?? "",
    ]
  }

  // 프로필 응답 변환
  static func profileToDict(_ res: [String: Any]) -> [String: Any] {
    return compact([
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
    ])
  }

  // 동의 항목 응답 변환
  static func agreementToDict(_ json: [String: Any]) -> [String: Any] {
    let agreementInfos = (json["agreementInfos"] as? [[String: Any]] ?? []).map { info in
      [
        "termCode": normalized(info["termCode"] as? String) ?? "",
        "clientId": normalized(info["clientId"] as? String) ?? "",
        "agreeDate": normalized(info["agreeDate"] as? String) ?? "",
      ]
    }

    return [
      "result": normalized(json["result"] as? String) ?? "",
      "accessToken": normalized(json["accessToken"] as? String) ?? "",
      "agreementInfos": agreementInfos,
    ]
  }

  // nil 값을 제거해 React Native 브리지에 안전한 Dictionary 생성
  static func compact(_ dict: [String: Any?]) -> [String: Any] {
    return dict.reduce(into: [String: Any]()) { result, item in
      guard let rawValue = item.value,
            let value = unwrap(rawValue) else {
        return
      }

      if value is NSNull {
        return
      }

      if let stringValue = value as? String {
        let normalized = stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        if normalized.isEmpty {
          return
        }

        result[item.key] = normalized
        return
      }

      result[item.key] = value
    }
  }

  static func normalized(_ value: String?) -> String? {
    guard let value = value else {
      return nil
    }

    let normalized = value.trimmingCharacters(in: .whitespacesAndNewlines)
    return normalized.isEmpty ? nil : normalized
  }

  // Info.plist boolean 해석
  static func resolveBool(_ key: String) -> Bool {
    if let value = Bundle.main.object(forInfoDictionaryKey: key) as? Bool {
      return value
    }

    if let value = Bundle.main.object(forInfoDictionaryKey: key) as? String {
      return ["1", "true", "yes"].contains(value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased())
    }

    return false
  }

  // Optional 해제
  private static func unwrap(_ value: Any) -> Any? {
    let mirror = Mirror(reflecting: value)

    guard mirror.displayStyle == .optional else {
      return value
    }

    return mirror.children.first?.value
  }

  // 서비스 URL scheme 해석
  static func resolveServiceUrlScheme(configuredScheme: String?, clientId: String?) -> String? {
    if let configuredScheme,
       !configuredScheme.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
      return configuredScheme
    }

    guard let urlTypes = Bundle.main.object(forInfoDictionaryKey: "CFBundleURLTypes") as? [[String: Any]] else {
      return nil
    }

    let expectedScheme = clientId.map { "naverlogin\($0)" }

    for urlType in urlTypes {
      guard let expectedScheme,
            let schemes = urlType["CFBundleURLSchemes"] as? [String],
            let matchingScheme = schemes.first(where: { $0 == expectedScheme }) else {
        continue
      }

      return matchingScheme
    }

    for urlType in urlTypes {
      guard let urlName = urlType["CFBundleURLName"] as? String,
            urlName.caseInsensitiveCompare("NAVER") == .orderedSame,
            let schemes = urlType["CFBundleURLSchemes"] as? [String],
            let matchingScheme = schemes.first else {
        continue
      }

      return matchingScheme
    }

    return nil
  }

  // 앱 이름 해석
  static func resolveAppName() -> String? {
    let infoDictionaryKeys = ["NAVER_APP_NAME", "CFBundleDisplayName", "CFBundleName"]

    for key in infoDictionaryKeys {
      if let value = Bundle.main.object(forInfoDictionaryKey: key) as? String,
         !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
        return value
      }
    }

    return nil
  }
}
