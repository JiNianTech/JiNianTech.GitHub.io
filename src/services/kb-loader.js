// 知识库加载器 — 直接导入 kb.json

import kb from '../data/kb.json'

/**
 * 获取知识库
 */
export function getKB() {
  return kb
}

/**
 * 获取分类列表
 */
export function getCategories() {
  return kb.categories.map(c => ({
    id: c.id,
    name: c.name,
    nameEn: c.nameEn,
    count: c.entries.length,
    entries: c.entries
  }))
}

export default { getKB, getCategories }
