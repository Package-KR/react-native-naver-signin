import { ConfigPlugin, createRunOncePlugin } from '@expo/config-plugins';

import { withAndroidNaverSignin } from './android/withAndroidNaverSignin';
import { withIosNaverSignin } from './ios/withIosNaverSignin';

export interface NaverSigninPluginProps {
  naverClientId: string;
  naverClientSecret: string;
  naverAppName?: string;
  naverUrlScheme?: string;
  disableNaverAppAuthIOS?: boolean;
  overrideNaverAndroidSDKVersion?: string;
  overrideNaverIosSDKVersion?: string;
  /** @deprecated Use overrideNaverAndroidSDKVersion or overrideNaverIosSDKVersion instead. */
  overrideNaverSDKVersion?: string;
}

// 문자열 입력값 정규화
const trimString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value.trim() : undefined;

const assertSdkVersionString = (name: string, value: string | undefined): void => {
  if (value !== undefined && !/^[0-9A-Za-z][0-9A-Za-z.+_-]*$/.test(value)) {
    throw new Error(`[@package-kr/react-native-naver-signin] ${name} must be a single SDK version string`);
  }
};

const assertLegacyIosSdkVersion = (value: string | undefined): void => {
  if (value === undefined) {
    return;
  }

  const major = /^(\d+)/.exec(value)?.[1];
  if (major !== undefined && Number(major) >= 5) {
    throw new Error(
      '[@package-kr/react-native-naver-signin] overrideNaverIosSDKVersion must be lower than 5.0.0 because this package uses the legacy naveridlogin-sdk-ios 4.x API',
    );
  }
};

// 플러그인 입력값 검증
const normalizePluginProps = (props?: NaverSigninPluginProps): NaverSigninPluginProps => {
  const naverClientId = trimString(props?.naverClientId) ?? '';
  const naverClientSecret = trimString(props?.naverClientSecret) ?? '';

  if (!naverClientId) {
    throw new Error('[@package-kr/react-native-naver-signin] naverClientId is required');
  }
  if (!naverClientSecret) {
    throw new Error('[@package-kr/react-native-naver-signin] naverClientSecret is required');
  }

  const naverUrlScheme = trimString(props?.naverUrlScheme);
  if (naverUrlScheme !== undefined && !/^[A-Za-z][A-Za-z0-9+.-]*$/.test(naverUrlScheme)) {
    throw new Error(
      '[@package-kr/react-native-naver-signin] naverUrlScheme must be a URL scheme value without ://',
    );
  }

  const overrideNaverSDKVersion = trimString(props?.overrideNaverSDKVersion);
  assertSdkVersionString('overrideNaverSDKVersion', overrideNaverSDKVersion);

  const overrideNaverAndroidSDKVersion = trimString(props?.overrideNaverAndroidSDKVersion);
  assertSdkVersionString('overrideNaverAndroidSDKVersion', overrideNaverAndroidSDKVersion);

  const overrideNaverIosSDKVersion = trimString(props?.overrideNaverIosSDKVersion) ?? overrideNaverSDKVersion;
  assertSdkVersionString('overrideNaverIosSDKVersion', overrideNaverIosSDKVersion);
  assertLegacyIosSdkVersion(overrideNaverIosSDKVersion);

  return {
    ...props,
    naverClientId,
    naverClientSecret,
    naverAppName: trimString(props?.naverAppName),
    naverUrlScheme,
    disableNaverAppAuthIOS: props?.disableNaverAppAuthIOS === true,
    overrideNaverAndroidSDKVersion,
    overrideNaverIosSDKVersion,
    overrideNaverSDKVersion,
  };
};

// iOS/Android 설정 적용
const withNaverSignin: ConfigPlugin<NaverSigninPluginProps> = (config, props) => {
  const normalizedProps = normalizePluginProps(props);

  return withAndroidNaverSignin(withIosNaverSignin(config, normalizedProps), normalizedProps);
};

const pak = require('../../package.json');
export default createRunOncePlugin(withNaverSignin, pak.name, pak.version);
