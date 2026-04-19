import { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  login,
  logout,
  getProfile,
} from '@package-kr/react-native-naver-signin';
import type {
  NaverOAuthToken,
  NaverProfile,
} from '@package-kr/react-native-naver-signin';

import { styles } from './login.styles';

const TOKEN_KEY_ORDER: (keyof NaverOAuthToken)[] = [
  'accessToken',
  'refreshToken',
  'tokenType',
  'expiresAt',
];

const PROFILE_KEY_ORDER: (keyof NaverProfile)[] = [
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
];

// 중요도 순서대로 키를 정렬하여 JSON 변환
function sortedStringify(data: object, keyOrder: string[]): string {
  const sorted: Record<string, any> = {};
  for (const key of keyOrder) {
    if (key in data) {
      sorted[key] = (data as any)[key] ?? null;
    }
  }

  for (const key of Object.keys(data)) {
    if (!(key in sorted)) {
      sorted[key] = (data as any)[key] ?? null;
    }
  }
  return JSON.stringify(sorted, null, 2);
}

function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [responseText, setResponseText] = useState('');

  const handleLogin = async () => {
    try {
      const token = await login();
      setIsLoggedIn(true);
      setResponseText(sortedStringify(token, TOKEN_KEY_ORDER));
    } catch (e: any) {
      setResponseText(
        JSON.stringify({ error: e.code, message: e.message }, null, 2),
      );
    }
  };

  const handleGetProfile = async () => {
    try {
      const p = await getProfile();
      setResponseText(sortedStringify(p, PROFILE_KEY_ORDER));
    } catch (e: any) {
      setResponseText(
        JSON.stringify({ error: e.code, message: e.message }, null, 2),
      );
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setIsLoggedIn(false);
      setResponseText('');
    } catch (e: any) {
      setResponseText(
        JSON.stringify({ error: e.code, message: e.message }, null, 2),
      );
    }
  };

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      {/* 상단 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>react-native-naver-signin</Text>
      </View>

      {/* 가운데 response */}
      <View style={styles.responseBox}>
        <ScrollView>
          <Text style={styles.responseText}>{responseText}</Text>
        </ScrollView>
      </View>

      {/* 하단 버튼 */}
      <View style={styles.buttons}>
        {!isLoggedIn ? (
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.naverButton}
              onPress={handleLogin}
              activeOpacity={0.8}
            >
              <Text style={styles.naverButtonText}>네이버로 시작하기</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.profileButton}
                onPress={handleGetProfile}
                activeOpacity={0.8}
              >
                <Text style={styles.profileButtonText}>프로필 조회</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.logoutButton}
                onPress={handleLogout}
                activeOpacity={0.8}
              >
                <Text style={styles.logoutButtonText}>로그아웃</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

export default LoginScreen;
