import { type ConfigPlugin, withInfoPlist, withAppDelegate, withDangerousMod } from '@expo/config-plugins';
import { readFile, writeFile } from 'node:fs/promises';
import type { NaverSigninPluginProps } from '..';

// iOS URL scheme 및 AppDelegate 주입 상수
const NAVER_QUERY_SCHEMES = ['naversearchapp', 'naversearchthirdlogin'];
const NAVER_URL_NAME = 'NAVER';
const NAVER_URL_TYPE_ROLE = 'Editor';
const NAVER_OPEN_URL_MARKER_START = '// @package-kr/react-native-naver-signin open-url start';
const NAVER_OPEN_URL_MARKER_END = '// @package-kr/react-native-naver-signin open-url end';
const NAVER_OPEN_URL_BLOCK_REGEX =
  /\n?[ \t]*\/\/ @package-kr\/react-native-naver-signin open-url start[\s\S]*?\/\/ @package-kr\/react-native-naver-signin open-url end\r?\n?/m;

// Podfile Naver SDK 버전 override 상수
const NAVER_SDK_VERSION_VARIABLE = '$NaverSDKVersion';
const NAVER_SDK_VERSION_MARKER_START = '# @package-kr/react-native-naver-signin NaverSDKVersion start';
const NAVER_SDK_VERSION_MARKER_END = '# @package-kr/react-native-naver-signin NaverSDKVersion end';
const NAVER_SDK_VERSION_REGEX =
  /\s*# @package-kr\/react-native-naver-signin NaverSDKVersion start\r?\n\s*\$NaverSDKVersion\s*=\s*["'][^"']*["']\r?\n\s*# @package-kr\/react-native-naver-signin NaverSDKVersion end\r?\n?/m;
const LEGACY_NAVER_SDK_VERSION_REGEX = /\n?\s*\$NaverSDKVersion\s*=\s*["'][^"']*["']\r?\n?/g;

const resolveExpoAppName = (config: Parameters<ConfigPlugin<NaverSigninPluginProps>>[0]): string | undefined => {
  return config.ios?.infoPlist?.CFBundleDisplayName ?? config.name ?? config.slug;
};

// AppDelegate.swift에 필요한 Swift import 추가
const addSwiftImport = (contents: string, moduleName: string): string => {
  if (new RegExp(`^\\s*import\\s+${moduleName}\\s*$`, 'm').test(contents)) {
    return contents;
  }

  const nextContents = contents.replace(/(import .+\n)(?!import )/, `$1import ${moduleName}\n`);

  if (nextContents === contents) {
    throw new Error(`[@package-kr/react-native-naver-signin] Unable to add ${moduleName} import to AppDelegate.swift`);
  }

  return nextContents;
};

