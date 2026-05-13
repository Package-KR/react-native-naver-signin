# Naver Console Setup

이 문서는 `@package-kr/react-native-naver-signin`을 사용하기 전에 네이버 개발자 센터에서 확인해야 하는 설정을 정리합니다.

## 1. 애플리케이션 등록

1. [네이버 개발자 센터](https://developers.naver.com/apps)에서 애플리케이션을 생성합니다.
2. `Client ID`와 `Client Secret`을 확인합니다.
3. iOS와 Android 플랫폼 정보를 각각 등록합니다.

## 2. iOS 설정

네이버 개발자 센터의 iOS 설정에서 앱의 Bundle Identifier와 URL Scheme을 등록합니다.

Expo 예제 기본값:

```text
Bundle Identifier: kr.packagekr.naver.signin
URL Scheme: naverloginclientid
```

CLI 예제 기본값:

```text
Bundle Identifier: org.reactjs.native.example.RNNaverSigninCliExample
URL Scheme: naverloginclientid
```

각 예제의 `app.json` 또는 `Info.plist`에 네이버 콘솔에 등록한 URL Scheme과 같은 값을 넣어야 합니다.

## 3. Android 설정

네이버 개발자 센터의 Android 설정에서 앱 패키지 이름을 등록합니다.

Expo 예제 기본값:

```text
Package Name: kr.packagekr.naver.signin
```

CLI 예제 기본값:

```text
Package Name: kr.packagekr.naver.signin
```

릴리스 빌드에서는 네이버 콘솔에 실제 릴리스 서명 키 정보를 함께 등록해야 합니다.

## 4. 예제 앱 설정

CLI 예제:

```text
example/RNNaverSigninCliExample/android/app/src/main/res/values/strings.xml
example/RNNaverSigninCliExample/ios/RNNaverSigninCliExample/Info.plist
```

Expo 예제:

```text
example/RNNaverSigninExpoExample/app.json
```

`NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`, `naverloginclientid` placeholder를 실제 값으로 바꾼 뒤 빌드합니다.

## 5. QA 체크리스트

배포 전 아래 항목을 확인합니다.

- CLI iOS: 앱 실행, 로그인, 프로필 조회, 로그아웃, 연동 해제
- CLI Android: 앱 실행, 로그인, 프로필 조회, 로그아웃, 연동 해제
- Expo iOS: `npx expo prebuild --clean --platform ios`, 앱 실행, URL callback
- Expo Android: `npx expo prebuild --clean --platform android`, 앱 실행, strings.xml 생성
- TypeScript: 루트 `npx tsc --noEmit`
- Config plugin: `npm run build:plugin`
