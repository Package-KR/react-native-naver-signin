# RNNaverSigninCliExample

React Native CLI 환경에서 `@package-kr/react-native-naver-signin` 동작을 확인하는 예제입니다.

## 실행

```sh
npm install
```

### iOS

```sh
cd ios
pod install
cd ..
npm run ios
```

### Android

```sh
npm run android
```

## 예제 설정

이 예제는 아래 네이버 개발자 센터 설정으로 맞춰져 있습니다.

| 항목 | 값 |
| --- | --- |
| iOS Bundle ID | `kr.packagekr.naver.signin` |
| Android Package Name | `kr.packagekr.naver.signin` |
| iOS URL Scheme | `navery9mhSU9Q9IV04IyLWncw` |

설정 위치:

- iOS: `ios/RNNaverSigninCliExample/Info.plist`, `ios/RNNaverSigninCliExample/AppDelegate.swift`
- Android: `android/app/src/main/res/values/strings.xml`

다른 네이버 앱으로 검증할 경우 위 파일의 Client ID, Client Secret, URL Scheme과 네이버 개발자 센터 등록값을 같이 변경합니다.
