package kr.packagekr.naver.signin

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.navercorp.nid.NaverIdLoginSDK
import com.navercorp.nid.profile.data.NidProfile
import org.json.JSONObject

internal object RNNaverSigninHelper {
    // 문자열 리소스 조회
    fun resolveString(context: ReactApplicationContext, name: String): String? {
        val resourceId = context.resources.getIdentifier(name, "string", context.packageName)

        if (resourceId == 0) {
            return null
        }

        return context.getString(resourceId).trim().takeIf { it.isNotEmpty() }
    }

    // 앱 이름 조회
    fun resolveAppName(context: ReactApplicationContext): String {
        return resolveString(context, "naver_app_name")
            ?: resolveString(context, "app_name")
            ?: context.applicationInfo.loadLabel(context.packageManager).toString()
    }

    // 토큰 응답 생성
    fun tokenToMap(): WritableMap {
        val token = Arguments.createMap()
        token.putString("accessToken", normalized(NaverIdLoginSDK.getAccessToken()) ?: "")
        token.putString("refreshToken", normalized(NaverIdLoginSDK.getRefreshToken()) ?: "")
        token.putString("tokenType", normalized(NaverIdLoginSDK.getTokenType()) ?: "")
        token.putString("expiresAt", expiresAtSeconds(NaverIdLoginSDK.getExpiresAt()))
        return token
    }

    // 액세스 토큰 확인
    fun hasAccessToken(): Boolean {
        return normalized(NaverIdLoginSDK.getAccessToken()) != null
    }

    // 프로필 응답 생성
    fun profileToMap(res: NidProfile): WritableMap {
        val profile = Arguments.createMap()
        profile.putNormalizedString("id", res.id)
        profile.putNormalizedString("nickname", res.nickname)
        profile.putNormalizedString("name", res.name)
        profile.putNormalizedString("email", res.email)
        profile.putNormalizedString("profileImage", res.profileImage)
        profile.putNormalizedString("gender", res.gender)
        profile.putNormalizedString("age", res.age)
        profile.putNormalizedString("birthday", res.birthday)
        profile.putNormalizedString("birthyear", res.birthYear)
        profile.putNormalizedString("mobile", res.mobile)
        return profile
    }

    // 동의 항목 응답 생성
    fun agreementToMap(json: JSONObject): WritableMap {
        val agreement = Arguments.createMap()
        val agreementInfos = Arguments.createArray()
        val infos = json.optJSONArray("agreementInfos")

        if (infos != null) {
            for (index in 0 until infos.length()) {
                val infoJson = infos.optJSONObject(index) ?: continue
                val info = Arguments.createMap()
                info.putString("termCode", normalized(infoJson.optString("termCode")) ?: "")
                info.putString("clientId", normalized(infoJson.optString("clientId")) ?: "")
                info.putString("agreeDate", normalized(infoJson.optString("agreeDate")) ?: "")
                agreementInfos.pushMap(info)
            }
        }

        agreement.putString("result", normalized(json.optString("result")) ?: "")
        agreement.putString("accessToken", normalized(json.optString("accessToken")) ?: "")
        agreement.putArray("agreementInfos", agreementInfos)
        return agreement
    }

    // 문자열 정규화
    fun normalized(value: String?): String? {
        return value?.trim()?.takeIf { it.isNotEmpty() }
    }

    // 만료 시간 변환
    private fun expiresAtSeconds(value: Long): String {
        return (if (value > 100_000_000_000L) value / 1000 else value).toString()
    }

    // 선택값 입력
    private fun WritableMap.putNormalizedString(key: String, value: String?) {
        normalized(value)?.let { putString(key, it) }
    }
}
