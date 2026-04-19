package kr.packagekr.naver.signin

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import com.navercorp.nid.NaverIdLoginSDK
import com.navercorp.nid.oauth.OAuthLoginCallback

@ReactModule(name = RNNaverSigninModule.NAME)
class RNNaverSigninModule(
    reactContext: ReactApplicationContext
) : NativeRNNaverSigninSpec(reactContext) {

    companion object {
        const val NAME = "RNNaverSignin"
    }

    init {
        configureNaverSdk()
    }

    override fun getName(): String = NAME

    // SDK 초기화
    private fun configureNaverSdk() {
        val clientId = resolveString("naver_client_id") ?: return
        val clientSecret = resolveString("naver_client_secret") ?: return
        val appName = resolveString("naver_app_name")
            ?: resolveString("app_name")
            ?: reactApplicationContext.applicationInfo.loadLabel(reactApplicationContext.packageManager).toString()
        NaverIdLoginSDK.initialize(reactApplicationContext, clientId, clientSecret, appName)
    }

    // 네이버 로그인
    @ReactMethod
    override fun login(promise: Promise) {
        val activity = currentActivity

        if (activity == null) {
            promise.reject("E_ACTIVITY_DOES_NOT_EXIST", "Activity doesn't exist")
            return
        }

        NaverIdLoginSDK.authenticate(activity, object : OAuthLoginCallback {
            override fun onSuccess() {
                promise.resolve(resolveToken())
            }

            override fun onFailure(httpStatus: Int, message: String) {
                val errorCode = NaverIdLoginSDK.getLastErrorCode().code
                val errorDesc = NaverIdLoginSDK.getLastErrorDescription()
                promise.reject(errorCode, errorDesc)
            }

            override fun onError(errorCode: Int, message: String) {
                promise.reject("E_LOGIN_ERROR", message)
            }
        })
    }

    // 로그아웃
    @ReactMethod
    override fun logout(promise: Promise) {
        NaverIdLoginSDK.logout()
        promise.resolve("Successfully logged out")
    }

    // 회원탈퇴
    @ReactMethod
    override fun deleteAccount(promise: Promise) {
        val activity = currentActivity

        if (activity == null) {
            promise.reject("E_ACTIVITY_DOES_NOT_EXIST", "Activity doesn't exist")
            return
        }

        NaverIdLoginSDK.callDeleteTokenApi(activity, object : OAuthLoginCallback {
            override fun onSuccess() {
                promise.resolve("Successfully deleted account")
            }

            override fun onFailure(httpStatus: Int, message: String) {
                promise.reject("E_FAILED_OPERATION", message)
            }

            override fun onError(errorCode: Int, message: String) {
                promise.reject("E_DELETE_ERROR", message)
            }
        })
    }

    // 프로필 조회
    @ReactMethod
    override fun getProfile(promise: Promise) {
        val accessToken = NaverIdLoginSDK.getAccessToken()

        if (accessToken == null) {
            promise.reject("E_NOT_LOGGED_IN", "Not logged in")
            return
        }

        Thread {
            try {
                val url = java.net.URL("https://openapi.naver.com/v1/nid/me")
                val conn = url.openConnection() as java.net.HttpURLConnection
                conn.requestMethod = "GET"
                conn.setRequestProperty("Authorization", "Bearer $accessToken")

                if (conn.responseCode != 200) {
                    promise.reject("E_PROFILE_FAILED", "Failed to fetch profile: HTTP ${conn.responseCode}")
                    return@Thread
                }

                val body = conn.inputStream.bufferedReader().readText()
                val json = org.json.JSONObject(body)
                val res = json.getJSONObject("response")

                val profile = Arguments.createMap()
                profile.putString("id", res.optString("id").ifEmpty { null })
                profile.putString("nickname", res.optString("nickname").ifEmpty { null })
                profile.putString("name", res.optString("name").ifEmpty { null })
                profile.putString("email", res.optString("email").ifEmpty { null })
                profile.putString("profileImage", res.optString("profile_image").ifEmpty { null })
                profile.putString("gender", res.optString("gender").ifEmpty { null })
                profile.putString("age", res.optString("age").ifEmpty { null })
                profile.putString("birthday", res.optString("birthday").ifEmpty { null })
                profile.putString("birthyear", res.optString("birthyear").ifEmpty { null })
                profile.putString("mobile", res.optString("mobile").ifEmpty { null })

                promise.resolve(profile)
            } catch (e: Exception) {
                promise.reject("E_PROFILE_ERROR", e.message, e)
            }
        }.start()
    }

    // 문자열 리소스 조회
    private fun resolveString(name: String): String? {
        val resourceId = reactApplicationContext.resources.getIdentifier(
            name, "string", reactApplicationContext.packageName
        )
        if (resourceId == 0) return null
        return reactApplicationContext.getString(resourceId)
    }

    // 토큰 응답 생성
    private fun resolveToken(): WritableMap {
        val token = Arguments.createMap()
        token.putString("accessToken", NaverIdLoginSDK.getAccessToken())
        token.putString("refreshToken", NaverIdLoginSDK.getRefreshToken())
        token.putString("tokenType", NaverIdLoginSDK.getTokenType())
        token.putString("expiresAt", NaverIdLoginSDK.getExpiresAt().toString())
        return token
    }
}
