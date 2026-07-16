// 模块详情 (转换自 pages/module-detail/module-detail)
import { getCurrentDiagnosis } from '../app.js'
import { severityMap } from '../utils/util.js'
import { showToast } from '../components/toast.js'
import { navigateBack } from '../router.js'

export async function render(params, container) {
  const moduleId = params.moduleId
  const diag = getCurrentDiagnosis()

  if (!diag) {
    container.innerHTML = `<div class="page-container text-center mt-32"><p>数据丢失</p><button class="btn-primary" onclick="history.back()">返回</button></div>`
    return
  }

  const module = diag.health.modules.find(m => m.id === moduleId)
  if (!module) {
    container.innerHTML = `<div class="page-container text-center mt-32"><p>模块未找到</p></div>`
    return
  }

  const faults = (module.faults || []).map(f => {
    const sev = f.entry.faultInfo?.severity || 'info'
    return {
      ...f,
      info: f.entry.faultInfo,
      severityLabel: severityMap[sev]?.label || '未知',
      severityKey: sev,
      severityColor: severityMap[sev]?.color || '#3B82F6',
      matchTypeLabel: f.matchedBy === 'keyword' ? '精确匹配' : '模糊匹配',
      components: (f.entry.faultInfo?.affectedComponents || []).map(c => ({
        ...c, percent: Math.round((c.probability || 0) * 100)
      })),
      hasEvidences: (f.evidences || []).length > 0
    }
  })

  if (faults.length === 0) {
    container.innerHTML = `
      <div class="page-container">
        <div class="page-header"><h1>${module.icon} ${module.name}</h1></div>
        <div class="card text-center"><p style="color:var(--text-muted);">该模块未检测到故障</p></div>
      </div>`
    return
  }

  let currentIndex = 0

  const renderFaultDetail = () => {
    const f = faults[currentIndex]
    if (!f) return ''

    const stepsHtml = (f.info.troubleshootingSteps || []).map(s => `<li style="margin-bottom:0.25rem;">${s}</li>`).join('')
    const compsHtml = f.components.map(c =>
      `<span style="display:inline-block;padding:0.25rem 0.625rem;background:rgba(59,130,246,0.12);border-radius:0.5rem;font-size:0.75rem;color:#93C5FD;margin:0.1875rem;">${c.name} <b>${c.percent}%</b></span>`
    ).join('')

    const evidHtml = (f.evidences || []).map(ev => `
      <div style="background:#050B14;border:1px solid rgba(59,130,246,0.1);border-radius:0.5rem;padding:0.5rem;margin-bottom:0.375rem;">
        <div style="color:var(--text-muted);font-size:0.625rem;margin-bottom:0.125rem;">Line ${ev.lineNumber}</div>
        <div style="font-family:var(--font-mono);font-size:0.6875rem;color:#7DD3FC;word-break:break-all;">${ev.content}</div>
      </div>
    `).join('')

    return `
      <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem;">
        <span class="tag tag-${f.severityKey === 'critical' ? 'critical' : f.severityKey === 'warning' ? 'warning' : 'info'}">${f.severityLabel}</span>
        <span style="font-size:0.75rem;color:var(--text-muted);">${f.matchTypeLabel}</span>
      </div>
      <div class="card">
        <div class="card-title">${f.info.title}</div>
        <div style="color:#9CA3AF;font-size:0.8125rem;margin-bottom:0.75rem;">${f.info.description}</div>

        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;">
          <span style="font-size:0.75rem;color:var(--text-muted);">命中关键词</span>
          <code style="background:rgba(59,130,246,0.1);color:#60A5FA;padding:0.25rem 0.5rem;border-radius:0.375rem;font-size:0.6875rem;">${f.hitKeyword || ''}</code>
        </div>

        ${compsHtml ? `<div style="margin-top:0.75rem;"><div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:0.375rem;">可能故障组件</div>${compsHtml}</div>` : ''}

        ${stepsHtml ? `<div style="margin-top:0.75rem;"><div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:0.375rem;">排查步骤</div><ol style="padding-left:1.25rem;font-size:0.8125rem;color:#E5EAF0;line-height:1.6;">${stepsHtml}</ol></div>` : ''}
      </div>

      ${evidHtml ? `<div style="margin-top:0.5rem;"><div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:0.375rem;">📄 日志证据</div>${evidHtml}</div>` : ''}
    `
  }

  container.innerHTML = `
    <div class="page-container">
      <div class="page-header" style="display:flex;align-items:center;gap:0.5rem;padding-bottom:0.75rem;border-bottom:1px solid rgba(255,255,255,0.06);margin-bottom:0.75rem;">
        <button class="btn-ghost" id="btn-back" style="padding:0.25rem 0;">← 返回</button>
        <h1 style="font-size:1.25rem;margin:0;">${module.icon} ${module.name}</h1>
      </div>

      <!-- 故障标签切换 -->
      <div style="display:flex;gap:0.5rem;overflow-x:auto;padding-bottom:0.5rem;margin-bottom:0.75rem;" id="fault-tabs">
        ${faults.map((f, i) => `
          <button class="fault-tab" data-index="${i}" style="flex-shrink:0;padding:0.5rem 0.75rem;border:none;border-radius:0.75rem;font-size:0.75rem;cursor:pointer;white-space:nowrap;
            background:${i===0 ? 'rgba(59,130,246,0.15)' : 'var(--card-bg)'};
            color:${i===0 ? '#fff' : 'var(--text-muted)'};
            border:1px solid ${i===0 ? 'rgba(59,130,246,0.3)' : 'transparent'};">${f.info.title}</button>
        `).join('')}
      </div>

      <!-- 故障详情 -->
      <div id="fault-detail">${renderFaultDetail()}</div>

      <!-- 分页 -->
      <div style="display:flex;justify-content:center;gap:0.5rem;margin-top:1rem;" id="pagination">
        <button class="btn-secondary" id="btn-prev" style="padding:0.5rem 1rem;font-size:0.8125rem;" ${currentIndex === 0 ? 'disabled' : ''}>← 上一个</button>
        <span style="color:var(--text-muted);font-size:0.75rem;align-self:center;">${currentIndex + 1} / ${faults.length}</span>
        <button class="btn-secondary" id="btn-next" style="padding:0.5rem 1rem;font-size:0.8125rem;" ${currentIndex >= faults.length - 1 ? 'disabled' : ''}>下一个 →</button>
      </div>
    </div>
  `

  const updateView = () => {
    container.querySelector('#fault-detail').innerHTML = renderFaultDetail()
    // 更新 tab 高亮
    container.querySelectorAll('.fault-tab').forEach((tab, i) => {
      tab.style.background = i === currentIndex ? 'rgba(59,130,246,0.15)' : 'var(--card-bg)'
      tab.style.color = i === currentIndex ? '#fff' : 'var(--text-muted)'
      tab.style.border = i === currentIndex ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent'
    })
    // 更新分页
    container.querySelector('#pagination').innerHTML = `
      <button class="btn-secondary" id="btn-prev" style="padding:0.5rem 1rem;font-size:0.8125rem;" ${currentIndex === 0 ? 'disabled' : ''}>← 上一个</button>
      <span style="color:var(--text-muted);font-size:0.75rem;align-self:center;">${currentIndex + 1} / ${faults.length}</span>
      <button class="btn-secondary" id="btn-next" style="padding:0.5rem 1rem;font-size:0.8125rem;" ${currentIndex >= faults.length - 1 ? 'disabled' : ''}>下一个 →</button>
    `
    bindPagination()
  }

  const bindPagination = () => {
    container.querySelector('#btn-prev')?.addEventListener('click', () => {
      if (currentIndex > 0) { currentIndex--; updateView() }
    })
    container.querySelector('#btn-next')?.addEventListener('click', () => {
      if (currentIndex < faults.length - 1) { currentIndex++; updateView() }
    })
  }

  // Tab 切换
  container.querySelectorAll('.fault-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      currentIndex = parseInt(tab.dataset.index)
      updateView()
    })
  })

  bindPagination()

  container.querySelector('#btn-back')?.addEventListener('click', () => navigateBack())

  // 复制关键词
  container.addEventListener('click', (e) => {
    if (e.target.closest('code')) {
      const text = e.target.closest('code').textContent
      navigator.clipboard.writeText(text).then(() => showToast('已复制'))
    }
  })
}
