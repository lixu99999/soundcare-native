<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import CONFIG from '@/config.js'

const musicUrl = ref('')
const musicTitle = ref('疗愈音乐')
const coverImageUrl = ref('')
const sessionDuration = ref(15)

// HRV相关状态
const currentHRV = ref(52)
const heartRate = ref(68)
const hrvStatus = ref('正常放松')
const hrvTrend = ref('稳定')
const healingProgress = ref(0)

const elapsedSeconds = ref(0)
const isPlaying = ref(false)
const actualDuration = ref(0)

const hrvHistory = ref([])
const healingScore = ref(0)
const hrvImprove = ref('0%')
const rhythmSync = ref(0)
const relaxInduction = ref(0)

const hrvLoopEnabled = ref(true)

// 音频
let audioElement = null
let hrvUpdateTimer = null
let musicRegenerateTimer = null

// ========== HRV计算器 (30秒窗口) ==========
class HRVCalculator {
  constructor() {
    this.windowSize = 30 * 1000  // 30秒窗口
    this.rriBuffer = []          // RRI数据缓存 (原始RRI序列)
    this.heartRateBuffer = []    // 心率数据缓存
    this.lastUpdateTime = Date.now()
  }

  // 添加RRI数据 (毫秒)
  addRRI(rriMs) {
    const now = Date.now()
    this.rriBuffer.push({ value: rriMs, timestamp: now })
    this.cleanOldData()
  }

  // 添加心率数据 (BPM)
  addHeartRate(bpm) {
    const now = Date.now()
    this.heartRateBuffer.push({ value: bpm, timestamp: now })
    this.cleanOldData()
  }

  // 清理30秒前的旧数据
  cleanOldData() {
    const now = Date.now()
    const cutoff = now - this.windowSize
    this.rriBuffer = this.rriBuffer.filter(d => d.timestamp > cutoff)
    this.heartRateBuffer = this.heartRateBuffer.filter(d => d.timestamp > cutoff)
  }

  // 计算RMSSD (如果RRI数据足够)
  calculateRMSSD() {
    if (this.rriBuffer.length < 2) return null

    const rriValues = this.rriBuffer.map(d => d.value)
    let sumSquaredDiff = 0

    for (let i = 0; i < rriValues.length - 1; i++) {
      const diff = rriValues[i + 1] - rriValues[i]
      sumSquaredDiff += diff * diff
    }

    return Math.sqrt(sumSquaredDiff / (rriValues.length - 1))
  }

  // 从心率序列估算状态 (Apple Watch模式，没有RRI)
  estimateStatusFromHeartRate() {
    if (this.heartRateBuffer.length < 10) return null

    const rates = this.heartRateBuffer.map(d => d.value)
    const avg = rates.reduce((a, b) => a + b, 0) / rates.length

    // 计算变异系数
    const variance = rates.reduce((sum, r) => sum + Math.pow(r - avg, 2), 0) / rates.length
    const std = Math.sqrt(variance)
    const cv = std / avg  // 变异系数

    // 根据心率和变异系数判断状态
    if (avg > 90) return { status: '焦虑', level: 5 }
    if (avg > 80) return { status: '压力大', level: 4 }
    if (avg > 70 && cv < 0.01) return { status: '紧张', level: 3 }
    if (avg < 65 && cv > 0.02) return { status: '深度放松', level: 1 }
    if (avg < 75) return { status: '正常放松', level: 2 }
    return { status: '正常', level: 2 }
  }

  // 获取当前状态描述
  getStatusDesc() {
    // 优先用RRI计算RMSSD
    const rmssd = this.calculateRMSSD()
    if (rmssd !== null) {
      if (rmssd > 80) return '深度放松'
      if (rmssd > 50) return '正常放松'
      if (rmssd > 30) return '中度压力'
      return '高压力'
    }

    // 用心率估算
    const estimated = this.estimateStatusFromHeartRate()
    if (estimated) return estimated.status

    return '数据不足'
  }

  // 获取当前RMSSD值
  getRMSSD() {
    return this.calculateRMSSD()
  }

  // 获取平均心率
  getAvgHeartRate() {
    if (this.heartRateBuffer.length === 0) return null
    const sum = this.heartRateBuffer.reduce((a, b) => a + b.value, 0)
    return sum / this.heartRateBuffer.length
  }

