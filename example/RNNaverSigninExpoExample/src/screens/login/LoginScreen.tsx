import { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  deleteAccount,
  getAgreement,
  getProfile,
  isNaverSigninError,
  login,
  logout,
} from '@package-kr/react-native-naver-signin';
import type {
  NaverAgreement,
  NaverOAuthToken,
  NaverProfile,
} from '@package-kr/react-native-naver-signin';

import { styles } from './login.styles';

const TOKEN_KEY_ORDER = [
  'accessToken',
  'refreshToken',
  'tokenType',
  'expiresAt',
] as const satisfies readonly (keyof NaverOAuthToken)[];

const PROFILE_KEY_ORDER = [
  'id',
  'nickname',
  'name',
  'email',
  'profileImage',
  'gender',
  'age',
  'birthday',
  'birthyear',
  'mobile',
] as const satisfies readonly (keyof NaverProfile)[];

const AGREEMENT_KEY_ORDER = [
  'result',
  'accessToken',
  'agreementInfos',
] as const satisfies readonly (keyof NaverAgreement)[];

const RESPONSE_LABELS = {
  agreement: '동의 항목',
  profile: '프로필',
  token: '토큰',
  error: '오류',
} as const;

type ResponseType = keyof typeof RESPONSE_LABELS;

function sortedStringify(data: unknown, keyOrder: readonly string[] = []): string {
  if (typeof data !== 'object' || data == null || Array.isArray(data)) {
    return JSON.stringify(data, null, 2);
  }

  const sorted: Record<string, unknown> = {};
  const entries = new Map(Object.entries(data));

  for (const key of keyOrder) {
    if (entries.has(key)) {
      sorted[key] = entries.get(key) ?? null;
    }
  }

  for (const key of Object.keys(data)) {
    if (!(key in sorted)) {
      sorted[key] = entries.get(key) ?? null;
    }
  }

  return JSON.stringify(sorted, null, 2);
}

function createErrorBody(error: unknown): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  const sdkMessage = (
    error as { sdkMessage?: unknown; userInfo?: { sdkMessage?: unknown } }
  ).sdkMessage;
  const userInfoSdkMessage = (
    error as { userInfo?: { sdkMessage?: unknown } }
  ).userInfo?.sdkMessage;

  if (isNaverSigninError(error)) {
    body.code = error.code;
    body.message = error.message;
  } else if (error instanceof Error) {
    body.message = error.message;
  } else {
    body.message = 'Unknown error';
  }

  if (typeof sdkMessage === 'string') {
    body.sdkMessage = sdkMessage;
  } else if (typeof userInfoSdkMessage === 'string') {
    body.sdkMessage = userInfoSdkMessage;
  }

  return body;
}

function errorStringify(error: unknown): string {
  return JSON.stringify(createErrorBody(error), null, 2);
}

function agreementErrorStringify(error: unknown): string {
  const body = createErrorBody(error);
  const sdkMessage = typeof body.sdkMessage === 'string' ? body.sdkMessage : '';

  if (
    body.code === 'NAVER_AGREEMENT_FAILED' &&
    sdkMessage.includes('HTTP 404')
  ) {
    body.message =
      '현재 앱에서 네이버 동의 항목 API를 사용할 수 없습니다.';
    body.hint =
      '네이버 개발자 센터에서 약관 동의 대행 기능을 설정한 앱에서만 조회할 수 있습니다.';
  }

  return JSON.stringify(body, null, 2);
}

function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [tokenText, setTokenText] = useState('');
  const [profileText, setProfileText] = useState('');
  const [agreementText, setAgreementText] = useState('');
  const [responseText, setResponseText] = useState('');
  const [responseType, setResponseType] = useState<ResponseType>('token');

  const handleLogin = async () => {
    try {
      const token = await login();
      const nextTokenText = sortedStringify(token, TOKEN_KEY_ORDER);

      setIsLoggedIn(true);
      setTokenText(nextTokenText);
      setProfileText('');
      setAgreementText('');
      setResponseText(nextTokenText);
      setResponseType('token');
    } catch (error) {
      setResponseText(errorStringify(error));
      setResponseType('error');
    }
  };

  const handleShowToken = () => {
    setResponseText(tokenText);
    setResponseType('token');
  };

  const handleGetProfile = async () => {
    if (profileText) {
      setResponseText(profileText);
      setResponseType('profile');
      return;
    }

    try {
      const profile = await getProfile();
      const nextProfileText = sortedStringify(profile, PROFILE_KEY_ORDER);

      setProfileText(nextProfileText);
      setResponseText(nextProfileText);
      setResponseType('profile');
    } catch (error) {
      setResponseText(errorStringify(error));
      setResponseType('error');
    }
  };

  const handleGetAgreement = async () => {
    if (agreementText) {
      setResponseText(agreementText);
      setResponseType('agreement');
      return;
    }

    try {
      const agreement = await getAgreement();
      const nextAgreementText = sortedStringify(agreement, AGREEMENT_KEY_ORDER);

      setAgreementText(nextAgreementText);
      setResponseText(nextAgreementText);
      setResponseType('agreement');
    } catch (error) {
      const nextAgreementText = agreementErrorStringify(error);

      setAgreementText(nextAgreementText);
      setResponseText(nextAgreementText);
      setResponseType('agreement');
    }
  };

  const handleLogout = async () => {
    try {
      await deleteAccount();
      await logout();
      setIsLoggedIn(false);
      setTokenText('');
      setProfileText('');
      setAgreementText('');
      setResponseText('');
      setResponseType('token');
    } catch (error) {
      setResponseText(errorStringify(error));
      setResponseType('error');
    }
  };

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>react-native-naver-signin</Text>
      </View>

      <View style={styles.responseBox}>
        <>
          {responseText ? (
            <Text style={styles.responseLabel}>
              {RESPONSE_LABELS[responseType]}
            </Text>
          ) : null}
          <ScrollView>
            <Text style={styles.responseText}>{responseText}</Text>
          </ScrollView>
        </>
      </View>

      <View style={styles.buttons}>
        {!isLoggedIn ? (
          <TouchableOpacity
            style={styles.naverButton}
            onPress={handleLogin}
            activeOpacity={0.8}
          >
            <Text style={styles.naverButtonText}>네이버로 시작하기</Text>
          </TouchableOpacity>
        ) : (
          <>
            <View style={styles.apiButtons}>
              <TouchableOpacity
                style={styles.apiButton}
                onPress={handleShowToken}
                activeOpacity={0.8}
              >
                <Text style={styles.apiButtonText}>토큰</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.apiButton}
                onPress={handleGetProfile}
                activeOpacity={0.8}
              >
                <Text style={styles.apiButtonText}>프로필</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.apiButton}
                onPress={handleGetAgreement}
                activeOpacity={0.8}
              >
                <Text style={styles.apiButtonText}>동의 항목</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
              activeOpacity={0.8}
            >
              <Text style={styles.logoutButtonText}>로그아웃</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

export default LoginScreen;
