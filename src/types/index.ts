import type {
  NativeNaverAgreement,
  NativeNaverAgreementInfo,
  NativeNaverOAuthToken,
  NativeNaverProfile,
} from '../NativeRNNaverSignin';

// 에러 코드
export const NAVER_ERROR_CODES = [
  'NAVER_ACTIVITY_DOES_NOT_EXIST',
  'NAVER_DELETE_FAILED',
  'NAVER_AGREEMENT_FAILED',
  'NAVER_ERROR',
  'NAVER_INVALID_CLIENT',
  'NAVER_LOGIN_FAILED',
  'NAVER_MISCONFIGURED',
  'NAVER_NOT_LOGGED_IN',
  'NAVER_PROFILE_FAILED',
  'NAVER_REQUEST_IN_PROGRESS',
  'NAVER_REQUEST_TIMEOUT',
] as const;

export type NaverErrorCode = (typeof NAVER_ERROR_CODES)[number] | `NAVER_ERROR_${number}`;

// 에러 타입
export type NaverSigninError = Error & {
  code: NaverErrorCode;
  sdkMessage?: string;
  userInfo?: {
    sdkMessage?: string;
  };
};

export type NaverOAuthToken = NativeNaverOAuthToken;
export type NaverProfile = NativeNaverProfile;
export type NaverAgreementInfo = NativeNaverAgreementInfo;
export type NaverAgreement = NativeNaverAgreement;