  // 获取HRV趋势 (最近5个数据点的变化)
  getTrend() {
    if (hrvHistory.value.length < 5) return '数据积累中'

    const recent = hrvHistory.value.slice(-5)
    const first = recent[0]
    const last = recent[recent.length - 1]

    if (last > first + 5) return '↑ 改善中'
    if (last < first - 5) return '↓ 加深'
    return '→ 稳定'
  }

  // 获取状态等级 (1-5)
  getStatusLevel() {
    const rmssd = this.calculateRMSSD()
    if (rmssd !== null) {
      if (rmssd > 80) return 1  // 深度放松
      if (rmssd > 50) return 2  // 正常放松
      if (rmssd > 30) return 3  // 中度压力
      if (rmssd > 15) return 4  // 高压力
      return 5  // 焦虑
    }

    const estimated = this.estimateStatusFromHeartRate()
    return estimated ? estimated.level : 3
  }
}

// 创建HRV计算器实例
const hrvCalculator = new HRVCalculator()

// 初始HRV值 (模拟从设备获取)
const initialHRV = 40

// 模拟生成RRI数据 (基于当前HRV状态，生成符合生理规律的RRI序列)
const generateSimulatedRRI = (targetHRV, heartRateBPM) => {
  const interval = 60000 / heartRateBPM  // 平均间隔 ms
  const variation = targetHRV / 2  // 变异范围

  // 生成5-8个RRI值，模拟5秒内心率
  const count = 5 + Math.floor(Math.random() * 4)
  const rriValues = []

  for (let i = 0; i < count; i++) {
    // 添加随机变异，模拟真实RRI
    const noise = (Math.random() - 0.5) * variation
    const rri = interval + noise + (Math.random() - 0.5) * variation * 0.5
    rriValues.push(Math.round(rri))
  }

  return rriValues
}

// 更新HRV (每5秒调用一次)
// TODO: native APP 集成 hrv-plugin 后，应改为订阅 hrv.onUpdate 事件，
//       并通过 music.startHRVSession(sessionId) 自动上报后端。
//       当前是模拟数据，仅用于 UI 演示和音乐播放流程。
const updateHRV = () => {
  if (!hrvLoopEnabled.value) return

  // 模拟心率范围 60-80 BPM
  const simulatedHeartRate = 65 + Math.floor(Math.random() * 15)
  heartRate.value = simulatedHeartRate

  // 生成模拟RRI数据
  const simulatedRRI = generateSimulatedRRI(currentHRV.value, simulatedHeartRate)
  simulatedRRI.forEach(rri => hrvCalculator.addRRI(rri))
  hrvCalculator.addHeartRate(simulatedHeartRate)

  // 计算当前RMSSD
  const rmssd = hrvCalculator.getRMSSD()

  if (rmssd !== null && rmssd > 0) {
    currentHRV.value = Math.round(rmssd)
  } else {
    // 如果RRI数据不足，用心率估算
    const estimated = hrvCalculator.estimateStatusFromHeartRate()
    if (estimated) {
      // 心率估算模式下，模拟一个合理的HRV范围
      currentHRV.value = 30 + Math.round(estimated.level * 10)
    }
  }

  hrvStatus.value = hrvCalculator.getStatusDesc()
  hrvTrend.value = hrvCalculator.getTrend()

  // 更新历史记录 (用于曲线显示)
  hrvHistory.value.push(currentHRV.value)
  if (hrvHistory.value.length > 60) {  // 保留更多历史数据 (约5分钟)
    hrvHistory.value.shift()
  }

  // 更新疗愈进度 (基于初始值计算)
  const improvement = Math.round((currentHRV.value - initialHRV) / initialHRV * 100)
  hrvImprove.value = `${improvement >= 0 ? '+' : ''}${improvement}%`
  healingProgress.value = Math.min(100, Math.max(0, 50 + improvement))

  // 更新疗愈指标 (模拟)
  if (currentHRV.value > 50) {
    healingScore.value = Math.min(100, 60 + currentHRV.value - 50)
    rhythmSync.value = Math.min(100, 70 + (currentHRV.value - 40) / 2)
    relaxInduction.value = Math.min(100, 65 + (currentHRV.value - 45) / 3)
  }

  console.log('HRV更新:', {
    rmssd: currentHRV.value,
    heartRate: simulatedHeartRate,
    status: hrvStatus.value,
    trend: hrvTrend.value
  })
}

