package expo.modules.audioeq

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import android.media.audiofx.Equalizer
import android.util.Log

class AudioEqModule : Module() {
  // 定义 EQ 实例
  private var mEqualizer: Equalizer? = null
  private val TAG = "AudioEqModule"

  override fun definition() = ModuleDefinition {
    // 模块在 JS 中的名字
    Name("AudioEq")

    // 1. 初始化均衡器
    // 注意：这需要传入播放器的 AudioSessionId
    Function("initEqualizer") { sessionId: Int ->
      try {
        // 如果已经存在，先释放
        mEqualizer?.release()
        
        // 创建新的均衡器实例，priority 设为 0，绑定到指定 session
        mEqualizer = Equalizer(0, sessionId)
        mEqualizer?.enabled = true
        
        Log.d(TAG, "均衡器初始化成功，SessionID: $sessionId")
        return@Function true
      } catch (e: Exception) {
        Log.e(TAG, "均衡器初始化失败: ${e.message}")
        return@Function false
      }
    }

    // 2. 设置指定频段的增益
    // bandIndex: 频段索引 (通常 0-4)
    // gainValue: 分贝值 (dB)，比如 -10 到 10
    Function("setGain") { bandIndex: Int, gainValue: Int ->
      mEqualizer?.let { eq ->
        try {
          // Android EQ 的单位是 millibels (mB)，1dB = 100mB
          // 还需要检查范围，防止崩溃
          val minLevel = eq.bandLevelRange[0]
          val maxLevel = eq.bandLevelRange[1]
          
          var intensity = (gainValue * 100).toShort()

          // 简单的限制范围逻辑
          if (intensity < minLevel) intensity = minLevel
          if (intensity > maxLevel) intensity = maxLevel

          // 设置
          eq.setBandLevel(bandIndex.toShort(), intensity)
          Log.d(TAG, "设置频段 $bandIndex 为 ${gainValue}dB")
        } catch (e: Exception) {
          Log.e(TAG, "设置增益失败: ${e.message}")
        }
      }
    }

    // 3. 获取支持的频段中心频率 (辅助功能，用于 JS端 显示 UI)
    Function("getBandFreqs") { ->
      val freqs = mutableListOf<Int>()
      mEqualizer?.let { eq ->
        for (i in 0 until eq.numberOfBands) {
           // getCenterFreq 返回的是 milliHertz，需要除以 1000 变成 Hz
           freqs.add(eq.getCenterFreq(i.toShort()) / 1000)
        }
      }
      return@Function freqs
    }

    // 4. 清理资源 (建议在组件卸载时调用)
    Function("release") {
      mEqualizer?.release()
      mEqualizer = null
    }
  }
}