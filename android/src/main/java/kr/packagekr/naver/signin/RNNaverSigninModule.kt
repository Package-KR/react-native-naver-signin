package kr.packagekr.naver.signin

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.module.annotations.ReactModule
import android.os.Handler
import android.os.Looper
import com.navercorp.nid.NaverIdLoginSDK
import com.navercorp.nid.oauth.NidOAuthLogin
import com.navercorp.nid.oauth.OAuthLoginCallback
import com.navercorp.nid.profile.NidProfileCallback
import com.navercorp.nid.profile.data.NidProfileResponse
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

@ReactModule(name = RNNaverSigninModule.NAME)
class RNNaverSigninModule(
    reactContext: ReactApplicationContext
) : NativeRNNaverSigninSpec(reactContext) {

    companion object {
        const val NAME = "RNNaverSignin"
        private const val OPERATION_TIMEOUT_MS = 120_000L
        private const val AGREEMENT_ENDPOINT = "https://openapi.naver.com/v1/nid/agreement"
        private val configurationLock = Any()
        private var isConfigured = false
    }

    private val mainHandler = Handler(Looper.getMainLooper())
    // 비동기 SDK 콜백 경합 방지
    private val operationLock = Any()
    private var hasPendingOperation = false
    private var pendingOperationId = 0L
    private var pendingPromise: Promise? = null
    private var operationTimeoutRunnable: Runnable? = null

    // 모듈 초기화
    init {
        configureNaverSdkIfNeeded()
    }

    // 모듈 이름 반환
    override fun getName(): String = NAME

    // SDK 초기화
    private fun configureNaverSdkIfNeeded(): Boolean {
        synchronized(configurationLock) {
            if (isConfigured) {
                return true
            }

            val clientId = RNNaverSigninHelper.resolveString(reactApplicationContext, "naver_client_id")
            val clientSecret = RNNaverSigninHelper.resolveString(reactApplicationContext, "naver_client_secret")

            if (clientId.isNullOrBlank() || clientSecret.isNullOrBlank()) {
                return false
            }

            NaverIdLoginSDK.initialize(
                reactApplicationContext,
                clientId,
                clientSecret,
                RNNaverSigninHelper.resolveAppName(reactApplicationContext)
            )
            isConfigured = true
            return true
        }
    }

    // 네이버 로그인
    @ReactMethod
    override fun login(promise: Promise) {
        runConfiguredOnUiThread(promise) {
            val operationId = beginOperation(promise) ?: run {
                return@runConfiguredOnUiThread
            }

            val activity = reactApplicationContext.getCurrentActivity()

            if (activity == null) {
                finishOperation(operationId)
                RNNaverError.rejectActivityDoesNotExist(promise)
                return@runConfiguredOnUiThread
            }

            NaverIdLoginSDK.authenticate(activity, object : OAuthLoginCallback {
                override fun onSuccess() {
                    if (finishOperation(operationId)) {
                        if (RNNaverSigninHelper.hasAccessToken()) {
                            promise.resolve(RNNaverSigninHelper.tokenToMap())
                        } else {
                            RNNaverError.rejectLoginFailure(promise, "Naver SDK returned an empty access token")
                        }
                    }
                }

                override fun onFailure(httpStatus: Int, message: String) {
                    if (finishOperation(operationId)) {
                        RNNaverError.rejectLoginFailure(promise, message)
                    }
                }

                override fun onError(errorCode: Int, message: String) {
                    if (finishOperation(operationId)) {
                        RNNaverError.rejectLoginError(promise, errorCode, message)
                    }
                }
            })
        }
    }

    // 로그아웃
    @ReactMethod
    override fun logout(promise: Promise) {
        runConfigured(promise) {
            if (hasPendingOperation()) {
                RNNaverError.rejectRequestInProgress(promise)
                return@runConfigured
            }

            NaverIdLoginSDK.logout()
            promise.resolve("Successfully logged out")
        }
    }

    // 회원탈퇴
    @ReactMethod
    override fun deleteAccount(promise: Promise) {
        runConfiguredOnUiThread(promise) {
            val operationId = beginOperation(promise) ?: run {
                return@runConfiguredOnUiThread
            }

            NidOAuthLogin().callDeleteTokenApi(object : OAuthLoginCallback {
                override fun onSuccess() {
                    if (finishOperation(operationId)) {
                        promise.resolve("Successfully deleted account")
                    }
                }

                override fun onFailure(httpStatus: Int, message: String) {
                    if (finishOperation(operationId)) {
                        RNNaverError.rejectDeleteFailure(promise, message)
                    }
                }

                override fun onError(errorCode: Int, message: String) {
                    if (finishOperation(operationId)) {
                        RNNaverError.rejectDeleteFailure(promise, errorCode, message)
                    }
                }
            })
        }
    }

    // 프로필 조회
    @ReactMethod
    override fun getProfile(promise: Promise) {
        runConfigured(promise) {
            val operationId = beginOperation(promise) ?: run {
                return@runConfigured
            }

            val accessToken = RNNaverSigninHelper.normalized(NaverIdLoginSDK.getAccessToken())

            if (accessToken == null) {
                finishOperation(operationId)
                RNNaverError.rejectNotLoggedIn(promise)
                return@runConfigured
            }

            NidOAuthLogin().callProfileApi(object : NidProfileCallback<NidProfileResponse> {
                override fun onSuccess(result: NidProfileResponse) {
                    UiThreadUtil.runOnUiThread {
                        if (!finishOperation(operationId)) {
                            return@runOnUiThread
                        }

                        val resultCode = RNNaverSigninHelper.normalized(result.resultCode)
                        if (!resultCode.isNullOrEmpty() && resultCode != "00") {
                            RNNaverError.rejectProfileFailed(
                                promise,
                                RNNaverSigninHelper.normalized(result.message)
                                    ?: "Naver profile API returned resultcode $resultCode"
                            )
                            return@runOnUiThread
                        }

                        val profile = result.profile
                        if (profile == null) {
                            RNNaverError.rejectProfileFailed(promise, "Profile response is empty")
                            return@runOnUiThread
                        }

                        promise.resolve(RNNaverSigninHelper.profileToMap(profile))
                    }
                }

                override fun onFailure(httpStatus: Int, message: String) {
                    UiThreadUtil.runOnUiThread {
                        if (finishOperation(operationId)) {
                            RNNaverError.rejectProfileFailed(promise, "HTTP $httpStatus: $message")
                        }
                    }
                }

                override fun onError(errorCode: Int, message: String) {
                    UiThreadUtil.runOnUiThread {
                        if (finishOperation(operationId)) {
                            RNNaverError.rejectProfileError(promise, errorCode, message)
                        }
                    }
                }
            })
        }
    }

    // 동의 항목 조회
    @ReactMethod
    override fun getAgreement(promise: Promise) {
        runConfigured(promise) {
            val operationId = beginOperation(promise) ?: run {
                return@runConfigured
            }

            val accessToken = RNNaverSigninHelper.normalized(NaverIdLoginSDK.getAccessToken())

            if (accessToken == null) {
                finishOperation(operationId)
                RNNaverError.rejectNotLoggedIn(promise)
                return@runConfigured
            }

            Thread {
                try {
                    val response = requestAgreement(accessToken)
                    UiThreadUtil.runOnUiThread {
                        if (finishOperation(operationId)) {
                            promise.resolve(RNNaverSigninHelper.agreementToMap(response))
                        }
                    }
                } catch (error: Throwable) {
                    UiThreadUtil.runOnUiThread {
                        if (finishOperation(operationId)) {
                            RNNaverError.rejectAgreementFailed(promise, error.message, error)
                        }
                    }
                }
            }.start()
        }
    }

    // 동의 항목 REST API 요청
    // 실패 응답 body 보존
    private fun requestAgreement(accessToken: String): JSONObject {
        val connection = (URL(AGREEMENT_ENDPOINT).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 15_000
            readTimeout = 15_000
            setRequestProperty("Authorization", "Bearer $accessToken")
        }

        return try {
            val statusCode = connection.responseCode
            val stream = if (statusCode in 200..299) connection.inputStream else connection.errorStream
            val body = stream?.bufferedReader()?.use { it.readText() }.orEmpty()

            if (statusCode !in 200..299) {
                val message = RNNaverSigninHelper.normalized(body)?.let {
                    "HTTP $statusCode: $it"
                } ?: "HTTP $statusCode"
                throw IllegalStateException(message)
            }

            val json = JSONObject(body)
            val result = RNNaverSigninHelper.normalized(json.optString("result"))
            if (result != null && !result.equals("success", ignoreCase = true)) {
                throw IllegalStateException("Naver agreement API returned result $result")
            }

            json
        } finally {
            connection.disconnect()
        }
    }

    // 설정 확인 후 실행
    private fun runConfigured(promise: Promise, action: () -> Unit) {
        if (!ensureConfigured(promise)) {
            return
        }

        action()
    }

    // 설정 확인 후 UI 스레드에서 실행
    private fun runConfiguredOnUiThread(promise: Promise, action: () -> Unit) {
        UiThreadUtil.runOnUiThread {
            if (!ensureConfigured(promise)) {
                return@runOnUiThread
            }

            action()
        }
    }

    // SDK 설정 상태 확인
    private fun ensureConfigured(promise: Promise): Boolean {
        if (configureNaverSdkIfNeeded()) {
            return true
        }

        RNNaverError.rejectMisconfigured(promise)
        return false
    }

    // 진행 중 요청 시작
    private fun beginOperation(promise: Promise): Long? {
        synchronized(operationLock) {
            if (hasPendingOperation) {
                RNNaverError.rejectRequestInProgress(promise)
                return null
            }

            hasPendingOperation = true
            pendingOperationId += 1
            pendingPromise = promise
            scheduleOperationTimeout(pendingOperationId)
            return pendingOperationId
        }
    }

    // 진행 중 요청 종료
    private fun finishOperation(operationId: Long): Boolean {
        synchronized(operationLock) {
            if (!hasPendingOperation || pendingOperationId != operationId) {
                return false
            }

            clearOperationTimeout()
            hasPendingOperation = false
            pendingPromise = null
            return true
        }
    }

    // 진행 중 요청 확인
    private fun hasPendingOperation(): Boolean {
        synchronized(operationLock) {
            return hasPendingOperation
        }
    }

    // SDK 콜백 타임아웃
    private fun scheduleOperationTimeout(operationId: Long) {
        clearOperationTimeout()

        val runnable = Runnable {
            val promiseToReject = synchronized(operationLock) {
                if (!hasPendingOperation || pendingOperationId != operationId) {
                    return@Runnable
                }

                hasPendingOperation = false
                operationTimeoutRunnable = null
                pendingPromise.also {
                    pendingPromise = null
                }
            }

            promiseToReject?.let(RNNaverError::rejectRequestTimeout)
        }

        operationTimeoutRunnable = runnable
        mainHandler.postDelayed(runnable, OPERATION_TIMEOUT_MS)
    }

    // 타임아웃 해제
    private fun clearOperationTimeout() {
        operationTimeoutRunnable?.let(mainHandler::removeCallbacks)
        operationTimeoutRunnable = null
    }

}