// 向后端发送HRV更新，请求生成新音乐
const syncHRVToBackend = async () => {
  if (!hrvLoopEnabled.value) return

  try {
    const response = await uni.request({
      url: `${CONFIG.API_BASE_URL}/music/session/${getSessionId()}/hrv-update`,
      method: 'POST',
      data: {
        rmssd: currentHRV.value,
        heart_rate: heartRate.value,
        elapsed_seconds: elapsedSeconds.value,
        device_type: 'simulated'  // 模拟设备类型
      }
    })

    if (response.statusCode === 200 && response.data) {
      console.log('HRV同步成功，后端返回调整建议:', response.data)
    }
  } catch (error) {
    console.error('HRV同步失败:', error)
  }
}

// 根据HRV状态计算BPM调整值
const calculateBPMDelta = () => {
  const level = hrvCalculator.getStatusLevel()
  // 压力越大，BPM应该降低越多
  const adjustments = { 1: 0, 2: 0, 3: -3, 4: -5, 5: -8 }
  return adjustments[level] || 0
}

// 生成会话ID (简化版)
let sessionIdCounter = 0
const getSessionId = () => {
  return `session_${Date.now()}_${++sessionIdCounter}`
}

// 播放控制
const togglePlay = () => {
  if (!audioElement) return
  if (isPlaying.value) {
    audioElement.pause()
    isPlaying.value = false
  } else {
    // 如果音频已播放完，重置到开头
    if (elapsedSeconds.value >= actualDuration.value - 1) {
      audioElement.seek(0)
      elapsedSeconds.value = 0
    }
    audioElement.play()
    isPlaying.value = true
  }
}

// slider组件变化时调用
const onSliderChange = (e) => {
  const targetTime = e.detail.value
  if (audioElement) {
    audioElement.seek(targetTime)
    elapsedSeconds.value = targetTime
  }
}

// 上一首/重新播放
const restartTrack = () => {
  if (audioElement) {
    audioElement.seek(0)
    elapsedSeconds.value = 0
    audioElement.play()
    isPlaying.value = true
  }
}

// 下一首（暂时也是重新播放）
const nextTrack = () => {
  restartTrack()
}

// 初始化音频
const initAudio = () => {
  if (!musicUrl.value) return

  audioElement = uni.createInnerAudioContext()
  audioElement.src = musicUrl.value

  audioElement.onCanplay(() => {
    console.log('音频已缓冲完成')
    if (actualDuration.value <= 0) {
      actualDuration.value = Math.floor(audioElement.duration) || 0
      sessionDuration.value = Math.floor(actualDuration.value / 60) || 15
    }
  })

  audioElement.onPlay(() => {
    console.log('音频开始播放')
    isPlaying.value = true
  })

  audioElement.onTimeUpdate(() => {
    if (audioElement) {
      elapsedSeconds.value = Math.floor(audioElement.currentTime)
    }
  })

  audioElement.onEnded(() => {
    isPlaying.value = false
    elapsedSeconds.value = 0
  })

  audioElement.onError((err) => {
    console.error('音频播放错误:', err)
    uni.showToast({ title: '播放失败', icon: 'none' })
  })

  audioElement.play()
}

// 格式化时间
const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

onMounted(() => {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  const options = currentPage.options || {}

  console.log('播放页收到的URL参数:', options)

  // 从Storage获取音频信息
  const savedUrl = uni.getStorageSync('lastMusicUrl')
  if (savedUrl) {
    musicUrl.value = savedUrl
    uni.removeStorageSync('lastMusicUrl')
  }

  const savedTitle = uni.getStorageSync('lastMusicTitle')
  if (savedTitle) {
    musicTitle.value = savedTitle
    uni.removeStorageSync('lastMusicTitle')
  }

  const savedCover = uni.getStorageSync('lastCoverImageUrl')
  if (savedCover) {
    coverImageUrl.value = savedCover
    uni.removeStorageSync('lastCoverImageUrl')
  }

  const savedDuration = uni.getStorageSync('lastMusicDuration')
  if (savedDuration) {
    actualDuration.value = savedDuration
    sessionDuration.value = Math.floor(savedDuration / 60) || 15
    uni.removeStorageSync('lastMusicDuration')
  }

  // 初始化HRV历史
  hrvHistory.value = [initialHRV]
  currentHRV.value = initialHRV

  initAudio()

  // 每5秒更新一次HRV (实时可视化)
  hrvUpdateTimer = setInterval(() => {
    updateHRV()
  }, 5000)

  // 每2分钟同步HRV到后端，生成新音乐
  musicRegenerateTimer = setInterval(() => {
    syncHRVToBackend()
  }, 120000)  // 2分钟
})

