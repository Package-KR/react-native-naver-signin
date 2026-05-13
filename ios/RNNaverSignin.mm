// React Native 브리지 / TurboModule 연결
#import <React/RCTBridgeModule.h>

#ifdef RCT_NEW_ARCH_ENABLED
#if __has_include(<RNNaverSigninSpec/RNNaverSigninSpec.h>)
#define RNNAVER_SIGNIN_HAS_CODEGEN 1
#import <RNNaverSigninSpec/RNNaverSigninSpec.h>
#endif
#endif

@interface RCT_EXTERN_MODULE(RNNaverSignin, NSObject)

// JavaScript 브리지 export
RCT_EXTERN_METHOD(login:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject);
RCT_EXTERN_METHOD(logout:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject);
RCT_EXTERN_METHOD(deleteAccount:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject);
RCT_EXTERN_METHOD(getProfile:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject);
RCT_EXTERN_METHOD(getAgreement:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject);

@end

#ifdef RNNAVER_SIGNIN_HAS_CODEGEN

// New Architecture TurboModule 연결
@interface RNNaverSignin () <NativeRNNaverSigninSpec>
@end

@implementation RNNaverSignin (TurboModule)

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeRNNaverSigninSpecJSI>(params);
}

@end

#endif
