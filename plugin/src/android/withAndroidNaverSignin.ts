import {
  AndroidConfig,
  type ConfigPlugin,
  withStringsXml,
  withProjectBuildGradle,
} from '@expo/config-plugins';
import type { NaverSigninPluginProps } from '..';

/**
 * strings.xml에 naver_client_id, naver_client_secret, naver_app_name 추가
 */
const modifyStringsXml: ConfigPlugin<NaverSigninPluginProps> = (config, props) => {
  return withStringsXml(config, config => {
    AndroidConfig.Strings.setStringItem(
      [
        { $: { name: 'naver_client_id' }, _: props.naverClientId },
        { $: { name: 'naver_client_secret' }, _: props.naverClientSecret },
        { $: { name: 'naver_app_name' }, _: props.naverAppName },
      ],
      config.modResults,
    );

    return config;
  });
};

/**
 * build.gradle에 naverSdkVersion ext 속성 주입
 * overrideNaverSDKVersion이 지정된 경우에만 동작
 */
const modifyProjectBuildGradle: ConfigPlugin<NaverSigninPluginProps> = (config, props) => {
  if (!props.overrideNaverSDKVersion) return config;

  return withProjectBuildGradle(config, config => {
    const contents = config.modResults.contents;
    const extProperty = `naverSdkVersion = "${props.overrideNaverSDKVersion}"`;

    // 이미 naverSdkVersion이 선언되어 있으면 교체
    if (contents.includes('naverSdkVersion')) {
      config.modResults.contents = contents.replace(/naverSdkVersion\s*=\s*"[^"]*"/, extProperty);
      return config;
    }

    // ext 블록이 있으면 그 안에 추가
    if (contents.includes('ext {')) {
      config.modResults.contents = contents.replace(/ext\s*{/, `ext {\n        ${extProperty}`);
    } else {
      // ext 블록이 없으면 새로 생성
      config.modResults.contents = contents.replace(
        /buildscript\s*{/,
        `buildscript {\n    ext {\n        ${extProperty}\n    }`,
      );
    }

    return config;
  });
};

export const withAndroidNaverSignin: ConfigPlugin<NaverSigninPluginProps> = (config, props) => {
  config = modifyStringsXml(config, props);
  config = modifyProjectBuildGradle(config, props);

  return config;
};