onUnmounted(() => {
  if (audioElement) {
    audioElement.stop()
    audioElement.destroy()
  }
  if (hrvUpdateTimer) clearInterval(hrvUpdateTimer)
  if (musicRegenerateTimer) clearInterval(musicRegenerateTimer)
})

// 计算HRV引导曲线的显示点
const getHRVCurveDots = () => {
  const points = hrvHistory.value.slice(-20)
  if (points.length === 0) return []

  const maxHRV = 80
  const minHRV = 20
  const width = 560  // 可用宽度
  const height = 120  // 可用高度

  return points.map((value, index) => {
    const x = Math.round((index / (points.length - 1 || 1)) * width)
    const yRatio = Math.max(0, Math.min(1, (value - minHRV) / (maxHRV - minHRV)))
    const y = Math.round(height * (1 - yRatio))
    return { x, y }
  })
}

const getCurveWidth = () => {
  const points = hrvHistory.value.slice(-20)
  if (points.length < 2) return '0rpx'
  const width = 560
  const stepX = width / (points.length - 1)
  return Math.round(stepX * (points.length - 1)) + 'rpx'
}

// 获取当前HRV点在曲线上的位置
const getCurrentHRVPoint = () => {
  const dots = getHRVCurveDots()
  if (dots.length === 0) return { cx: 0, cy: 60 }
  const last = dots[dots.length - 1]
  return { cx: last.x, cy: last.y }
}

// HRV-badge样式类名
const getHRVBadgeClass = () => {
  const statusMap = {
    '深度放松': 'relaxed',
    '正常放松': 'normal',
    '中度压力': 'stressed',
    '高压力': 'high-stress'
  }
  return statusMap[hrvStatus.value] || 'normal'
}
</script>

