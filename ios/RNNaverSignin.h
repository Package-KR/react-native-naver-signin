#import <Foundation/Foundation.h>

@class RNNaverSignin;

@interface RNNaverSignin : NSObject
+ (BOOL)isNaverLoginUrl:(NSURL *)url;   // 콜백 URL 체크
+ (BOOL)handleOpenUrl:(NSURL *)url;     // 콜백 URL > SDK로 전달
@end
