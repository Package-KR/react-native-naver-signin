import { type ConfigPlugin, withInfoPlist, withAppDelegate, withXcodeProject } from '@expo/config-plugins';
import { readFile, writeFile } from 'node:fs';
import type { NaverSigninPluginProps } from '..';

const NAVER_QUERY_SCHEMES = ['naversearchapp', 'naversearchthirdlogin', 'navernidlogin', 'naverroutine'];
const NAVER_URL_NAME = 'NAVER';
const NAVER_URL_TYPE_ROLE = 'Editor';

const NAVER_SDK_VERSION_VARIABLE = '$NaverSDKVersion';
const NAVER_SDK_VERSION_REGEX = /\$NaverSDKVersion\=.*(\r\n|\r|\n)/g;

const resolveExpoAppName = (config: Parameters<ConfigPlugin<NaverSigninPluginProps>>[0]): string | undefined => {
  return config.ios?.infoPlist?.CFBundleDisplayName ?? config.name ?? config.slug;
};

/**
 * Info.plist에 네이버 URL Scheme, NAVER_CLIENT_ID, LSApplicationQueriesSchemes 추가
 */
const modifyInfoPlist: ConfigPlugin<NaverSigninPluginProps> = (config, props) => {
  return withInfoPlist(config, config => {
    const naverScheme = props.naverUrlScheme ?? `naverlogin${props.naverClientId}`;

    // 네이버 클라이언트 정보
    config.modResults.NAVER_CLIENT_ID = props.naverClientId;
    config.modResults.NAVER_CLIENT_SECRET = props.naverClientSecret;
    config.modResults.NAVER_URL_SCHEME = naverScheme;
    const appName = props.naverAppName ?? resolveExpoAppName(config);

    if (appName) {
      config.modResults.NAVER_APP_NAME = appName;
    }

    // CFBundleURLTypes - configured scheme 등록
    if (!Array.isArray(config.modResults.CFBundleURLTypes)) {
      config.modResults.CFBundleURLTypes = [];
    }

    const naverUrlType = config.modResults.CFBundleURLTypes.find(item =>
      item.CFBundleURLSchemes?.includes(naverScheme),
    );

    if (naverUrlType) {
      const mutableNaverUrlType = naverUrlType as typeof naverUrlType & {
        CFBundleTypeRole?: string;
        CFBundleURLName?: string;
      };

      mutableNaverUrlType.CFBundleTypeRole ??= NAVER_URL_TYPE_ROLE;
      mutableNaverUrlType.CFBundleURLName ??= NAVER_URL_NAME;
    } else {
      config.modResults.CFBundleURLTypes.push({
        CFBundleTypeRole: NAVER_URL_TYPE_ROLE,
        CFBundleURLName: NAVER_URL_NAME,
        CFBundleURLSchemes: [naverScheme],
      } as typeof config.modResults.CFBundleURLTypes[number]);
    }

    // LSApplicationQueriesSchemes - 네이버 앱 탐지용
    if (!Array.isArray(config.modResults.LSApplicationQueriesSchemes)) {
      config.modResults.LSApplicationQueriesSchemes = [];
    }

    [naverScheme, ...NAVER_QUERY_SCHEMES].forEach(scheme => {
      if (!config.modResults.LSApplicationQueriesSchemes?.includes(scheme)) {
        config.modResults.LSApplicationQueriesSchemes?.push(scheme);
      }
    });

    return config;
  });
};

/**
 * AppDelegate에 네이버 로그인 URL 처리 코드 주입
 */
const modifyAppDelegate: ConfigPlugin<NaverSigninPluginProps> = (config, _props) => {
  return withAppDelegate(config, config => {
    const contents = config.modResults.contents;

    // import 추가
    if (!contents.includes('import NaverThirdPartyLogin')) {
      config.modResults.contents = config.modResults.contents.replace(
        /import Expo\n/,
        'import Expo\nimport NaverThirdPartyLogin\n',
      );
    }

    // openURL 메서드에 네이버 URL 처리 추가
    if (!contents.includes('NaverThirdPartyLoginConnection')) {
      config.modResults.contents = config.modResults.contents.replace(
        /(open url: URL,\n\s*options: \[UIApplication\.OpenURLOptionsKey: Any\] = \[:\]\n\s*\) -> Bool \{)\n\s*(return )/,
        `$1\n    if NaverThirdPartyLoginConnection.getSharedInstance().receiveAccessToken(url) {\n      return true\n    }\n    $2`,
      );
    }

    return config;
  });
};

const readFileAsync = (path: string): Promise<string> =>
  new Promise((resolve, reject) => readFile(path, 'utf8', (err, data) => (err ? reject(err) : resolve(data))));

const writeFileAsync = (path: string, data: string): Promise<void> =>
  new Promise((resolve, reject) => writeFile(path, data, err => (err ? reject(err) : resolve())));

/**
 * Podfile에 $NaverSDKVersion 변수 주입
 * overrideNaverSDKVersion이 지정된 경우에만 동작
 */
const modifyPodfile: ConfigPlugin<NaverSigninPluginProps> = (config, props) => {
  return withXcodeProject(config, async config => {
    const iosPath = config.modRequest.platformProjectRoot;
    const podfile = await readFileAsync(`${iosPath}/Podfile`);

    // 기존 $NaverSDKVersion 선언 제거
    const cleanedPodfile = podfile.replace(NAVER_SDK_VERSION_REGEX, '');

    if (props.overrideNaverSDKVersion) {
      const newPodfile = cleanedPodfile.concat(`${NAVER_SDK_VERSION_VARIABLE}="${props.overrideNaverSDKVersion}"\n`);
      await writeFileAsync(`${iosPath}/Podfile`, newPodfile);
    } else {
      await writeFileAsync(`${iosPath}/Podfile`, cleanedPodfile);
    }

    return config;
  });
};

export const withIosNaverSignin: ConfigPlugin<NaverSigninPluginProps> = (config, props) => {
  config = modifyInfoPlist(config, props);
  config = modifyAppDelegate(config, props);
  config = modifyPodfile(config, props);

  return config;
};
