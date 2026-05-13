import NativeNaverSignin from './NativeRNNaverSignin';

import { NAVER_ERROR_CODES } from './types';
import type { NaverAgreement, NaverErrorCode, NaverOAuthToken, NaverProfile, NaverSigninError } from './types';

const NAVER_ERROR_CODE_SET = new Set<string>(NAVER_ERROR_CODES);

// Android SDK raw error code는 NAVER_ERROR_{code} 형태로 보존합니다.
const isNaverErrorCode = (code: string): code is NaverErrorCode => {
  return NAVER_ERROR_CODE_SET.has(code) || /^NAVER_ERROR_\d+$/.test(code);
};

// 네이버 로그인
export const login = (): Promise<NaverOAuthToken> => {
  return NativeNaverSignin.login();
};

// 로그아웃
export const logout = (): Promise<string> => {
  return NativeNaverSignin.logout();
};

// 회원탈퇴
export const deleteAccount = (): Promise<string> => {
  return NativeNaverSignin.deleteAccount();
};

// 프로필 조회
export const getProfile = (): Promise<NaverProfile> => {
  return NativeNaverSignin.getProfile();
};

// 동의 항목 조회
export const getAgreement = (): Promise<NaverAgreement> => {
  return NativeNaverSignin.getAgreement();
};

// 네이버 로그인 에러 여부 확인
export const isNaverSigninError = (error: unknown): error is NaverSigninError => {
  if (!(error instanceof Error)) {
    return false;
  }

  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && isNaverErrorCode(code) && typeof error.message === 'string';
};

export * from './types';
