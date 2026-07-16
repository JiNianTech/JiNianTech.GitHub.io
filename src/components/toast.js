// Toast 组件 (替代 wx.showToast)

/**
 * 显示 Toast
 */
export function showToast(message, icon = 'none', duration = 2000) {
  const container = document.getElementById('toast-container')
  if (!container) return

  const toast = document.createElement('div')
  toast.className = 'toast'
  toast.textContent = message
  container.appendChild(toast)

  setTimeout(() => {
    if (toast.parentNode) toast.remove()
  }, duration + 300)
}

/**
 * 显示 Loading (替代 wx.showLoading)
 */
export function showLoading(title = '加载中...') {
  const overlay = document.getElementById('loading-overlay')
  if (!overlay) return

  overlay.innerHTML = `
    <div class="loading-spinner"></div>
    <div class="loading-text">${title}</div>
  `
  overlay.classList.remove('hidden')
  return () => hideLoading()
}

/**
 * 隐藏 Loading
 */
export function hideLoading() {
  const overlay = document.getElementById('loading-overlay')
  if (overlay) overlay.classList.add('hidden')
}

/**
 * 显示模态弹窗 (替代 wx.showModal)
 */
export function showModal({ title = '', content = '', showCancel = true, confirmText = '确定', cancelText = '取消' } = {}) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('modal-overlay')
    if (!overlay) {
      resolve({ confirm: false, cancel: true })
      return
    }

    overlay.innerHTML = `
      <div class="modal-box">
        ${title ? `<div class="modal-title">${title}</div>` : ''}
        <div class="modal-content">${content}</div>
        <div class="modal-actions">
          ${showCancel ? `<button class="btn-ghost cancel-btn">${cancelText}</button>` : ''}
          <button class="btn-primary confirm-btn" style="min-height:2.25rem;padding:0.5rem 1.25rem;font-size:0.875rem;">${confirmText}</button>
        </div>
      </div>
    `

    overlay.classList.remove('hidden')

    overlay.querySelector('.confirm-btn')?.addEventListener('click', () => {
      overlay.classList.add('hidden')
      resolve({ confirm: true, cancel: false })
    })

    overlay.querySelector('.cancel-btn')?.addEventListener('click', () => {
      overlay.classList.add('hidden')
      resolve({ confirm: false, cancel: true })
    })

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.add('hidden')
        resolve({ confirm: false, cancel: true })
      }
    })
  })
}

/**
 * 显示操作菜单 (替代 wx.showActionSheet)
 */
export function showActionSheet(items = []) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('modal-overlay')
    if (!overlay || items.length === 0) {
      resolve({ tapIndex: -1 })
      return
    }

    const itemsHtml = items.map((item, i) =>
      `<button class="action-sheet-item" data-index="${i}">${item}</button>`
    ).join('')

    overlay.innerHTML = `
      <div class="action-sheet">
        <div class="action-sheet-items">${itemsHtml}</div>
        <button class="action-sheet-cancel">取消</button>
      </div>
    `

    overlay.classList.remove('hidden')

    overlay.querySelectorAll('.action-sheet-item').forEach(btn => {
      btn.addEventListener('click', () => {
        overlay.classList.add('hidden')
        resolve({ tapIndex: parseInt(btn.dataset.index) })
      })
    })

    overlay.querySelector('.action-sheet-cancel')?.addEventListener('click', () => {
      overlay.classList.add('hidden')
      resolve({ tapIndex: -1 })
    })
  })
}
