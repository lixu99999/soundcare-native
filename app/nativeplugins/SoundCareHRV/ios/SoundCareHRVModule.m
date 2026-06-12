//
//  SoundCareHRVModule.m
//  SoundCareHRV
//
//  ObjC 桥接文件：仅用于 UNI_EXPORT_METHOD 注册方法到 JS runtime。
//  实际实现见 SoundCareHRVModule.swift。
//
//  注意：DCUniPlugin 框架由 HBuilderX 自定义基座提供。
//  如果集成时遇到 "DCUniPlugin.h not found"，请检查：
//  1. HBuilderX 自定义基座已勾选 HealthKit
//  2. Framework Search Paths 包含 DCUniPlugin.framework
//

#import "DCUniPlugin.h"

@interface SoundCareHRVModule : DCUniModule
@end

@implementation SoundCareHRVModule

// 注册 6 个 JS 可调用方法
// 格式：@selector(Swift方法名ObjC化:第二个参数名:)
UNI_EXPORT_METHOD(@selector(isAvailable:callback:))
UNI_EXPORT_METHOD(@selector(requestAuthorization:callback:))
UNI_EXPORT_METHOD(@selector(startMonitoring:callback:))
UNI_EXPORT_METHOD(@selector(stopMonitoring:callback:))
UNI_EXPORT_METHOD(@selector(getLatest:callback:))
UNI_EXPORT_METHOD(@selector(setMockMode:callback:))

@end
