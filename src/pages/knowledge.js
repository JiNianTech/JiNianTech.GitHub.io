// 知识库浏览页 (转换自 pages/knowledge/knowledge)
import { getCategories } from '../services/kb-loader.js'

export async function render(params, container) {
  const categories = getCategories()

  container.innerHTML = `
    <div class="page-container">
      <div class="page-header">
        <h1>📚 故障知识库</h1>
        <p>${categories.length} 个分类 · 总计 ${categories.reduce((s, c) => s + c.count, 0)} 条诊断规则</p>
      </div>

      <!-- 分类标签 -->
      <div id="category-tabs" style="display:flex;gap:0.375rem;overflow-x:auto;padding-bottom:0.5rem;margin-bottom:1rem;-webkit-overflow-scrolling:touch;">
        ${categories.map((cat, i) => `
          <button class="cat-tab" data-id="${cat.id}" style="flex-shrink:0;padding:0.5rem 0.875rem;border:none;border-radius:0.75rem;font-size:0.75rem;cursor:pointer;white-space:nowrap;
            background:${i===0 ? 'rgba(59,130,246,0.15)' : 'var(--card-bg)'};
            color:${i===0 ? '#fff' : 'var(--text-muted)'};">${cat.name} <span style="opacity:0.6;">${cat.count}</span></button>
        `).join('')}
      </div>

      <!-- 搜索 -->
      <div style="position:relative;margin-bottom:0.75rem;">
        <input type="text" id="search-input" placeholder="搜索故障关键词..." style="width:100%;padding:0.625rem 0.75rem;background:var(--card-bg);border:1px solid var(--card-border);border-radius:0.75rem;color:var(--text-primary);font-size:0.8125rem;">
      </div>

      <!-- 条目列表 -->
      <div id="entries-list">
        ${renderEntries(categories[0]?.entries || [])}
      </div>
    </div>
  `

  let activeCategory = categories[0]
  let searchKeyword = ''

  // 分类切换
  container.querySelectorAll('.cat-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const id = tab.dataset.id
      activeCategory = categories.find(c => c.id === id)

      // 更新高亮
      container.querySelectorAll('.cat-tab').forEach(t => {
        t.style.background = t.dataset.id === id ? 'rgba(59,130,246,0.15)' : 'var(--card-bg)'
        t.style.color = t.dataset.id === id ? '#fff' : 'var(--text-muted)'
      })

      searchKeyword = ''
      container.querySelector('#search-input').value = ''
      renderCurrentEntries()
    })
  })

  // 搜索
  const searchInput = container.querySelector('#search-input')
  let searchTimeout
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout)
    searchTimeout = setTimeout(() => {
      searchKeyword = searchInput.value.trim().toLowerCase()
      renderCurrentEntries()
    }, 300)
  })

  function renderCurrentEntries() {
    let entries = activeCategory?.entries || []
    if (searchKeyword) {
      entries = entries.filter(en => {
        const title = en.faultInfo?.title || ''
        const kws = en.matchPattern?.keywords || []
        return title.toLowerCase().includes(searchKeyword) ||
          kws.some(k => k.toLowerCase().includes(searchKeyword))
      })
    }
    container.querySelector('#entries-list').innerHTML = renderEntries(entries)
  }
}

function renderEntries(entries) {
  if (entries.length === 0) {
    return '<div style="text-align:center;padding:2rem;color:var(--text-muted);">未找到匹配条目</div>'
  }

  return entries.map(entry => {
    const info = entry.faultInfo
    const sevColor = { critical: '#EF4444', warning: '#F59E0B', info: '#3B82F6', normal: '#10B981' }[info.severity] || '#3B82F6'
    const kws = entry.matchPattern?.keywords || []

    return `<div class="card" style="margin-bottom:0.5rem;">
      <div style="display:flex;align-items:flex-start;gap:0.5rem;margin-bottom:0.375rem;">
        <span class="tag" style="background:${sevColor}22;color:${sevColor};flex-shrink:0;">${info.severity === 'critical' ? '严重' : info.severity === 'warning' ? '警告' : '提示'}</span>
        <div>
          <div style="font-weight:600;font-size:0.875rem;">${info.title}</div>
          <div style="color:#9CA3AF;font-size:0.75rem;margin-top:0.125rem;">${info.description}</div>
        </div>
      </div>

      <div style="display:flex;flex-wrap:wrap;gap:0.375rem;margin-top:0.5rem;">
        ${kws.map(k => `<code style="background:rgba(59,130,246,0.1);color:#7DD3FC;padding:0.125rem 0.5rem;border-radius:0.375rem;font-size:0.6875rem;">${k}</code>`).join('')}
        ${entry.matchPattern?.regex ? `<code style="background:rgba(245,158,11,0.1);color:#F59E0B;padding:0.125rem 0.5rem;border-radius:0.375rem;font-size:0.6875rem;">/${entry.matchPattern.regex}/</code>` : ''}
      </div>

      ${(info.affectedComponents || []).length > 0 ? `
        <div style="margin-top:0.5rem;font-size:0.6875rem;color:var(--text-muted);">
          可能故障: ${info.affectedComponents.map(c => `<span style="color:var(--text-primary);">${c.name} (${Math.round((c.probability||0)*100)}%)</span>`).join(', ')}
        </div>
      ` : ''}

      ${info.priority ? `<div style="margin-top:0.375rem;font-size:0.6875rem;color:#60A5FA;">${info.priority}</div>` : ''}
    </div>`
  }).join('')
}
