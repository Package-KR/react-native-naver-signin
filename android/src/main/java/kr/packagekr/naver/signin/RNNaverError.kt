package kr.packagekr.naver.signin

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.navercorp.nid.NaverIdLoginSDK

internal object RNNaverError {
    // 변환된 에러
    private data class ParsedError(
        val code: String,
        val message: String,
        val sdkMessage: String? = null,
    )

    // 에러 메시지
    private object Message {
        const val agreementFailed = "Failed to fetch the Naver agreement information."
        const val activityDoesNotExist = "The current Activity could not be found."
        const val deleteFailed = "Failed to delete the Naver account connection."
        const val invalidClient = "The Naver Android app configuration is invalid. Please check client ID, client secret, package name, and URL scheme settings."
        const val loginFailed = "Naver login failed."
        const val misconfigured = "The Naver Android configuration is invalid. Please check naver_client_id, naver_client_secret, Android package name, and URL scheme settings."
        const val notLoggedIn = "Sign-in is required."
        const val profileFailed = "Failed to fetch the Naver profile."
        const val requestInProgress = "A Naver request is already in progress."
        const val requestTimeout = "The Naver request timed out."
    }

    // 에러 코드
    const val AGREEMENT_FAILED = "NAVER_AGREEMENT_FAILED"
    const val ACTIVITY_DOES_NOT_EXIST = "NAVER_ACTIVITY_DOES_NOT_EXIST"
    const val DELETE_FAILED = "NAVER_DELETE_FAILED"
    const val INVALID_CLIENT = "NAVER_INVALID_CLIENT"
    const val LOGIN_FAILED = "NAVER_LOGIN_FAILED"
    const val MISCONFIGURED = "NAVER_MISCONFIGURED"
    const val NOT_LOGGED_IN = "NAVER_NOT_LOGGED_IN"
    const val PROFILE_FAILED = "NAVER_PROFILE_FAILED"
    const val REQUEST_IN_PROGRESS = "NAVER_REQUEST_IN_PROGRESS"
    const val REQUEST_TIMEOUT = "NAVER_REQUEST_TIMEOUT"
    const val UNKNOWN = "NAVER_ERROR"

    // 직접 에러 응답
    fun rejectMisconfigured(promise: Promise) {
        rejectParsed(promise, ParsedError(MISCONFIGURED, Message.misconfigured))
    }

    fun rejectActivityDoesNotExist(promise: Promise) {
        rejectParsed(promise, ParsedError(ACTIVITY_DOES_NOT_EXIST, Message.activityDoesNotExist))
    }

    fun rejectNotLoggedIn(promise: Promise) {
        rejectParsed(promise, ParsedError(NOT_LOGGED_IN, Message.notLoggedIn))
    }

    fun rejectLoginFailure(promise: Promise, message: String?) {
        rejectParsed(promise, sdkError(LOGIN_FAILED, Message.loginFailed, message))
    }

    fun rejectLoginError(promise: Promise, errorCode: Int, message: String?) {
        rejectParsed(promise, ParsedError("${UNKNOWN}_$errorCode", Message.loginFailed, normalized(message)))
    }

    fun rejectDeleteFailure(promise: Promise, message: String?) {
        rejectParsed(promise, ParsedError(DELETE_FAILED, Message.deleteFailed, normalized(message)))
    }

    fun rejectDeleteFailure(promise: Promise, errorCode: Int, message: String?) {
        rejectParsed(promise, ParsedError("${UNKNOWN}_$errorCode", Message.deleteFailed, normalized(message)))
    }

    fun rejectProfileFailed(promise: Promise, message: String? = null, cause: Throwable? = null) {
        rejectParsed(promise, ParsedError(PROFILE_FAILED, Message.profileFailed, normalized(message)), cause)
    }

    fun rejectProfileError(promise: Promise, errorCode: Int, message: String?) {
        rejectParsed(promise, ParsedError("${UNKNOWN}_$errorCode", Message.profileFailed, normalized(message)))
    }

    fun rejectAgreementFailed(promise: Promise, message: String? = null, cause: Throwable? = null) {
        rejectParsed(promise, ParsedError(AGREEMENT_FAILED, Message.agreementFailed, normalized(message)), cause)
    }

    fun rejectRequestInProgress(promise: Promise) {
        rejectParsed(promise, ParsedError(REQUEST_IN_PROGRESS, Message.requestInProgress))
    }

    fun rejectRequestTimeout(promise: Promise) {
        rejectParsed(promise, ParsedError(REQUEST_TIMEOUT, Message.requestTimeout))
    }

    // SDK 에러 변환
    private fun sdkError(fallbackCode: String, fallbackMessage: String, message: String?): ParsedError {
        val sdkMessage = normalized(message) ?: normalized(NaverIdLoginSDK.getLastErrorDescription())
        val code = if (isInvalidClientError(sdkMessage)) INVALID_CLIENT else fallbackCode
        val errorMessage = if (code == INVALID_CLIENT) Message.invalidClient else fallbackMessage

        return ParsedError(
            code = code,
            message = errorMessage,
            sdkMessage = sdkMessage,
        )
    }

    // 설정 오류 분리
    private fun isInvalidClientError(message: String?): Boolean {
        val lowercased = message?.lowercase() ?: return false
        return lowercased.contains("client") ||
            lowercased.contains("package") ||
            lowercased.contains("scheme") ||
            lowercased.contains("redirect")
    }

    // 에러 응답 변환
    private fun rejectParsed(promise: Promise, parsed: ParsedError, cause: Throwable? = null) {
        val userInfo = Arguments.createMap()

        parsed.sdkMessage?.let {
            userInfo.putString("sdkMessage", it)
        }

        promise.reject(parsed.code, parsed.message, cause, userInfo)
    }

    // 문자열 정규화
    private fun normalized(value: String?): String? {
        return value?.trim()?.takeIf { it.isNotEmpty() }
    }
}
