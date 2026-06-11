<script setup>
import { ref, onMounted } from 'vue'
import CONFIG from '@/config.js'

const timePeriod = ref('')
const sceneId = ref('')

// 智能推荐参数（基于生物钟）
const recommendation = ref({
  bpm: 82,
  key: 'C大调',
  instrument: '钢琴+弦乐',
  ambient: '雨声30%'
})

// 手动调节参数
const formData = ref({
  sceneInput: '', // 用户场景描述
  tempo: 'medium', // slow: 50-70, medium: 70-100, fast: 100-120
  instrument: 'piano',
  ambient: 'none',
  mixRatio: 30,
  duration: 15
})

const tempoOptions = [
  { value: 'slow', label: '慢(50-70)', bpmRange: '50-70' },
  { value: 'medium', label: '中(70-100)', bpmRange: '70-100' },
  { value: 'fast', label: '快(100-120)', bpmRange: '100-120' }
]

const instrumentOptions = [
  { value: 'piano', label: '钢琴', icon: '🎹' },
  { value: 'strings', label: '弦乐', icon: '🎻' },
  { value: 'pad', label: '电子Pad', icon: '🎛️' },
  { value: 'nature', label: '自然', icon: '🌿' }
]

const ambientOptions = [
  { value: 'none', label: '无', icon: '✖️' },
  { value: 'rain', label: '雨声', icon: '🌧️' },
  { value: 'ocean', label: '海浪', icon: '🌊' },
  { value: 'forest', label: '森林', icon: '🌲' },
  { value: 'white-noise', label: '白噪音', icon: '📻' }
]

const durationOptions = [
  { value: 5, label: '5分钟' },
  { value: 10, label: '10分钟' },
  { value: 15, label: '15分钟' },
  { value: 30, label: '30分钟' }
]

const updateRecommendation = () => {
  // 根据手动参数更新推荐
  if (formData.value.tempo === 'slow') {
    recommendation.value.bpm = 60 + Math.floor(Math.random() * 10)
  } else if (formData.value.tempo === 'medium') {
    recommendation.value.bpm = 75 + Math.floor(Math.random() * 15)
  } else {
    recommendation.value.bpm = 95 + Math.floor(Math.random() * 15)
  }

  recommendation.value.instrument = getInstrumentName(formData.value.instrument)
  recommendation.value.ambient = formData.value.ambient === 'none' ? '无' : getAmbientName(formData.value.ambient)
}

// 将表单乐器值转换为显示名称
const getInstrumentName = (value) => {
  const found = instrumentOptions.find(o => o.value === value)
  return found ? found.label : value
}

// 将表单氛围值转换为显示名称
const getAmbientName = (value) => {
  const found = ambientOptions.find(o => o.value === value)
  return found ? found.label : value
}

onMounted(() => {
  // 从URL参数获取场景和时间段
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  const options = currentPage.options || {}

  sceneId.value = options.scene || 'focus'
  timePeriod.value = options.timePeriod || '下午专注'

  // 如果有场景描述，设置到表单中
  if (options.sceneDesc) {
    formData.value.sceneInput = decodeURIComponent(options.sceneDesc)
  }

  // 根据场景调整推荐参数
  if (sceneId.value === 'sleep') {
    recommendation.value.bpm = 55
    recommendation.value.key = 'A小调'
    recommendation.value.ambient = '雨声25%'
    recommendation.value.instrument = '钢琴+弦乐'
  } else if (sceneId.value === 'relax') {
    recommendation.value.bpm = 68
    recommendation.value.key = 'C大调'
    recommendation.value.ambient = '雨声'
    recommendation.value.instrument = '钢琴+电子Pad'
  } else if (sceneId.value === 'focus') {
    recommendation.value.bpm = 85
    recommendation.value.key = 'C大调'
    recommendation.value.ambient = '无'
    recommendation.value.instrument = '钢琴独奏'
  } else if (sceneId.value === 'meditate') {
    recommendation.value.bpm = 60
    recommendation.value.key = '全音阶'
    recommendation.value.ambient = '森林'
    recommendation.value.instrument = 'Pad合成器'
  } else if (sceneId.value === 'study') {
    recommendation.value.bpm = 75
    recommendation.value.key = 'C大调'
    recommendation.value.ambient = '白噪音'
    recommendation.value.instrument = '古典吉他'
  }
  updateRecommendation()
})

