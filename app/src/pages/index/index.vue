<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import CONFIG from '@/config.js'

const greeting = ref('')
const timePeriod = ref('')
const hrvStatus = ref('配对中...')
const heartRate = ref('--')
const hrvValue = ref('--')
const suggestions = ref('')
const todayMinutes = ref(0)
const hrvImprovement = ref(0)

// 自然语言输入
const userInput = ref('')
const isAILoading = ref(false)
const aiSuggestions = ref([])

// 示例输入
const exampleInputs = [
  '今天开了一天的会，感觉好累',
  '睡前想听点轻柔的音乐',
  '工作压力大，想放松一下',
  '明天有考试，需要专注音乐'
]

// ========== 简化版HRV计算器 (首页用) ==========
class SimpleHRVCalculator {
  constructor() {
    this.windowSize = 30 * 1000
    this.rriBuffer = []
    this.heartRateBuffer = []
  }

  addRRI(rriMs) {
    const now = Date.now()
    this.rriBuffer.push({ value: rriMs, timestamp: now })
    this.cleanOldData()
  }

  addHeartRate(bpm) {
    const now = Date.now()
    this.heartRateBuffer.push({ value: bpm, timestamp: now })
    this.cleanOldData()
  }

  cleanOldData() {
    const now = Date.now()
    const cutoff = now - this.windowSize
    this.rriBuffer = this.rriBuffer.filter(d => d.timestamp > cutoff)
    this.heartRateBuffer = this.heartRateBuffer.filter(d => d.timestamp > cutoff)
  }

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

  getStatus() {
    const rmssd = this.calculateRMSSD()
    if (rmssd !== null) {
      if (rmssd > 80) return '深度放松'
      if (rmssd > 50) return '正常放松'
      if (rmssd > 30) return '中度压力'
      return '高压力'
    }
    // 心率估算模式
    if (this.heartRateBuffer.length < 5) return '数据不足'
    const avg = this.heartRateBuffer.reduce((a, b) => a + b.value, 0) / this.heartRateBuffer.length
    if (avg < 65) return '深度放松'
    if (avg < 75) return '正常放松'
    if (avg < 85) return '中度压力'
    return '高压力'
  }
}

const hrvCalculator = new SimpleHRVCalculator()
let hrvUpdateTimer = null

// 模拟HRV数据 (首页展示用，每2秒更新一次)
const mockHRVData = () => {
  // 模拟心率
  const simulatedHR = 60 + Math.floor(Math.random() * 20)
  heartRate.value = simulatedHR

  // 生成模拟RRI
  const interval = 60000 / simulatedHR
  const rri = interval + (Math.random() - 0.5) * 30
  hrvCalculator.addRRI(Math.round(rri))
  hrvCalculator.addHeartRate(simulatedHR)

  const rmssd = hrvCalculator.calculateRMSSD()
  if (rmssd !== null && rmssd > 0) {
    hrvValue.value = Math.round(rmssd)
  }

  hrvStatus.value = hrvCalculator.getStatus()

  // 更新建议
  if (hrvValue.value > 50) {
    suggestions.value = '状态良好，推荐专注工作音乐'
    hrvImprovement.value = Math.round((hrvValue.value - 40) / 40 * 100)
  } else if (hrvValue.value > 30) {
    suggestions.value = '建议选择减压场景音乐'
    hrvImprovement.value = Math.round((hrvValue.value - 30) / 30 * 100)
  } else {
    suggestions.value = '建议使用呼吸引导+减压音乐'
    hrvImprovement.value = 0
  }
}

// 获取时间段名称
const getTimePeriodName = (hour) => {
  if (hour >= 6 && hour < 8) return '晨间唤醒'
  if (hour >= 8 && hour < 12) return '上午专注'
  if (hour >= 12 && hour < 14) return '午间休整'
  if (hour >= 14 && hour < 18) return '下午专注'
  if (hour >= 18 && hour < 22) return '晚间放松'
  return '睡前助眠'
}

