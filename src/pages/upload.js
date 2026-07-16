// 上传页 (转换自 pages/upload/upload)
import { redirectTo } from '../router.js'
import { showToast } from '../components/toast.js'
import { shortId, compressImage } from '../utils/util.js'
import { setCurrentDiagnosis } from '../app.js'

export async function render(params, container) {
  // 图片状态
  let images = []
  const maxImages = 5

  container.innerHTML = `
    <div class="page-container">
      <div class="page-header">
        <h1>📤 上传日志</h1>
        <p>支持截屏图片或粘贴 panic 日志文本</p>
      </div>

      <!-- Tab 切换 -->
      <div style="display:flex;gap:0;margin-bottom:1rem;background:var(--card-bg);border-radius:1rem;padding:0.25rem;">
        <button class="upload-tab active" data-tab="image" style="flex:1;padding:0.625rem;border:none;background:none;color:var(--text-primary);font-size:0.875rem;border-radius:0.75rem;cursor:pointer;">📷 图片上传</button>
        <button class="upload-tab" data-tab="text" style="flex:1;padding:0.625rem;border:none;background:none;color:var(--text-muted);font-size:0.875rem;border-radius:0.75rem;cursor:pointer;">📝 粘贴文本</button>
      </div>

      <!-- 图片上传区域 -->
      <div id="upload-image-area">
        <div id="image-preview" style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.75rem;"></div>
        ${images.length < maxImages ? `
          <div style="display:flex;gap:0.75rem;margin-bottom:1rem;">
            <button class="btn-secondary" id="btn-album" style="flex:1;">🖼️ 从相册选择</button>
            <button class="btn-secondary" id="btn-camera" style="flex:1;">📸 拍照</button>
          </div>
        ` : ''}
        <input type="file" id="file-input" accept="image/*" style="display:none;" multiple>
        <input type="file" id="camera-input" accept="image/*" capture="environment" style="display:none;">
      </div>

      <!-- 文本粘贴区域 -->
      <div id="upload-text-area" style="display:none;">
        <textarea id="text-input" placeholder="请粘贴 iPhone 分析数据中的 panic-full 日志文本..." style="width:100%;min-height:12rem;background:var(--card-bg);border:1px solid var(--card-border);border-radius:1rem;padding:0.75rem;color:var(--text-primary);font-family:var(--font-mono);font-size:0.75rem;resize:vertical;"></textarea>
        <div style="display:flex;justify-content:space-between;align-items:center;margin:0.5rem 0;">
          <span style="color:var(--text-muted);font-size:0.75rem;" id="char-count">0 字符</span>
          <div style="display:flex;gap:0.5rem;">
            <button class="btn-ghost" id="btn-paste" style="font-size:0.8125rem;">📋 从剪贴板粘贴</button>
            <button class="btn-ghost" id="btn-clear-text" style="font-size:0.8125rem;color:var(--color-critical);">清空</button>
          </div>
        </div>
      </div>

      <!-- 开始诊断 -->
      <button class="btn-primary" id="btn-diagnose" style="width:100%;margin-top:1rem;">
        🚀 开始诊断
      </button>
    </div>
  `

  // ===== 状态管理 =====
  let activeTab = 'image'
  let pastedText = ''

  const tabBtns = container.querySelectorAll('.upload-tab')
  const imageArea = container.querySelector('#upload-image-area')
  const textArea = container.querySelector('#upload-text-area')
  const imagePreview = container.querySelector('#image-preview')
  const textInput = container.querySelector('#text-input')
  const charCount = container.querySelector('#char-count')
  const fileInput = container.querySelector('#file-input')
  const cameraInput = container.querySelector('#camera-input')

  // Tab 切换
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab
      tabBtns.forEach(b => { b.classList.toggle('active', b.dataset.tab === activeTab); b.style.color = b.dataset.tab === activeTab ? 'var(--text-primary)' : 'var(--text-muted)'; b.style.background = b.dataset.tab === activeTab ? 'rgba(59,130,246,0.15)' : 'none' })
      imageArea.style.display = activeTab === 'image' ? 'block' : 'none'
      textArea.style.display = activeTab === 'text' ? 'block' : 'none'
    })
  })
  // 默认 image tab 高亮
  tabBtns[0]?.click()

  // 渲染预览
  function renderPreviews() {
    imagePreview.innerHTML = images.map((img, i) => `
      <div style="position:relative;width:calc(33.33% - 0.34rem);aspect-ratio:1;border-radius:0.75rem;overflow:hidden;background:var(--card-bg);">
        <img src="${img.url}" style="width:100%;height:100%;object-fit:cover;" alt="preview">
        <button class="btn-remove-img" data-index="${i}" style="position:absolute;top:0.25rem;right:0.25rem;width:1.5rem;height:1.5rem;border-radius:50%;background:rgba(239,68,68,0.8);color:#fff;border:none;font-size:0.75rem;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
      </div>
    `).join('')

    imagePreview.querySelectorAll('.btn-remove-img').forEach(btn => {
      btn.addEventListener('click', () => {
        images.splice(parseInt(btn.dataset.index), 1)
        if (images.length < maxImages) {
          container.querySelector('#btn-album').style.display = ''
          container.querySelector('#btn-camera').style.display = ''
        }
        renderPreviews()
      })
    })
  }

  const addImages = async (files) => {
    const remaining = maxImages - images.length
    const toAdd = Array.from(files).slice(0, remaining)

    for (const file of toAdd) {
      const compressed = await compressImage(file)
      images.push({ file: compressed, url: URL.createObjectURL(compressed) })
    }

    if (images.length >= maxImages) {
      container.querySelector('#btn-album').style.display = 'none'
      container.querySelector('#btn-camera').style.display = 'none'
    }

    renderPreviews()
  }

  // 从相册
  container.querySelector('#btn-album')?.addEventListener('click', () => fileInput.click())
  fileInput?.addEventListener('change', (e) => {
    if (e.target.files.length) addImages(e.target.files)
    e.target.value = ''
  })

  // 拍照
  container.querySelector('#btn-camera')?.addEventListener('click', () => cameraInput.click())
  cameraInput?.addEventListener('change', (e) => {
    if (e.target.files.length) addImages(e.target.files)
    e.target.value = ''
  })

  // 文本输入
  textInput?.addEventListener('input', () => {
    pastedText = textInput.value
    charCount.textContent = `${pastedText.length} 字符`
  })

  // 粘贴
  container.querySelector('#btn-paste')?.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        pastedText = text
        textInput.value = text
        charCount.textContent = `${text.length} 字符`
        showToast('已粘贴', 'success', 1500)
      } else {
        showToast('剪贴板为空', 'none', 2000)
      }
    } catch {
      showToast('粘贴失败，请手动粘贴', 'none', 2000)
    }
  })

  // 清空文本
  container.querySelector('#btn-clear-text')?.addEventListener('click', () => {
    pastedText = ''
    textInput.value = ''
    charCount.textContent = '0 字符'
  })

  // 开始诊断
  container.querySelector('#btn-diagnose')?.addEventListener('click', async () => {
    const diagnosisId = shortId('diag_')

    if (activeTab === 'image') {
      if (images.length === 0) {
        showToast('请先上传日志图片', 'none', 2000)
        return
      }
      setCurrentDiagnosis({
        diagnosisId,
        inputMode: 'image',
        images: images.map(img => img.file),
        createdAt: Date.now()
      })
    } else {
      if (pastedText.trim().length < 20) {
        showToast('文本过短，请粘贴完整日志', 'none', 2000)
        return
      }
      setCurrentDiagnosis({
        diagnosisId,
        inputMode: 'text',
        rawText: pastedText,
        createdAt: Date.now()
      })
    }

    redirectTo('/analyzing', { id: diagnosisId })
  })
}