// 将LLM返回的乐器名称转换为表单值
const getInstrumentValue = (instrument) => {
  const lower = instrument.toLowerCase()
  if (lower.includes('钢琴')) return 'piano'
  if (lower.includes('弦乐')) return 'strings'
  if (lower.includes('pad') || lower.includes('电子')) return 'pad'
  if (lower.includes('自然')) return 'nature'
  return 'piano' // 默认
}

// 将LLM返回的氛围名称转换为表单值
const getAmbientValue = (ambient) => {
  const lower = ambient.toLowerCase()
  if (lower.includes('雨')) return 'rain'
  if (lower.includes('海') || lower.includes('浪')) return 'ocean'
  if (lower.includes('森林')) return 'forest'
  if (lower.includes('白噪音') || lower.includes('白噪声')) return 'white-noise'
  return 'none'
}

const selectInstrument = (value) => {
  formData.value.instrument = value
  updateRecommendation()
}

const selectAmbient = (value) => {
  formData.value.ambient = value
  updateRecommendation()
}

const selectDuration = (value) => {
  formData.value.duration = value
}

const isGenerating = ref(false)

const startGenerate = async () => {
  if (isGenerating.value) return

  isGenerating.value = true

  try {
    // 构建最终的音乐参数（使用用户当前选择的值）
    const finalBpm = formData.value.tempo === 'slow' ? 60 + Math.floor(Math.random() * 10) : formData.value.tempo === 'medium' ? 75 + Math.floor(Math.random() * 15) : 95 + Math.floor(Math.random() * 15)
    const finalInstrument = getInstrumentName(formData.value.instrument)
    const finalAmbient = formData.value.ambient === 'none' ? '无' : `${formData.value.ambient}`
    const finalKey = recommendation.value.key || 'C大调'

    // 翻译参数为英文（用于Suno prompt）
    const instrumentEn = translateInstrumentToEnglish(finalInstrument)
    const ambientEn = translateAmbientToEnglish(finalAmbient)

    // 前端合并场景描述 + 参数生成完整prompt（英文）
    let mergedPrompt = ''
    if (formData.value.sceneInput.trim()) {
      // 用户输入了场景描述，合并到prompt中
      const sceneDesc = formData.value.sceneInput.trim()
      const ambientPart = finalAmbient === '无' ? '' : `, ${ambientEn} ambient sounds`
      const instrumentPart = instrumentEn ? `, ${instrumentEn}` : ''
      mergedPrompt = `${sceneDesc}, ${finalBpm} BPM${instrumentPart}${ambientPart}`
    } else {
      // 没有场景描述，使用参数构建prompt
      const ambientPart = finalAmbient === '无' ? '' : `, ${ambientEn} ambient`
      mergedPrompt = `A ${finalBpm} BPM music, ${instrumentEn}${ambientPart}`
    }

    console.log('前端合并的prompt:', mergedPrompt)

    // 调用后端 /generate 接口
    const response = await uni.request({
      url: `${CONFIG.API_BASE_URL}/music/generate`,
      method: 'POST',
      timeout: 180000,
      data: {
        time_period: getTimePeriodValue(timePeriod.value),
        provider: undefined,
        duration_minutes: formData.value.duration,
        preferences: {
          bpm: finalBpm,
          key: finalKey,
          instrument: finalInstrument,
          ambient: finalAmbient,
          mix_ratio: formData.value.mixRatio
        },
        optimized_prompt: mergedPrompt
      }
    })

    if (response.statusCode === 200 && response.data) {
      // 存储 musicUrl、duration、title、coverImageUrl 到 Storage
      uni.setStorageSync('lastMusicUrl', response.data.music_url)
      uni.setStorageSync('lastMusicDuration', response.data.duration || 180)
      uni.setStorageSync('lastMusicTitle', response.data.music_title || '疗愈音乐')
      uni.setStorageSync('lastCoverImageUrl', response.data.cover_image_url || '')
      uni.reLaunch({
        url: '/pages/player/index'
      })
    } else {
      uni.showToast({ title: '生成失败', icon: 'none' })
    }
  } catch (error) {
    console.error('生成音乐失败:', error)
    uni.showToast({ title: '网络错误', icon: 'none' })
  } finally {
    isGenerating.value = false
  }
}

