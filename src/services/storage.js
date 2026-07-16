// IndexedDB 存储服务 (替代 wx.getStorageSync / wx.setStorageSync)

let db = null

async function getDB() {
  if (db) return db

  const { openDB } = await import('idb')

  db = await openDB('iphone-diagnostic', 1, {
    upgrade(database) {
      if (!database.objectStoreNames.contains('storage')) {
        database.createObjectStore('storage')
      }
      if (!database.objectStoreNames.contains('history')) {
        const store = database.createObjectStore('history', { keyPath: 'diagnosisId' })
        store.createIndex('createdAt', 'createdAt', { unique: false })
      }
    }
  })

  return db
}

/**
 * 存储键值对
 */
export async function setItem(key, value) {
  const db = await getDB()
  await db.put('storage', value, key)
}

/**
 * 读取键值
 */
export async function getItem(key) {
  const db = await getDB()
  return db.get('storage', key)
}

/**
 * 删除键
 */
export async function removeItem(key) {
  const db = await getDB()
  await db.delete('storage', key)
}

/**
 * 保存诊断历史 (替代 wx.setStorageSync('diagnostic_history', ...))
 */
export async function saveHistory(diagnosis) {
  const db = await getDB()
  await db.put('history', diagnosis)

  // 保持最多 20 条
  const all = await db.getAll('history')
  if (all.length > 20) {
    all.sort((a, b) => b.createdAt - a.createdAt)
    const toDelete = all.slice(20)
    const tx = db.transaction('history', 'readwrite')
    for (const d of toDelete) {
      await tx.store.delete(d.diagnosisId)
    }
    await tx.done
  }
}

/**
 * 获取诊断历史列表
 */
export async function getHistory() {
  const db = await getDB()
  const all = await db.getAll('history')
  all.sort((a, b) => b.createdAt - a.createdAt)
  return all
}

/**
 * 清空历史
 */
export async function clearHistory() {
  const db = await getDB()
  await db.clear('history')
}

/**
 * 按 ID 获取单条诊断记录
 */
export async function getDiagnosisById(id) {
  const db = await getDB()
  return db.get('history', id)
}

export default { setItem, getItem, removeItem, saveHistory, getHistory, clearHistory, getDiagnosisById }