// 获取问候语
const getGreeting = (hour) => {
  if (hour < 6) return '夜深了'
  if (hour < 9) return '早上好'
  if (hour < 12) return '上午好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  if (hour < 22) return '晚上好'
  return '夜深了'
}

// AI理解用户输入，生成优化prompt
const submitUserInput = async () => {
  if (!userInput.value.trim()) return

  isAILoading.value = true

  try {
    // 调用后端LLM优化模块
    const response = await uni.request({
      url: `${CONFIG.API_BASE_URL}/music/llm-optimize`,
      method: 'POST',
      data: {
        user_input: userInput.value,
        time_period: timePeriod.value
      }
    })

    if (response.statusCode === 200 && response.data) {
      // 跳转到AI生成专属页，传递LLM优化的完整prompt
      uni.navigateTo({
        url: `/pages/ai-generate/index?prompt=${encodeURIComponent(response.data.optimized_prompt)}&scene=${response.data.scene}`
      })
    }
  } catch (error) {
    console.error('LLM优化失败:', error)
    // 如果API调用失败，使用简单的场景匹配作为fallback
    const scene = matchSceneFromInput(userInput.value)
    uni.navigateTo({
      url: `/pages/generate/index?fromAI=true&scene=${scene}&customPrompt=${encodeURIComponent(userInput.value)}`
    })
  } finally {
    isAILoading.value = false
  }
}

// 从用户输入匹配场景
const matchSceneFromInput = (input) => {
  const lowerInput = input.toLowerCase()
  if (lowerInput.includes('睡') || lowerInput.includes('晚')) return 'sleep'
  if (lowerInput.includes('累') || lowerInput.includes('压力') || lowerInput.includes('放松')) return 'relax'
  if (lowerInput.includes('专注') || lowerInput.includes('考试') || lowerInput.includes('工作')) return 'focus'
  if (lowerInput.includes('冥想')) return 'meditate'
  if (lowerInput.includes('学习') || lowerInput.includes('读书')) return 'study'
  return 'relax'
}

// 点击示例输入 - 只填充文本，不自动提交
const selectExample = (example) => {
  userInput.value = example
}

onMounted(() => {
  const now = new Date()
  const hour = now.getHours()
  greeting.value = getGreeting(hour)
  timePeriod.value = getTimePeriodName(hour)

  // 初始化HRV
  mockHRVData()

  // 每5秒更新一次HRV模拟数据
  hrvUpdateTimer = setInterval(() => {
    mockHRVData()
  }, 5000)
})

onUnmounted(() => {
  if (hrvUpdateTimer) clearInterval(hrvUpdateTimer)
})

const scenes = [
  { id: 'sleep', name: '助眠', icon: '😴' },
  { id: 'relax', name: '减压', icon: '😌' },
  { id: 'focus', name: '专注', icon: '🎯' },
  { id: 'meditate', name: '冥想', icon: '🧘' },
  { id: 'study', name: '学习', icon: '📚' }
]

// 5个场景的场景描述（中英文对照）
const sceneDescriptions = {
  'sleep': 'sleep music, gentle lullaby, peaceful and calming',
  'relax': 'relaxing music, stress relief, soothing atmosphere',
  'focus': 'focus music, concentration, ambient study',
  'meditate': 'meditation music, mindfulness, calming and centering',
  'study': 'study music, light background, ambient learning'
}

const goToGenerate = (sceneId) => {
  const sceneDesc = sceneDescriptions[sceneId] || ''
  uni.navigateTo({
    url: `/pages/generate/index?scene=${sceneId}&timePeriod=${timePeriod.value}&sceneDesc=${encodeURIComponent(sceneDesc)}`
  })
}

const startPlayback = () => {
  uni.navigateTo({
    url: '/pages/player/index'
  })
}