// 翻译乐器为英文
const translateInstrumentToEnglish = (instrument) => {
  const lower = instrument.toLowerCase()
  if (lower.includes('钢琴')) return 'piano'
  if (lower.includes('弦乐')) return 'strings'
  if (lower.includes('电子') || lower.includes('pad')) return 'electronic pad synth'
  if (lower.includes('自然') || lower.includes('环境')) return 'nature sounds'
  if (lower.includes('吉他')) return 'guitar'
  if (lower.includes('竖琴')) return 'harp'
  return instrument
}

// 翻译氛围为英文
const translateAmbientToEnglish = (ambient) => {
  const lower = ambient.toLowerCase()
  if (lower.includes('雨')) return 'rain'
  if (lower.includes('海') || lower.includes('浪')) return 'ocean waves'
  if (lower.includes('森林')) return 'forest'
  if (lower.includes('白噪音') || lower.includes('白噪声')) return 'white noise'
  if (lower.includes('鸟')) return 'birds singing'
  if (lower.includes('风')) return 'wind'
  if (lower.includes('雷')) return 'thunder'
  if (lower.includes('篝火') || lower.includes('火')) return 'campfire'
  if (lower.includes('咖')) return 'coffee shop ambience'
  return ambient
}

// 获取场景中文名称
const getSceneName = (sceneId) => {
  const sceneNames = {
    'sleep': '助眠',
    'relax': '减压',
    'focus': '专注',
    'meditate': '冥想',
    'study': '学习'
  }
  return sceneNames[sceneId] || sceneId
}

// 将时间段名称转换为API期望的值
const getTimePeriodValue = (name) => {
  if (name.includes('晨间') || name.includes('唤醒')) return 'morning_wake'
  if (name.includes('上午') || name.includes('专注')) return 'morning_focus'
  if (name.includes('午间') || name.includes('午休')) return 'noon_break'
  if (name.includes('下午') || name.includes('专注')) return 'afternoon_focus'
  if (name.includes('晚间') || name.includes('放松')) return 'evening_relax'
  if (name.includes('睡前') || name.includes('睡眠') || name.includes('助眠')) return 'sleep'
  return 'evening_relax'
}
</script>