// AppDelegate.swift의 application(_:open:options:) 메서드 탐색
const openUrlMethodRegex =
  /(^[ \t]*(?:(?:public|internal|private|fileprivate|open|override)\s+)*func\s+application\s*\(\s*_\s+\w+\s*:\s*UIApplication\s*,\s*open\s+url\s*:\s*URL\s*,\s*options\s*:\s*\[UIApplication\.OpenURLOptionsKey\s*:\s*Any\](?:\s*=\s*\[:\])?\s*\)\s*->\s*Bool\s*\{)/m;

// 네이버 URL open handler 블록 생성
const createNaverOpenUrlBlock = (indent: string): string =>
  [
    `${indent}${NAVER_OPEN_URL_MARKER_START}`,
    `${indent}if RNNaverSignin.handleOpen(url) {`,
    `${indent}  return true`,
    `${indent}}`,
    `${indent}${NAVER_OPEN_URL_MARKER_END}`,
  ].join('\n');

// 이전 플러그인 주입 블록 제거
// 짧은 helper 방식 이전에 주입했던 verbose AppDelegate 코드까지 정리합니다.
const removeNaverOpenUrlBlock = (contents: string): string =>
  contents
    .replace(NAVER_OPEN_URL_BLOCK_REGEX, '\n')
    .replace(
      /\n?[ \t]*if\s+RNNaverSignin\.handleOpen(?:Url)?\(url\)\s*\{\r?\n[ \t]*return\s+true\r?\n[ \t]*\}\r?\n?/m,
      '\n',
    )
    .replace(
      /\n?[ \t]*if\s+NaverThirdPartyLoginConnection\.getSharedInstance\(\)\.receiveAccessToken\(url\)\s*\{\r?\n[ \t]*return\s+true\r?\n[ \t]*\}\r?\n?/m,
      '\n',
    )
    .replace(
      /\n?[ \t]*let\s+naverResult\s*=\s*NaverThirdPartyLoginConnection\.getSharedInstance\(\)\?\.receiveAccessToken\(url\)\r?\n[ \t]*if\s+naverResult\?\.rawValue\s*==\s*0\s*\{\r?\n[ \t]*return\s+true\r?\n[ \t]*\}\r?\n?/m,
      '\n',
    );

const findMatchingBraceIndex = (contents: string, openBraceIndex: number): number => {
  let depth = 0;

  for (let index = openBraceIndex; index < contents.length; index += 1) {
    const char = contents[index];
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
};

const findClassClosingBraceIndex = (contents: string, className: string): number => {
  const classMatch = new RegExp(`\\bclass\\s+${className}\\b[^{]*\\{`).exec(contents);
  if (!classMatch) {
    return -1;
  }

  return findMatchingBraceIndex(contents, classMatch.index + classMatch[0].lastIndexOf('{'));
};

const findAppDelegateClosingBraceIndex = (contents: string): number =>
  findClassClosingBraceIndex(contents, 'AppDelegate');

/**
 * AppDelegate.swift에 네이버 URL open handler 주입
 * 기존 application(_:open:options:)가 있으면 보존하고 네이버 처리만 앞에 추가
 */
const injectNaverOpenUrlHandler = (contents: string): string => {
  const cleanedContents = removeNaverOpenUrlBlock(contents);
  const existingMethod = openUrlMethodRegex.exec(cleanedContents);

  if (existingMethod) {
    return cleanedContents.replace(openUrlMethodRegex, `$1\n${createNaverOpenUrlBlock('    ')}`);
  }

  const closingBraceIndex = findAppDelegateClosingBraceIndex(cleanedContents);
  if (closingBraceIndex < 0) {
    throw new Error(
      '[@package-kr/react-native-naver-signin] Unable to find AppDelegate class in AppDelegate.swift. Add application(_:open:options:) manually or use a supported Expo AppDelegate template.',
    );
  }

  const handler = createNaverOpenUrlBlock('    ');
  const openUrlMethod = `  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
${handler}
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }`;

  return `${cleanedContents.slice(0, closingBraceIndex)}\n\n${openUrlMethod}\n${cleanedContents.slice(closingBraceIndex)}`;
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
    if (props.disableNaverAppAuthIOS) {
      config.modResults.NAVER_DISABLE_NAVER_APP_AUTH_IOS = true;
    } else {
      delete config.modResults.NAVER_DISABLE_NAVER_APP_AUTH_IOS;
    }
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

    NAVER_QUERY_SCHEMES.forEach(scheme => {
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
    const language = (config.modResults as { language?: string }).language;

    if (language !== undefined && language !== 'swift') {
      throw new Error(
        '[@package-kr/react-native-naver-signin] Only Swift AppDelegate templates are supported. Add Naver URL handling manually for Objective-C AppDelegate projects.',
      );
    }

    config.modResults.contents = addSwiftImport(config.modResults.contents, 'React');
    config.modResults.contents = addSwiftImport(config.modResults.contents, 'RNNaverSignin');
    config.modResults.contents = injectNaverOpenUrlHandler(config.modResults.contents);

    return config;
  });
};

/**
 * Podfile에 $NaverSDKVersion 변수 주입
 * iOS SDK override가 지정된 경우에만 동작
 */
const modifyPodfile: ConfigPlugin<NaverSigninPluginProps> = (config, props) => {
  return withDangerousMod(config, [
    'ios',
    async config => {
      const iosPath = config.modRequest.platformProjectRoot;
      const podfile = await readFile(`${iosPath}/Podfile`, 'utf8');

      // 기존 $NaverSDKVersion 선언 제거
      // 플러그인 override와 수동 선언이 동시에 적용되지 않도록 정리합니다.
      const cleanedPodfile = props.overrideNaverIosSDKVersion
        ? podfile.replace(NAVER_SDK_VERSION_REGEX, '').replace(LEGACY_NAVER_SDK_VERSION_REGEX, '\n')
        : podfile.replace(NAVER_SDK_VERSION_REGEX, '');

      if (!props.overrideNaverIosSDKVersion) {
        if (cleanedPodfile !== podfile) {
          await writeFile(`${iosPath}/Podfile`, cleanedPodfile);
        }

        return config;
      }

      const declaration = [
        NAVER_SDK_VERSION_MARKER_START,
        `${NAVER_SDK_VERSION_VARIABLE}="${props.overrideNaverIosSDKVersion}"`,
        NAVER_SDK_VERSION_MARKER_END,
      ].join('\n');
      const targetRegex = /^target\s+["'][^"']+["']\s+do\s*$/m;
      const newPodfile = targetRegex.test(cleanedPodfile)
        ? cleanedPodfile.replace(targetRegex, `${declaration}\n$&`)
        : `${declaration}\n${cleanedPodfile}`;

      if (newPodfile !== podfile) {
        await writeFile(`${iosPath}/Podfile`, newPodfile);
      }

      return config;
    },
  ]);
};

export const withIosNaverSignin: ConfigPlugin<NaverSigninPluginProps> = (config, props) => {
  return [modifyInfoPlist, modifyAppDelegate, modifyPodfile].reduce(
    (nextConfig, plugin) => plugin(nextConfig, props),
    config,
  );
};
