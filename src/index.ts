import NativeNaverSignin from './NativeRNNaverSignin';

import type { NaverOAuthToken, NaverProfile } from './types';

// 네이버 로그인
export const login = (): Promise<NaverOAuthToken> => {
  return NativeNaverSignin.login() as unknown as Promise<NaverOAuthToken>;
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
  return NativeNaverSignin.getProfile() as unknown as Promise<NaverProfile>;
};

export * from './types';