const goToDevicePair = () => {
  uni.navigateTo({
    url: '/pages/device-pair/index'
  })
}
</script>

<template>
  <view class="container">
    <!-- 顶部标题区 -->
    <view class="header">
      <text class="title"><text class="music-note">🎵</text> SoundCare</text>
      <text class="subtitle">MTX项目—产品提案  SoundCare demo</text>
    </view>

    <!-- 时段信息 -->
    <view class="time-section">
      <text class="greeting">{{ greeting }}，现在是「{{ timePeriod }}」时段</text>
    </view>

    <!-- HRV 实时状态卡片 -->
    <view class="hrv-card">
      <view class="hrv-header">
        <text class="hrv-title">❤️ HRV 实时状态</text>
        <view class="pairing-indicator">
          <text class="pairing-dot"></text>
          <text class="pairing-text">配对中...</text>
        </view>
      </view>

      <view class="hrv-data">
        <view class="hrv-item">
          <text class="hrv-label">HRV</text>
          <text class="hrv-value">{{ hrvValue }}<text class="hrv-unit">ms</text></text>
        </view>
        <view class="hrv-divider"></view>
        <view class="hrv-item">
          <text class="hrv-label">心率</text>
          <text class="hrv-value">{{ heartRate }}<text class="hrv-unit">BPM</text></text>
        </view>
        <view class="hrv-divider"></view>
        <view class="hrv-item">
          <text class="hrv-label">状态</text>
          <text class="hrv-status">{{ hrvStatus }}</text>
        </view>
      </view>

      <view class="hrv-suggestion">
        <text class="suggestion-text">💡 {{ suggestions }}</text>
      </view>

      <view class="pairing-progress">
        <view class="progress-bar">
          <view class="progress-fill" style="width: 60%"></view>
        </view>
        <text class="progress-text">正在搜索可穿戴设备...</text>
      </view>
    </view>

    <!-- 两条生成路径 -->
    <view class="paths-section">
      <!-- AI路径 -->
      <view class="path-card ai-path">
        <view class="path-header">
          <text class="path-icon">✨</text>
          <text class="path-title">AI智能生成</text>
        </view>
        <text class="path-desc">描述心情，AI优化专属提示词</text>
        <view class="input-wrapper">
          <textarea
            v-model="userInput"
            class="ai-textarea"
            placeholder="例如：今天开了一天的会，感觉好累..."
            :disabled="isAILoading"
            maxlength="200"
          />
          <button
            class="btn-ai-submit"
            :disabled="!userInput.trim() || isAILoading"
            @tap="submitUserInput"
          >
            {{ isAILoading ? '分析中...' : '🎵 AI生成' }}
          </button>
        </view>
        <view class="example-tags">
          <text
            v-for="example in exampleInputs"
            :key="example"
            class="example-tag"
            @tap="selectExample(example)"
          >{{ example }}</text>
        </view>
      </view>

      <!-- 手动路径 -->
      <view class="path-card manual-path">
        <view class="path-header">
          <text class="path-icon">🎛️</text>
          <text class="path-title">手动场景选择</text>
        </view>
        <text class="path-desc">选择场景，调节参数生成</text>
        <view class="scenes-grid">
          <view
            v-for="scene in scenes"
            :key="scene.id"
            class="scene-item"
            @tap="goToGenerate(scene.id)"
          >
            <text class="scene-icon">{{ scene.icon }}</text>
            <text class="scene-name">{{ scene.name }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 今日数据 -->
    <view class="today-section">
      <text class="section-title">今日疗愈数据</text>
      <view class="today-stats">
        <view class="stat-item">
          <text class="stat-value">{{ todayMinutes }}</text>
          <text class="stat-label">疗愈分钟</text>
        </view>
        <view class="stat-divider"></view>
        <view class="stat-item">
          <text class="stat-value">{{ hrvImprovement }}%</text>
          <text class="stat-label">HRV改善</text>
        </view>
      </view>
    </view>

    <!-- 操作按钮 -->
    <view class="actions">
      <button class="btn-primary" @tap="startPlayback">
        🎵 开始播放专属音乐
      </button>
      <button class="btn-secondary" @tap="goToDevicePair">
        ⌚ 设备配对
      </button>
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
  padding: 40rpx 0;
}

