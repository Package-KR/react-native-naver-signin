import {
  AndroidConfig,
  type ConfigPlugin,
  withStringsXml,
  withProjectBuildGradle,
} from '@expo/config-plugins';
import type { NaverSigninPluginProps } from '..';

const NAVER_SDK_VERSION_MARKER_START = '// @package-kr/react-native-naver-signin naverSdkVersion start';
const NAVER_SDK_VERSION_MARKER_END = '// @package-kr/react-native-naver-signin naverSdkVersion end';
const NAVER_SDK_VERSION_REGEX =
  /\s*\/\/ @package-kr\/react-native-naver-signin naverSdkVersion start\r?\n\s*naverSdkVersion\s*=\s*["'][^"']*["']\r?\n\s*\/\/ @package-kr\/react-native-naver-signin naverSdkVersion end\r?\n?/m;
const LEGACY_NAVER_SDK_VERSION_REGEX = /\n?\s*naverSdkVersion\s*=\s*["'][^"']*["']\r?\n?/g;

// buildscript.ext 블록에 Naver SDK 버전 변수 삽입
const insertNaverSdkVersionIntoBuildscript = (contents: string, extProperty: string): string => {
  if (!/buildscript\s*\{/.test(contents)) {
    return `buildscript {\n    ext {\n        ${extProperty}\n    }\n}\n\n${contents}`;
  }

  if (!/buildscript\s*\{[\s\S]*?ext\s*\{/.test(contents)) {
    return contents.replace(/buildscript\s*\{/, match => `${match}\n    ext {\n        ${extProperty}\n    }`);
  }

  return contents.replace(/(buildscript\s*\{[\s\S]*?ext\s*\{)/, `$1\n        ${extProperty}`);
};

/**
 * strings.xml에 naver_client_id, naver_client_secret 추가
 * naver_app_name은 지정된 경우에만 추가
 */
const modifyStringsXml: ConfigPlugin<NaverSigninPluginProps> = (config, props) => {
  return withStringsXml(config, config => {
    const stringItems = [
      { $: { name: 'naver_client_id' }, _: props.naverClientId },
      { $: { name: 'naver_client_secret' }, _: props.naverClientSecret },
    ];

    if (props.naverAppName) {
      stringItems.push({ $: { name: 'naver_app_name' }, _: props.naverAppName });
    }

    AndroidConfig.Strings.setStringItem(stringItems, config.modResults);

    return config;
  });
};

/**
 * build.gradle에 naverSdkVersion ext 속성 주입
 * Android SDK override가 지정된 경우에만 동작
 */
const modifyProjectBuildGradle: ConfigPlugin<NaverSigninPluginProps> = (config, props) => {
  return withProjectBuildGradle(config, config => {
    const contents = config.modResults.contents;
    const overrideVersion = props.overrideNaverAndroidSDKVersion ?? props.overrideNaverSDKVersion;
    const cleanedContents = overrideVersion
      ? contents.replace(NAVER_SDK_VERSION_REGEX, '').replace(LEGACY_NAVER_SDK_VERSION_REGEX, '\n')
      : contents.replace(NAVER_SDK_VERSION_REGEX, '');

    if (!overrideVersion) {
      config.modResults.contents = cleanedContents;
      return config;
    }

    const extProperty = [
      NAVER_SDK_VERSION_MARKER_START,
      `naverSdkVersion = "${overrideVersion}"`,
      NAVER_SDK_VERSION_MARKER_END,
    ].join('\n');

    config.modResults.contents = insertNaverSdkVersionIntoBuildscript(cleanedContents, extProperty);
    return config;
  });
};

export const withAndroidNaverSignin: ConfigPlugin<NaverSigninPluginProps> = (config, props) => {
  return [modifyStringsXml, modifyProjectBuildGradle].reduce((nextConfig, plugin) => plugin(nextConfig, props), config);
};
