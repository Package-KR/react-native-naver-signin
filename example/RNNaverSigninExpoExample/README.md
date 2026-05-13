# RNNaverSigninExpoExample

Expo prebuild 환경에서 `@package-kr/react-native-naver-signin` config plugin과 API 동작을 확인하는 예제입니다.

## 실행

```sh
npm install
```

### iOS

```sh
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

config plugin 설정은 `app.json`의 `plugins` 항목에 있습니다.

```json
[
  "@package-kr/react-native-naver-signin",
  {
    "naverClientId": "y9mhSU9Q9IV04IyLWncw",
    "naverClientSecret": "LJplndYiai",
    "naverUrlScheme": "navery9mhSU9Q9IV04IyLWncw"
  }
]
```

Expo Go에서는 네이티브 모듈을 사용할 수 없으므로 `npm run ios` 또는 `npm run android`로 development build를 실행합니다.

다른 네이버 앱으로 검증할 경우 `app.json`의 Client ID, Client Secret, URL Scheme과 네이버 개발자 센터 등록값을 같이 변경합니다.