<template>
  <view class="container">
    <!-- 顶部导航 -->
    <view class="nav-bar">
      <text class="nav-back" @tap="uni.navigateBack()">← 返回</text>
      <text class="nav-title">生成疗愈音乐</text>
      <view class="nav-placeholder"></view>
    </view>

    <!-- 时段和场景信息 -->
    <view class="time-info">
      <text class="time-label">当前时段：</text>
      <text class="time-value">{{ timePeriod }}</text>
      <text class="scene-badge scene-badge-large">{{ getSceneName(sceneId) }}</text>
    </view>

    <!-- 场景描述输入 -->
    <view class="scene-input-section">
      <text class="section-title">🎵 描述你的音乐场景（可选）</text>
      <view class="input-wrapper">
        <textarea
          v-model="formData.sceneInput"
          class="scene-textarea"
          placeholder="例如：轻松的咖啡馆氛围，爵士钢琴..."
          maxlength="200"
        />
      </view>
    </view>

    <!-- 智能推荐 -->
    <view class="recommendation-card">
      <text class="card-title">✨ {{ getSceneName(sceneId) }} 推荐参数</text>
      <view class="recommendation-grid">
        <view class="recommend-item">
          <text class="recommend-label">BPM</text>
          <text class="recommend-value">{{ recommendation.bpm }}</text>
        </view>
        <view class="recommend-item">
          <text class="recommend-label">调式</text>
          <text class="recommend-value">{{ recommendation.key }}</text>
        </view>
        <view class="recommend-item">
          <text class="recommend-label">乐器</text>
          <text class="recommend-value">{{ recommendation.instrument }}</text>
        </view>
        <view class="recommend-item">
          <text class="recommend-label">氛围</text>
          <text class="recommend-value">{{ recommendation.ambient }}</text>
        </view>
      </view>
    </view>

    <!-- 手动调节 -->
    <view class="manual-section">
      <text class="section-title">手动调节</text>

      <!-- 节奏速度 -->
      <view class="control-group">
        <text class="control-label">节奏速度</text>
        <view class="tempo-options">
          <view
            v-for="option in tempoOptions"
            :key="option.value"
            :class="['tempo-item', { active: formData.tempo === option.value }]"
            @tap="formData.tempo = option.value; updateRecommendation()"
          >
            <text class="tempo-label">{{ option.label }}</text>
            <text class="tempo-range">{{ option.bpmRange }}</text>
          </view>
        </view>
      </view>

      <!-- 音乐风格 -->
      <view class="control-group">
        <text class="control-label">音乐风格</text>
        <view class="instrument-options">
          <view
            v-for="option in instrumentOptions"
            :key="option.value"
            :class="['instrument-item', { active: formData.instrument === option.value }]"
            @tap="selectInstrument(option.value)"
          >
            <text class="instrument-icon">{{ option.icon }}</text>
            <text class="instrument-name">{{ option.label }}</text>
          </view>
        </view>
      </view>

      <!-- 氛围音 -->
      <view class="control-group">
        <text class="control-label">氛围音</text>
        <view class="ambient-options">
          <view
            v-for="option in ambientOptions"
            :key="option.value"
            :class="['ambient-item', { active: formData.ambient === option.value }]"
            @tap="selectAmbient(option.value)"
          >
            <text class="ambient-icon">{{ option.icon }}</text>
            <text class="ambient-name">{{ option.label }}</text>
          </view>
        </view>
        <view class="mix-ratio" v-if="formData.ambient !== 'none'">
          <text class="ratio-label">混音比例: {{ formData.mixRatio }}%</text>
          <slider
            :value="formData.mixRatio"
            :min="10"
            :max="50"
            :step="5"
            @change="(e) => { formData.mixRatio = e.detail.value; updateRecommendation() }"
            activeColor="#FF6B00"
            backgroundColor="rgba(248,248,255,0.15)"
          />
        </view>
      </view>

      <!-- 时长 -->
      <view class="control-group">
        <text class="control-label">时长</text>
        <view class="duration-options">
          <view
            v-for="option in durationOptions"
            :key="option.value"
            :class="['duration-item', { active: formData.duration === option.value }]"
            @tap="selectDuration(option.value)"
          >
            <text class="duration-text">{{ option.label }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 生成按钮 -->
    <view class="generate-action">
      <button class="btn-generate" :disabled="isGenerating" @tap="startGenerate">
        {{ isGenerating ? '🎵 生成中...' : '✨ 开始生成' }}
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

.nav-bar {
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 0;
}

.nav-back {
  font-size: 28rpx;
  color: #FF6B00;
}

.nav-title {
  font-size: 32rpx;
  font-weight: bold;
}

.nav-placeholder {
  width: 100rpx;
}

.time-info {
  flex-direction: row;
  align-items: center;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12rpx;
  padding: 20rpx;
  margin-bottom: 30rpx;
}

.time-label {
  font-size: 26rpx;
  color: #888;
}

.time-value {
  font-size: 28rpx;
  color: #e0e0e0;
  margin-right: 16rpx;
}

.scene-badge {
  font-size: 22rpx;
  background: #667eea;
  padding: 6rpx 16rpx;
  border-radius: 20rpx;
  color: #fff;
}

.scene-badge-large {
  font-size: 26rpx;
  background: linear-gradient(135deg, #667eea, #764ba2);
  padding: 10rpx 24rpx;
  border-radius: 25rpx;
  color: #fff;
  font-weight: bold;
}

.scene-input-section {
  margin-bottom: 30rpx;
}

.scene-input-section .section-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #F8F8FF;
  margin-bottom: 16rpx;
  display: block;
}

.input-wrapper {
  background: rgba(42, 42, 69, 0.9);
  border-radius: 16rpx;
  padding: 20rpx;
  border: 2rpx solid rgba(255, 107, 0, 0.4);
}

.scene-textarea {
  width: 100%;
  min-height: 100rpx;
  background: rgba(26, 26, 46, 0.8);
  border-radius: 12rpx;
  padding: 16rpx;
  font-size: 28rpx;
  color: #F8F8FF;
  border: 1rpx solid rgba(255, 107, 0, 0.3);
  box-sizing: border-box;
}

.scene-textarea::placeholder {
  color: #A0A0C0;
}

.scene-textarea:focus {
  border-color: #FF6B00;
  outline: none;
}

.recommendation-card {
  background: rgba(42, 42, 69, 0.8);
  border-radius: 20rpx;
  padding: 30rpx;
  margin-bottom: 30rpx;
  border: 1px solid rgba(255, 107, 0, 0.3);
}

.card-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #F8F8FF;
  margin-bottom: 20rpx;
  display: block;
}

