// Tesseract.js OCR 服务 (替代云函数 ocr-parse)
// 在浏览器中运行，无需后端

let worker = null
let initPromise = null

/**
 * 初始化 OCR Worker (单例)
 */
export async function initOCR(onProgress) {
  if (worker) return worker

  if (!initPromise) {
    initPromise = _initWorker(onProgress)
  }
  return initPromise
}

async function _initWorker(onProgress) {
  const { createWorker } = await import('tesseract.js')

  worker = await createWorker('chi_sim+eng', undefined, {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress({ status: 'recognizing', progress: m.progress || 0 })
      } else if (onProgress) {
        onProgress({ status: m.status, progress: 0 })
      }
    }
  })

  return worker
}

/**
 * OCR 识别图片
 * @param {File|Blob} file 图片文件
 * @param {Function} onProgress 进度回调
 * @returns {Promise<{text: string, itemCount: number}>}
 */
export async function recognizeImage(file, onProgress) {
  const w = await initOCR(onProgress)

  const { data } = await w.recognize(file)

  // 按 y 坐标排序文本行 (还原阅读顺序)
  const lines = data.lines || []
  const sorted = [...lines].sort((a, b) => {
    const ay = a.bbox?.y0 || 0
    const by = b.bbox?.y0 || 0
    return ay - by
  })

  const text = sorted.map(l => l.text).join('\n')

  return {
    text,
    itemCount: sorted.length,
    confidence: data.confidence
  }
}

/**
 * 批量 OCR (多张图片合并)
 * @param {File[]} files 图片文件数组
 * @param {Function} onProgress 进度回调 (接收 {current, total, status, progress})
 * @returns {Promise<{results: Array, mergedText: string, textLength: number}>}
 */
export async function batchOCR(files, onProgress) {
  const results = []

  for (let i = 0; i < files.length; i++) {
    if (onProgress) {
      onProgress({ current: i + 1, total: files.length, status: 'recognizing', progress: 0 })
    }

    try {
      const result = await recognizeImage(files[i], (p) => {
        if (onProgress) onProgress({ ...p, current: i + 1, total: files.length })
      })
      results.push({ fileIndex: i, text: result.text, itemCount: result.itemCount })
    } catch (err) {
      results.push({ fileIndex: i, text: '', error: err.message })
    }
  }

  const mergedText = results.map(r => r.text).filter(Boolean).join('\n\n')

  return {
    results,
    mergedText,
    textLength: mergedText.length
  }
}

/**
 * 释放 OCR Worker
 */
export async function terminateOCR() {
  if (worker) {
    await worker.terminate()
    worker = null
    initPromise = null
  }
}
