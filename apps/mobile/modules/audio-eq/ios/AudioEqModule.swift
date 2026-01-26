import ExpoModulesCore
import AVFoundation

public class AudioEqModule: Module {
  // 定义核心音频引擎组件
  var engine = AVAudioEngine()
  var playerNode = AVAudioPlayerNode()
  var eqNode = AVAudioUnitEQ(numberOfBands: 5) // 5段均衡器

  public func definition() -> ModuleDefinition {
    Name("AudioEq")

    // 1. 初始化引擎和节点连接
    Function("initEqualizer") { (sessionId: Int) in
      // iOS 忽略 sessionId，我们需要自己搭建音频图 (Graph)
      setupAudioEngine()
      print("iOS AudioEngine Setup Complete")
    }

    // 2. 播放 URL (因为 EQ 必须由我们控制播放)
    Function("playUrl") { (urlString: String) in
      guard let url = URL(string: urlString) else { return }
      playAudio(url: url)
    }

    // 3. 设置增益
    Function("setGain") { (bandIndex: Int, gainValue: Float) in
      // 确保索引在 0 到 4 之间
      if bandIndex >= 0 && bandIndex < eqNode.bands.count {
        let band = eqNode.bands[bandIndex]
        band.filterType = .parametric // 参数化均衡器，适合调节音色
        band.frequency = getCenterFreq(index: bandIndex) // 设置中心频率
        band.bandwidth = 1.0 // 影响范围
        band.gain = gainValue // 设置增益 (dB)
        band.bypass = false
        
        print("iOS Set Band \(bandIndex) (\(band.frequency)Hz) to \(gainValue)dB")
      }
    }
    
    // 销毁
    Function("release") {
      engine.stop()
      engine.reset()
    }
  }

  // --- 内部私有辅助方法 ---

  private func setupAudioEngine() {
    // 1. 确保引擎停止以重新配置
    engine.stop()
    engine.detach(playerNode)
    engine.detach(eqNode)

    // 2. 附加节点
    engine.attach(playerNode)
    engine.attach(eqNode)

    // 3. 建立连接：Player -> EQ -> MainMixer (扬声器)
    let format = engine.outputNode.inputFormat(forBus: 0)
    engine.connect(playerNode, to: eqNode, format: format)
    engine.connect(eqNode, to: engine.mainMixerNode, format: format)

    // 4. 启动引擎
    do {
      try engine.start()
    } catch {
      print("Engine start error: \(error)")
    }
  }

  private func playAudio(url: URL) {
    // 这是一个简化的播放逻辑，用于演示 EQ
    do {
      let file = try AVAudioFile(forReading: url)
      playerNode.scheduleFile(file, at: nil, completionHandler: nil)
      if !engine.isRunning { try? engine.start() }
      playerNode.play()
    } catch {
      print("Play error: \(error)")
    }
  }

  // 预设常用的 5 个中心频率
  private func getCenterFreq(index: Int) -> Float {
    let freqs: [Float] = [60, 230, 910, 3600, 14000]
    if index < freqs.count { return freqs[index] }
    return 1000
  }
}