.recommendation-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
}

.recommend-item {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12rpx;
  padding: 20rpx;
  text-align: center;
}

.recommend-label {
  font-size: 22rpx;
  color: #888;
  display: block;
  margin-bottom: 8rpx;
}

.recommend-value {
  font-size: 32rpx;
  font-weight: bold;
  color: #60a5fa;
}

.manual-section {
  margin-bottom: 40rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #F8F8FF;
  margin-bottom: 24rpx;
  display: block;
}

.control-group {
  margin-bottom: 30rpx;
}

.control-label {
  font-size: 26rpx;
  color: #e0e0e0;
  margin-bottom: 16rpx;
  display: block;
}

.tempo-options {
  flex-direction: row;
  justify-content: space-between;
}

.tempo-item {
  flex: 1;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12rpx;
  padding: 20rpx;
  margin: 0 8rpx;
  text-align: center;
  border: 2px solid transparent;
  transition: all 0.2s;
}

.tempo-item.active {
  border-color: #667eea;
  background: rgba(102, 126, 234, 0.2);
}

.tempo-label {
  font-size: 26rpx;
  color: #e0e0e0;
  display: block;
}

.tempo-range {
  font-size: 20rpx;
  color: #888;
  margin-top: 6rpx;
  display: block;
}

.instrument-options {
  flex-direction: row;
  justify-content: space-between;
}

.instrument-item {
  flex: 1;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12rpx;
  padding: 20rpx 10rpx;
  margin: 0 6rpx;
  text-align: center;
  border: 2px solid transparent;
  transition: all 0.2s;
}

.instrument-item.active {
  border-color: #667eea;
  background: rgba(102, 126, 234, 0.2);
}

.instrument-icon {
  font-size: 36rpx;
  display: block;
  margin-bottom: 8rpx;
}

.instrument-name {
  font-size: 22rpx;
  color: #e0e0e0;
}

.ambient-options {
  flex-direction: row;
  justify-content: space-between;
  margin-bottom: 16rpx;
}

.ambient-item {
  flex: 1;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12rpx;
  padding: 16rpx 8rpx;
  margin: 0 6rpx;
  text-align: center;
  border: 2px solid transparent;
  transition: all 0.2s;
}

.ambient-item.active {
  border-color: #667eea;
  background: rgba(102, 126, 234, 0.2);
}

.ambient-icon {
  font-size: 32rpx;
  display: block;
  margin-bottom: 6rpx;
}

.ambient-name {
  font-size: 20rpx;
  color: #e0e0e0;
}

.mix-ratio {
  margin-top: 16rpx;
}

.ratio-label {
  font-size: 24rpx;
  color: #888;
  margin-bottom: 8rpx;
  display: block;
}

.duration-options {
  flex-direction: row;
  justify-content: space-between;
}

.duration-item {
  flex: 1;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12rpx;
  padding: 20rpx;
  margin: 0 8rpx;
  text-align: center;
  border: 2px solid transparent;
  transition: all 0.2s;
}

.duration-item.active {
  border-color: #667eea;
  background: rgba(102, 126, 234, 0.2);
}

.duration-text {
  font-size: 26rpx;
  color: #e0e0e0;
}

.generate-action {
  padding: 20rpx 0;
}

.btn-generate {
  width: 100%;
  background: linear-gradient(135deg, #FF6B00 0%, #FF8C42 100%);
  color: #fff;
  font-size: 34rpx;
  font-weight: bold;
  padding: 28rpx;
  border-radius: 50rpx;
  border: none;
}
</style>