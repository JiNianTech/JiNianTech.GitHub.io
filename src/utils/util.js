// 工具函数 (转换自 utils/util.js)
// 微信 rpx → 已全部转为 CSS rem

/**
 * 格式化时间 YYYY-MM-DD HH:mm:ss
 */
export function formatTime(date) {
  if (!date) date = new Date()
  if (typeof date === 'string' || typeof date === 'number') date = new Date(date)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`
}

/**
 * 生成短ID
 */
export function shortId(prefix = '') {
  const t = Date.now().toString(36)
  const r = Math.random().toString(36).slice(2, 6)
  return `${prefix}${t}${r}`
}

/**
 * 严重程度映射
 */
export const severityMap = {
  critical: { label: '严重', color: '#EF4444', tag: 'tag-critical' },
  warning:  { label: '警告', color: '#F59E0B', tag: 'tag-warning' },
  info:     { label: '提示', color: '#3B82F6', tag: 'tag-info' },
  normal:   { label: '正常', color: '#10B981', tag: 'tag-normal' }
}

/**
 * 严重程度扣分权重
 */
export const severityWeight = {
  critical: 50,
  warning:  20,
  info:     5,
  normal:   0
}

/**
 * 模块显示配置
 */
export const moduleDisplayMap = {
  display:              { name: '屏幕系统',   icon: '🖥️', order: 1 },
  power:                { name: '电源系统',   icon: '⚡',  order: 2 },
  cpu_board:            { name: '主板/CPU',   icon: '🔧', order: 3 },
  storage:              { name: '存储',       icon: '💾', order: 4 },
  baseband:             { name: '网络/基带',  icon: '📡', order: 5 },
  aop:                  { name: '音频/振动',  icon: '🔊', order: 6 },
  smc:                  { name: '系统管理',   icon: '⚙️', order: 7 },
  sensor:               { name: '传感器',     icon: '📐', order: 8 },
  sleep_wake:           { name: '休眠唤醒',   icon: '😴', order: 9 },
  system_termination:   { name: '系统终止',   icon: '📋', order: 10 },
  exception_dispatcher: { name: '异常分诊',   icon: '🔍', order: 11 },
  kernel_panic_types:   { name: '内核崩溃',   icon: '💥', order: 12 }
}

/**
 * HTML 转义
 */
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]))
}

/**
 * 文本截断
 */
export function truncate(str, len) {
  if (!str) return ''
  return str.length > len ? str.slice(0, len) + '...' : str
}

/**
 * 图片压缩 (Canvas-based)
 * 替代 wx.compressImage
 */
export function compressImage(file, maxKB = 500) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img
        // 限制最大尺寸
        const maxDim = 2048
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)

        // 二分法找到合适质量
        let quality = 0.8
        canvas.toBlob((blob) => {
          resolve(new File([blob], file.name || 'compressed.jpg', { type: 'image/jpeg' }))
        }, 'image/jpeg', quality)
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}
