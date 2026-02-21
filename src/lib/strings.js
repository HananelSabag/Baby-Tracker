import he from '../i18n/he.json'

// Flat accessor with dot-notation path, e.g. t('feeding.title')
export function t(path, vars = {}) {
  const keys = path.split('.')
  let value = keys.reduce((obj, key) => obj?.[key], he)

  if (value === undefined) {
    console.warn(`[i18n] Missing key: "${path}"`)
    return path
  }

  // Simple variable interpolation: {{varName}}
  return String(value).replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`)
}

export default he
