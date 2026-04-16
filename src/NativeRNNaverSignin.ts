import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  login(): Promise<{ [key: string]: Object }>;
  logout(): Promise<string>;
  deleteAccount(): Promise<string>;
  getProfile(): Promise<{ [key: string]: Object }>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('RNNaverSignin');
