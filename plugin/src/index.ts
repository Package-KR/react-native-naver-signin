import { ConfigPlugin, createRunOncePlugin } from '@expo/config-plugins';

import { withAndroidNaverSignin } from './android/withAndroidNaverSignin';
import { withIosNaverSignin } from './ios/withIosNaverSignin';

export interface NaverSigninPluginProps {
  naverClientId: string;
  naverClientSecret: string;
  naverAppName?: string;
  naverUrlScheme?: string;
  overrideNaverSDKVersion?: string;
}

const withNaverSignin: ConfigPlugin<NaverSigninPluginProps> = (config, props) => {
  if (!props?.naverClientId) {
    throw new Error('[@package-kr/react-native-naver-signin] naverClientId is required');
  }
  if (!props?.naverClientSecret) {
    throw new Error('[@package-kr/react-native-naver-signin] naverClientSecret is required');
  }

  config = withIosNaverSignin(config, props);
  config = withAndroidNaverSignin(config, props);

  return config;
};

const pak = require('../../package.json');
export default createRunOncePlugin(withNaverSignin, pak.name, pak.version);