<template>
  <view class="container">
    <!-- 顶部标题 -->
    <view class="header">
      <text class="music-title">{{ musicTitle }}</text>
    </view>

    <!-- 黑胶唱片 + 播放控制区 -->
    <view class="player-section">
      <!-- 黑胶唱片 -->
      <view class="vinyl-container">
        <view class="vinyl" :class="{ playing: isPlaying }">
          <view class="vinyl-label">
            <image v-if="coverImageUrl" class="cover-img" :src="coverImageUrl" mode="aspectFill" />
            <text v-else class="music-note">♫</text>
          </view>
        </view>
      </view>

      <!-- 播放控制 -->
      <view class="controls">
        <view class="time-display">
          <text class="time-current">{{ formatTime(elapsedSeconds) }}</text>
          <text class="time-separator">/</text>
          <text class="time-total">{{ formatTime(actualDuration) }}</text>
        </view>
        <slider class="progress-slider" :value="elapsedSeconds" :min="0" :max="actualDuration || 1" @change="onSliderChange" />
        <view class="play-buttons">
          <view class="btn-control" @tap="restartTrack">
            <text class="icon">⏮️</text>
          </view>
          <view class="btn-play" @tap="togglePlay">
            <text class="icon">{{ isPlaying ? '⏸️' : '▶️' }}</text>
          </view>
          <view class="btn-control" @tap="nextTrack">
            <text class="icon">⏭️</text>
          </view>
        </view>
      </view>
    </view>

    <!-- HRV引导曲线 -->
    <view class="hrv-curve-card">
      <text class="curve-title">🌡️ HRV引导曲线</text>
      <view class="curve-container">
        <view class="hrv-curve-wrapper">
          <view class="hrv-curve">
            <view
              v-for="(point, index) in getHRVCurveDots()"
              :key="index"
              class="curve-dot"
              :style="{
                left: point.x + 'rpx',
                bottom: point.y + 'rpx',
                backgroundColor: index === getHRVCurveDots().length - 1 ? '#FF6B00' : '#FF8C42'
              }"
            ></view>
            <view class="curve-line" :style="{ width: getCurveWidth() }"></view>
          </view>
        </view>
      </view>
      <view class="curve-legend">
        <text class="legend-item">初始: 32ms</text>
        <text class="legend-item">→ 当前: {{ currentHRV }}ms</text>
        <text class="legend-item">目标: 65ms</text>
      </view>
    </view>

    <!-- HRV 实时监测卡片 -->
    <view class="hrv-monitor-card">
      <view class="hrv-header-row">
        <text class="monitor-title">❤️ HRV 实时监测</text>
        <view class="hrv-badge" :class="getHRVBadgeClass()">
          <text class="badge-text">{{ hrvStatus }}</text>
        </view>
      </view>
      <view class="hrv-main-data">
        <view class="hrv-value-block">
          <text class="hrv-big-value">{{ currentHRV }}</text>
          <text class="hrv-unit">ms</text>
        </view>
        <view class="hrv-stats-block">
          <view class="stat-item">
            <text class="stat-label">心率</text>
            <text class="stat-value">{{ heartRate }} BPM</text>
          </view>
          <view class="stat-item">
            <text class="stat-label">状态</text>
            <text class="stat-value trend">{{ hrvTrend }}</text>
          </view>
        </view>
      </view>
      <view class="progress-section">
        <view class="progress-bar">
          <view class="progress-fill" :style="{ width: healingProgress + '%' }"></view>
        </view>
        <text class="progress-text">{{ healingProgress }}% 疗愈进行中</text>
      </view>
    </view>

    <!-- 疗愈效果指标 -->
    <view class="metrics-card">
      <view class="metric-item">
        <text class="metric-value">{{ healingScore }}</text>
        <text class="metric-label">综合指数</text>
      </view>
      <view class="metric-item">
        <text class="metric-value">{{ hrvImprove }}</text>
        <text class="metric-label">HRV改善</text>
      </view>
      <view class="metric-item">
        <text class="metric-value">{{ rhythmSync }}</text>
        <text class="metric-label">节奏同步</text>
      </view>
      <view class="metric-item">
        <text class="metric-value">{{ relaxInduction }}</text>
        <text class="metric-label">放松诱导</text>
      </view>
    </view>

    <!-- HRV闭环控制 -->
    <view class="hrv-loop-control">
      <view class="loop-toggle" @tap="hrvLoopEnabled = !hrvLoopEnabled">
        <view :class="['toggle-switch', { active: hrvLoopEnabled }]">
          <view class="toggle-knob"></view>
        </view>
        <text class="loop-label">🔄 HRV闭环模式: {{ hrvLoopEnabled ? 'ON' : 'OFF' }}</text>
      </view>
      <text class="loop-hint">当前: 每5秒动态调整音乐参数</text>
    </view>
  </view>
</template>

<style scoped>
.container {
  min-height: 100vh;
  background: linear-gradient(180deg, #1A1A2E 0%, #252540 100%);
  padding: 20rpx;
  color: #F8F8FF;
}

.header {
  text-align: center;
  padding: 20rpx 0;
}

.music-title {
  font-size: 64rpx;
  font-weight: bold;
  color: #F8F8FF;
  font-family: 'PingFang SC', 'Helvetica Neue', Helvetica, Arial, sans-serif;
  text-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.3);
}

.player-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 30rpx 0;
}

.vinyl-container {
  width: 400rpx;
  height: 400rpx;
  margin-bottom: 40rpx;
}