.title {
  font-size: 48rpx;
  font-weight: bold;
  display: block;
}

.music-note {
  background: linear-gradient(135deg, #FF6B00, #FF8C42);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.subtitle {
  font-size: 26rpx;
  color: #a0a0a0;
  margin-top: 10rpx;
  display: block;
}

.time-section {
  text-align: center;
  padding: 20rpx;
  background: rgba(42, 42, 69, 0.8);
  border-radius: 16rpx;
  margin-bottom: 30rpx;
  border: 1rpx solid rgba(192, 132, 252, 0.2);
}

.greeting {
  font-size: 28rpx;
  color: #F8F8FF;
}

.hrv-card {
  background: rgba(42, 42, 69, 0.8);
  border-radius: 20rpx;
  padding: 30rpx;
  margin-bottom: 30rpx;
  border: 1px solid rgba(192, 132, 252, 0.2);
}

.hrv-header {
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.hrv-title {
  font-size: 32rpx;
  font-weight: bold;
}

.pairing-indicator {
  flex-direction: row;
  align-items: center;
}

.pairing-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: #4ade80;
  margin-right: 8rpx;
}

.pairing-text {
  font-size: 24rpx;
  color: #4ade80;
}

.hrv-data {
  flex-direction: row;
  justify-content: space-around;
  margin: 15rpx 0;
}

.hrv-item {
  align-items: center;
}

.hrv-label {
  font-size: 24rpx;
  color: #888;
  margin-bottom: 4rpx;
}

.hrv-value {
  font-size: 40rpx;
  font-weight: bold;
  color: #FF6B00;
}

.hrv-unit {
  font-size: 24rpx;
  color: #888;
  font-weight: normal;
}

.hrv-divider {
  width: 1px;
  height: 50rpx;
  background: rgba(255, 255, 255, 0.1);
}

.hrv-status {
  font-size: 28rpx;
  color: #fbbf24;
}

.hrv-suggestion {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12rpx;
  padding: 15rpx;
  margin-top: 10rpx;
}

.suggestion-text {
  font-size: 24rpx;
  color: #c0c0c0;
}

.pairing-progress {
  margin-top: 10rpx;
}

.progress-bar {
  height: 8rpx;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4rpx;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4ade80, #60a5fa);
  border-radius: 4rpx;
  transition: width 0.3s;
}

.progress-text {
  font-size: 22rpx;
  color: #888;
  margin-top: 10rpx;
  display: block;
}

.ai-input-section {
  margin-bottom: 30rpx;
}

.paths-section {
  margin-bottom: 30rpx;
}

.path-card {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 20rpx;
  padding: 30rpx;
  margin-bottom: 20rpx;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.ai-path {
  border: 1px solid rgba(255, 107, 0, 0.3);
  background: linear-gradient(180deg, rgba(255, 107, 0, 0.1) 0%, rgba(255, 140, 66, 0.05) 100%);
}

.manual-path {
  border: 1px solid rgba(255, 140, 66, 0.3);
  background: linear-gradient(180deg, rgba(255, 140, 66, 0.08) 0%, rgba(255, 107, 0, 0.03) 100%);
}

.path-header {
  flex-direction: row;
  align-items: center;
  margin-bottom: 12rpx;
}

.path-icon {
  font-size: 36rpx;
  margin-right: 12rpx;
}

.path-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #F8F8FF;
}

.path-desc {
  font-size: 24rpx;
  color: #888;
  margin-bottom: 20rpx;
  display: block;
}

.section-desc {
  font-size: 24rpx;
  color: #888;
  margin-bottom: 16rpx;
  display: block;
}

.manual-section {
  margin-bottom: 30rpx;
}

.input-wrapper {
  background: rgba(42, 42, 69, 0.9);
  border-radius: 16rpx;
  padding: 20rpx;
  margin-bottom: 16rpx;
  border: 2rpx solid rgba(255, 107, 0, 0.4);
}

.ai-textarea {
  width: 100%;
  min-height: 65rpx;
  background: rgba(26, 26, 46, 0.8);
  border-radius: 12rpx;
  padding: 16rpx;
  font-size: 28rpx;
  color: #F8F8FF;
  margin-bottom: 16rpx;
  border: 1rpx solid rgba(255, 107, 0, 0.3);
  box-sizing: border-box;
}

.ai-textarea::placeholder {
  color: #A0A0C0;
}

.ai-textarea:focus {
  border-color: #FF6B00;
  outline: none;
}

.btn-ai-submit {
  width: 100%;
  background: linear-gradient(135deg, #FF6B00 0%, #FF8C42 100%);
  color: #fff;
  font-size: 30rpx;
  font-weight: bold;
  padding: 20rpx;
  border-radius: 40rpx;
  border: none;
}

.btn-ai-submit:disabled {
  background: rgba(255, 255, 255, 0.1);
  color: #888;
}

.example-hints {
  padding: 0 10rpx;
}

.example-label {
  font-size: 24rpx;
  color: #888;
  margin-bottom: 12rpx;
  display: block;
}

.example-tags {
  flex-direction: row;
  flex-wrap: wrap;
}

.example-tag {
  background: rgba(42, 42, 69, 0.9);
  border: 1rpx solid rgba(255, 107, 0, 0.3);
  border-radius: 20rpx;
  padding: 12rpx 20rpx;
  font-size: 22rpx;
  color: #F8F8FF;
  margin-right: 12rpx;
  margin-bottom: 12rpx;
  transition: all 0.2s;
}

.example-tag:active {
  background: rgba(255, 107, 0, 0.2);
  border-color: #FF6B00;
  color: #FF6B00;
}

.scenes-section {
  margin-bottom: 30rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #FF6B00;
  margin-bottom: 20rpx;
  display: block;
}

.scenes-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16rpx;
}

.scene-item {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 16rpx;
  padding: 24rpx 16rpx;
  text-align: center;
  transition: all 0.2s;
}

.scene-item:active {
  background: rgba(255, 255, 255, 0.1);
  transform: scale(0.95);
}

.scene-icon {
  font-size: 40rpx;
  display: block;
  margin-bottom: 8rpx;
}

.scene-name {
  font-size: 24rpx;
  color: #e0e0e0;
}

.today-section {
  margin-bottom: 30rpx;
}

.today-stats {
  flex-direction: row;
  justify-content: center;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 16rpx;
  padding: 30rpx;
}

.stat-item {
  align-items: center;
  flex: 1;
}

.stat-value {
  font-size: 48rpx;
  font-weight: bold;
  color: #60a5fa;
  display: block;
}

.stat-label {
  font-size: 24rpx;
  color: #888;
  margin-top: 8rpx;
  display: block;
}

.stat-divider {
  width: 1px;
  height: 80rpx;
  background: rgba(255, 255, 255, 0.1);
}

.actions {
  padding: 20rpx 0;
}

.btn-primary {
  width: 100%;
  background: linear-gradient(135deg, #FF6B00 0%, #FF8C42 100%);
  color: #fff;
  font-size: 32rpx;
  padding: 24rpx;
  border-radius: 50rpx;
  border: none;
  margin-bottom: 20rpx;
}

.btn-secondary {
  width: 100%;
  background: rgba(255, 255, 255, 0.1);
  color: #e0e0e0;
  font-size: 28rpx;
  padding: 20rpx;
  border-radius: 50rpx;
  border: 1px solid rgba(255, 255, 255, 0.2);
}
</style>