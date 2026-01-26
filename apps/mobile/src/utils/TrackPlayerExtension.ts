import { NativeModules } from 'react-native';

// 1. 拿到原生模块
// RNTP 的原生模块名通常是 TrackPlayerModule
const { TrackPlayerModule } = NativeModules;

/**
 * 获取当前 Android ExoPlayer 的 Session ID
 * @returns Promise<number> SessionId (如果失败或在 iOS 上，返回 0)
 */
export async function getAudioSessionId(): Promise<number> {
  // 安全检查：如果原生模块没加载，或者是在 iOS 上
  if (!TrackPlayerModule || !TrackPlayerModule.getAudioSessionId) {
    console.warn('getAudioSessionId 不可用 (仅限 Android 且需 Patch)');
    return 0;
  }

  try {
    const sessionId = await TrackPlayerModule.getAudioSessionId();
    console.log('[AudioSessionId] 获取成功:', sessionId);
    return sessionId;
  } catch (error) {
    console.error('[AudioSessionId] 获取失败:', error);
    return 0;
  }
}