// 历史记录页 (转换自 pages/history/history)
import { switchTab, navigateTo } from '../router.js'
import { getHistory, clearHistory } from '../services/storage.js'
import { setCurrentDiagnosis } from '../app.js'
import { showToast, showModal } from '../components/toast.js'

export async function render(params, container) {
  const history = await getHistory()

  container.innerHTML = `
    <div class="page-container">
      <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;">
        <h1>📋 诊断记录</h1>
        ${history.length > 0 ? `<button class="btn-ghost" id="btn-clear" style="color:var(--color-critical);">清空</button>` : ''}
      </div>

      ${history.length === 0 ? `
        <div style="text-align:center;padding:3rem 1rem;">
          <div style="font-size:3rem;margin-bottom:0.75rem;">📭</div>
          <p style="color:var(--text-muted);margin-bottom:1rem;">暂无诊断记录</p>
          <button class="btn-primary" id="btn-go-diagnose">🔍 开始诊断</button>
        </div>
      ` : `
        <div id="history-list">
          ${history.map(d => `
            <div class="card history-item" data-id="${d.diagnosisId}" style="cursor:pointer;">
              <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.375rem;">
                <span style="font-size:1.25rem;">📱</span>
                <div style="flex:1;">
                  <div style="font-weight:600;font-size:0.9375rem;">${d.summary?.modelName || '未识别'}</div>
                  <div style="font-size:0.6875rem;color:var(--text-muted);">${d.summary?.bugType?.typeCN || '未知'} · ${d.createdAtStr || ''}</div>
                </div>
                <div>
                  <div style="font-size:1.25rem;font-weight:700;color:${d.health?.overallStatus === 'critical' ? '#EF4444' : d.health?.overallStatus === 'warning' ? '#F59E0B' : '#10B981'};text-align:right;">${d.health?.overall ?? '--'}</div>
                  <div style="font-size:0.625rem;color:var(--text-muted);text-align:right;">分</div>
                </div>
              </div>
              ${d.summary ? `
                <div style="font-size:0.75rem;color:var(--text-muted);">
                  ${d.summary.criticalCount > 0 ? `<span style="color:#EF4444;">🔴${d.summary.criticalCount}</span> ` : ''}
                  ${d.summary.warningCount > 0 ? `<span style="color:#F59E0B;">🟡${d.summary.warningCount}</span> ` : ''}
                  ${d.summary.totalFaults || 0} 项故障
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `

  // 点击历史记录项
  container.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', async () => {
      const id = item.dataset.id
      const found = history.find(d => d.diagnosisId === id)
      if (found) {
        setCurrentDiagnosis(found)
        navigateTo('/dashboard', { id })
      }
    })
  })

  container.querySelector('#btn-go-diagnose')?.addEventListener('click', () => switchTab('/'))

  container.querySelector('#btn-clear')?.addEventListener('click', async () => {
    const result = await showModal({
      title: '确认清空',
      content: '将删除所有本地诊断记录，此操作不可恢复',
      confirmText: '确认清空'
    })
    if (result.confirm) {
      await clearHistory()
      render(params, container)
    }
  })
}