.vinyl {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 30%, #1a1a1a 60%, #333 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.vinyl.playing {
  animation: rotate 8s linear infinite;
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.vinyl-label {
  width: 180rpx;
  height: 180rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #FF6B00 0%, #FF8C42 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.music-note {
  font-size: 48rpx;
  color: #fff;
}

.cover-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

.cover-image {
  font-size: 24rpx;
  color: #fff;
  text-align: center;
}

.controls {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.time-display {
  font-size: 28rpx;
  color: #A0A0C0;
  margin-bottom: 10rpx;
}

.time-current {
  color: #F8F8FF;
}

.progress-slider {
  width: 90%;
  margin: 10rpx 0;
}

.play-buttons {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 40rpx;
  margin-top: 20rpx;
}

.btn-control, .btn-play {
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-play .icon {
  font-size: 64rpx;
}

.btn-control .icon {
  font-size: 48rpx;
}

.hrv-curve-card, .hrv-monitor-card, .metrics-card {
  background: rgba(42, 42, 69, 0.8);
  border-radius: 20rpx;
  padding: 24rpx;
  margin: 20rpx 0;
  border: 1px solid rgba(255, 107, 0, 0.2);
}

.curve-title, .monitor-title {
  font-size: 28rpx;
  font-weight: bold;
  margin-bottom: 16rpx;
  display: block;
}

.curve-container {
  height: 150rpx;
  margin: 10rpx 0;
  position: relative;
}

.hrv-curve-wrapper {
  width: 100%;
  height: 100%;
  position: relative;
}

.hrv-curve {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 120rpx;
}

.curve-dot {
  position: absolute;
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  transform: translateX(-50%);
}

.curve-line {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 4rpx;
  background: linear-gradient(90deg, #FF8C42 0%, #FF6B00 100%);
  border-radius: 2rpx;
  transition: width 0.3s;
}

.curve-legend {
  display: flex;
  justify-content: space-between;
  font-size: 22rpx;
  color: #A0A0C0;
  margin-top: 10rpx;
}

.hrv-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}

.hrv-badge {
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
  background: rgba(255, 107, 0, 0.2);
}

.hrv-badge.relaxed {
  background: rgba(74, 222, 128, 0.2);
}

.hrv-badge.high-stress {
  background: rgba(255, 107, 0, 0.2);
}

.badge-text {
  font-size: 24rpx;
  color: #FF6B00;
}

.hrv-main-data {
  display: flex;
  align-items: center;
  margin: 20rpx 0;
}

.hrv-value-block {
  display: flex;
  align-items: baseline;
  margin-right: 40rpx;
}

.hrv-big-value {
  font-size: 72rpx;
  font-weight: bold;
  color: #FF6B00;
}

.hrv-unit {
  font-size: 28rpx;
  color: #A0A0C0;
  margin-left: 8rpx;
}

.hrv-stats-block {
  flex: 1;
}

.stat-item {
  margin: 8rpx 0;
}

.stat-label {
  font-size: 24rpx;
  color: #A0A0C0;
  margin-right: 8rpx;
}

.stat-value {
  font-size: 28rpx;
  color: #F8F8FF;
}

.stat-value.trend {
  color: #FF6B00;
}

.progress-section {
  margin-top: 16rpx;
}

.progress-bar {
  height: 8rpx;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4rpx;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #FF6B00 0%, #FF8C42 100%);
  border-radius: 4rpx;
  transition: width 0.3s;
}

.progress-text {
  font-size: 22rpx;
  color: #A0A0C0;
  margin-top: 8rpx;
  display: block;
  text-align: center;
}

.metrics-card {
  display: flex;
  justify-content: space-around;
}

.metric-item {
  text-align: center;
}

.metric-value {
  font-size: 36rpx;
  font-weight: bold;
  color: #FF6B00;
  display: block;
}

.metric-label {
  font-size: 22rpx;
  color: #A0A0C0;
}

.hrv-loop-control {
  background: rgba(42, 42, 69, 0.6);
  border-radius: 16rpx;
  padding: 20rpx;
  margin-top: 20rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.loop-toggle {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.toggle-switch {
  width: 80rpx;
  height: 40rpx;
  border-radius: 20rpx;
  background: rgba(255, 255, 255, 0.2);
  position: relative;
  transition: background 0.3s;
}

.toggle-switch.active {
  background: linear-gradient(135deg, #FF6B00 0%, #FF8C42 100%);
}

.toggle-knob {
  width: 36rpx;
  height: 36rpx;
  border-radius: 50%;
  background: #fff;
  position: absolute;
  top: 2rpx;
  left: 2rpx;
  transition: transform 0.3s;
}

.toggle-switch.active .toggle-knob {
  transform: translateX(40rpx);
}

.loop-label {
  font-size: 28rpx;
  color: #F8F8FF;
}

.loop-hint {
  font-size: 22rpx;
  color: #A0A0C0;
  margin-top: 8rpx;
}
</style>