<script setup>
import { ref, onMounted } from 'vue'
import CONFIG from '@/config.js'

const prompt = ref('')
const scene = ref('')
const isGenerating = ref(false)

onMounted(() => {
  // 从URL参数获取LLM优化的prompt
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  const options = currentPage.options || {}

  // 从 storage 读 LLM JSON 响应（5+Runtime URL params 不可靠）
  const llmResult = uni.getStorageSync('llmOptimizedResult') || {};
  prompt.value = llmResult.optimized_prompt || ''
  scene.value = llmResult.scene || ''
  // 用完即清，避免下次进入读到上次的
  uni.removeStorageSync('llmOptimizedResult');
})

// 开始生成音乐
const startGenerate = async () => {
  if (isGenerating.value || !prompt.value) return

  isGenerating.value = true

  try {
    // 直接使用LLM生成的prompt
    const response = await uni.request({
      url: `${CONFIG.API_BASE_URL}/music/generate`,
      method: 'POST',
      timeout: 180000,
      data: {
        time_period: getTimePeriodValue(),
        provider: undefined,
        duration_minutes: 3,
        optimized_prompt: prompt.value
      }
    })

    if (response.statusCode === 200 && response.data) {
      // 存储musicUrl、duration、title、coverImageUrl到Storage，跳转到播放页
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

// 获取当前时间段值
const getTimePeriodValue = () => {
  const now = new Date()
  const hour = now.getHours()
  if (hour >= 6 && hour < 8) return 'morning_wake'
  if (hour >= 8 && hour < 12) return 'morning_focus'
  if (hour >= 12 && hour < 14) return 'noon_break'
  if (hour >= 14 && hour < 18) return 'afternoon_focus'
  if (hour >= 18 && hour < 22) return 'evening_relax'
  return 'sleep'
}

// 返回首页重新输入
const goBack = () => {
  uni.navigateBack({
    delta: 1,
    fail: () => {
      uni.reLaunch({
        url: '/pages/index/index'
      })
    }
  })
}
</script>

<template>
  <view class="container">
    <!-- 顶部导航 -->
    <view class="nav-bar">
      <text class="nav-back" @tap="goBack">← 返回</text>
      <text class="nav-title">AI生成专属页</text>
      <view class="nav-placeholder"></view>
    </view>

    <!-- 场景提示 -->
    <view class="scene-badge" v-if="scene">
      <text class="scene-text">场景：{{ scene }}</text>
    </view>

    <!-- Prompt显示区 -->
    <view class="prompt-section">
      <text class="section-title">✨ AI生成的提示词</text>
      <view class="prompt-card">
        <text class="prompt-text">{{ prompt }}</text>
      </view>
      <text class="prompt-hint">提示词已优化，不可修改</text>
    </view>

    <!-- 操作按钮 -->
    <view class="actions">
      <button class="btn-generate" :disabled="isGenerating || !prompt" @tap="startGenerate">
        {{ isGenerating ? '🎵 生成中...' : '✨ 开始生成' }}
      </button>
      <button class="btn-back" @tap="goBack">
        ← 重新输入
      </button>
    </view>

    <!-- 底部说明 -->
    <view class="info-section">
      <text class="info-text">提示词由AI根据您的描述生成，已针对Suno音乐生成优化</text>
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

.scene-badge {
  background: rgba(255, 107, 0, 0.2);
  border-radius: 20rpx;
  padding: 16rpx 24rpx;
  margin-bottom: 30rpx;
  text-align: center;
}

.scene-text {
  font-size: 26rpx;
  color: #FF6B00;
}

.prompt-section {
  margin-bottom: 40rpx;
}

.section-title {
  font-size: 28rpx;
  color: #a0a0a0;
  margin-bottom: 20rpx;
  display: block;
}

.prompt-card {
  background: rgba(42, 42, 69, 0.9);
  border-radius: 20rpx;
  padding: 30rpx;
  border: 2rpx solid rgba(255, 107, 0, 0.4);
}

.prompt-text {
  font-size: 28rpx;
  color: #F8F8FF;
  line-height: 1.6;
}

.prompt-hint {
  font-size: 22rpx;
  color: #A0A0C0;
  margin-top: 16rpx;
  display: block;
  text-align: center;
}

.actions {
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
  margin-bottom: 20rpx;
}

.btn-generate:disabled {
  background: rgba(255, 255, 255, 0.1);
  color: #666;
}

.btn-back {
  width: 100%;
  background: rgba(255, 255, 255, 0.05);
  color: #a0a0a0;
  font-size: 28rpx;
  padding: 20rpx;
  border-radius: 50rpx;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.info-section {
  margin-top: 40rpx;
  padding: 20rpx;
  text-align: center;
}

.info-text {
  font-size: 22rpx;
  color: #666;
}
</style>
