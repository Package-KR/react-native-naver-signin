import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export type NativeNaverOAuthToken = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresAt: string;
};

export type NativeNaverProfile = {
  id?: string | null;
  nickname?: string | null;
  name?: string | null;
  email?: string | null;
  profileImage?: string | null;
  gender?: string | null;
  age?: string | null;
  birthday?: string | null;
  birthyear?: string | null;
  mobile?: string | null;
};

export type NativeNaverAgreementInfo = {
  termCode: string;
  clientId: string;
  agreeDate: string;
};

export type NativeNaverAgreement = {
  result: string;
  accessToken: string;
  agreementInfos: NativeNaverAgreementInfo[];
};

export interface Spec extends TurboModule {
  login(): Promise<NativeNaverOAuthToken>;
  logout(): Promise<string>;
  deleteAccount(): Promise<string>;
  getProfile(): Promise<NativeNaverProfile>;
  getAgreement(): Promise<NativeNaverAgreement>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('RNNaverSignin');
