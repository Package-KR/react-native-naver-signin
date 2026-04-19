#import <React/RCTBridgeModule.h>
#import <RNNaverSigninSpec/RNNaverSigninSpec.h>

@interface RCT_EXTERN_MODULE(RNNaverSignin, NSObject)

RCT_EXTERN_METHOD(login:(RCTPromiseResolveBlock *)resolve reject:(RCTPromiseRejectBlock *)reject);
RCT_EXTERN_METHOD(logout:(RCTPromiseResolveBlock *)resolve reject:(RCTPromiseRejectBlock *)reject);
RCT_EXTERN_METHOD(deleteAccount:(RCTPromiseResolveBlock *)resolve reject:(RCTPromiseRejectBlock *)reject);
RCT_EXTERN_METHOD(getProfile:(RCTPromiseResolveBlock *)resolve reject:(RCTPromiseRejectBlock *)reject);

@end
