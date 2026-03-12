// WHO Child Growth Standards — simplified reference tables for ages 0–24 months
// Each row: [month, p3, p15, p50, p85, p97]
// Source: WHO Multicentre Growth Reference Study (MGRS), 2006

export const WHO_WEIGHT_BOYS = [
  [0,  2.5, 3.0, 3.3, 3.7, 4.4],
  [1,  3.4, 4.0, 4.5, 5.0, 5.8],
  [2,  4.4, 5.0, 5.6, 6.2, 7.1],
  [3,  5.0, 5.7, 6.4, 7.1, 8.0],
  [4,  5.6, 6.3, 7.0, 7.8, 8.7],
  [5,  6.0, 6.7, 7.5, 8.3, 9.3],
  [6,  6.4, 7.1, 7.9, 8.8, 9.8],
  [7,  6.7, 7.5, 8.3, 9.2, 10.3],
  [8,  6.9, 7.7, 8.6, 9.6, 10.7],
  [9,  7.1, 7.9, 8.9, 9.9, 11.0],
  [10, 7.4, 8.2, 9.2, 10.2, 11.4],
  [11, 7.6, 8.4, 9.4, 10.5, 11.7],
  [12, 7.7, 8.6, 9.6, 10.8, 11.9],
  [15, 8.3, 9.2, 10.3, 11.5, 12.8],
  [18, 8.8, 9.8, 10.9, 12.2, 13.7],
  [21, 9.3, 10.4, 11.5, 12.9, 14.5],
  [24, 9.7, 10.8, 12.2, 13.6, 15.3],
]

export const WHO_WEIGHT_GIRLS = [
  [0,  2.4, 2.8, 3.2, 3.7, 4.2],
  [1,  3.2, 3.8, 4.2, 4.7, 5.5],
  [2,  4.0, 4.6, 5.1, 5.7, 6.6],
  [3,  4.6, 5.2, 5.8, 6.5, 7.5],
  [4,  5.0, 5.7, 6.4, 7.2, 8.2],
  [5,  5.4, 6.1, 6.9, 7.7, 8.8],
  [6,  5.7, 6.5, 7.3, 8.2, 9.3],
  [7,  6.0, 6.8, 7.6, 8.6, 9.8],
  [8,  6.3, 7.0, 7.9, 8.9, 10.2],
  [9,  6.6, 7.3, 8.2, 9.3, 10.6],
  [10, 6.8, 7.5, 8.5, 9.6, 11.0],
  [11, 7.0, 7.7, 8.7, 9.9, 11.3],
  [12, 7.1, 7.9, 8.9, 10.1, 11.5],
  [15, 7.7, 8.5, 9.6, 11.0, 12.6],
  [18, 8.1, 9.0, 10.2, 11.7, 13.5],
  [21, 8.6, 9.5, 10.9, 12.5, 14.5],
  [24, 9.0, 10.0, 11.5, 13.2, 15.3],
]

// Head circumference-for-age: [month, p3, p50, p97]
// Source: WHO MGRS 2006
export const WHO_HEAD_BOYS = [
  [0,  32.1, 34.5, 37.0],
  [1,  34.9, 37.3, 39.7],
  [2,  36.4, 39.1, 41.7],
  [3,  37.8, 40.5, 43.2],
  [4,  38.9, 41.6, 44.4],
  [5,  39.8, 42.6, 45.3],
  [6,  40.5, 43.3, 46.2],
  [9,  42.0, 45.0, 47.9],
  [12, 43.1, 46.1, 49.2],
  [18, 44.7, 47.6, 50.5],
  [24, 45.5, 48.7, 51.9],
]

export const WHO_HEAD_GIRLS = [
  [0,  31.7, 33.9, 36.2],
  [1,  34.2, 36.5, 38.8],
  [2,  35.8, 38.3, 40.7],
  [3,  37.0, 39.5, 42.0],
  [4,  38.0, 40.6, 43.2],
  [5,  38.9, 41.5, 44.1],
  [6,  39.5, 42.2, 44.9],
  [9,  41.1, 43.9, 46.6],
  [12, 42.3, 44.9, 47.6],
  [18, 43.5, 46.2, 48.9],
  [24, 44.4, 47.1, 49.8],
]

// Height-for-age: [month, p3, p50, p97]
export const WHO_HEIGHT_BOYS = [
  [0,  46.1, 49.9, 53.7],
  [1,  50.8, 54.7, 58.6],
  [2,  53.8, 58.4, 62.4],
  [3,  56.4, 61.4, 65.5],
  [4,  58.6, 63.9, 68.0],
  [5,  60.6, 65.9, 70.1],
  [6,  62.3, 67.6, 72.3],
  [7,  63.9, 69.2, 74.0],
  [8,  65.2, 70.6, 75.5],
  [9,  66.5, 72.0, 76.9],
  [10, 67.7, 73.3, 78.3],
  [11, 68.7, 74.5, 79.6],
  [12, 69.9, 75.7, 81.0],
  [15, 72.7, 79.1, 85.0],
  [18, 74.9, 82.3, 88.7],
  [21, 77.0, 85.0, 91.7],
  [24, 78.7, 87.8, 95.6],
]

export const WHO_HEIGHT_GIRLS = [
  [0,  45.6, 49.1, 52.9],
  [1,  49.8, 53.7, 57.6],
  [2,  52.7, 57.1, 61.1],
  [3,  55.6, 59.8, 64.0],
  [4,  57.8, 62.1, 66.5],
  [5,  59.6, 64.0, 68.5],
  [6,  61.2, 65.7, 70.3],
  [7,  62.7, 67.3, 72.0],
  [8,  64.0, 68.7, 73.5],
  [9,  65.3, 70.1, 75.0],
  [10, 66.5, 71.5, 76.4],
  [11, 67.7, 72.8, 77.8],
  [12, 68.9, 74.0, 79.2],
  [15, 71.6, 77.5, 83.2],
  [18, 73.9, 80.7, 86.9],
  [21, 76.0, 83.7, 90.0],
  [24, 78.0, 86.4, 93.2],
]

// Linear interpolation between two table rows
function lerp(a, b, t) {
  return a + (b - a) * t
}

// Interpolate all values at a given age in months
// Returns an array matching the columns of the table (excluding month column), or null if out of range
export function interpolateWHO(table, ageMonths) {
  if (ageMonths < 0) return null
  const last = table[table.length - 1]
  if (ageMonths > last[0]) return null

  const lowerIdx = table.reduce((best, row, i) => row[0] <= ageMonths ? i : best, 0)
  const lower = table[lowerIdx]
  const upper = table[lowerIdx + 1]

  if (!upper || lower[0] === ageMonths) {
    return lower.slice(1)
  }

  const t = (ageMonths - lower[0]) / (upper[0] - lower[0])
  return lower.slice(1).map((v, i) => lerp(v, upper[i + 1], t))
}

// Returns age in months (fractional) from birthDate to measurementDate
export function ageInMonths(birthDate, measurementDate) {
  if (!birthDate) return null
  const birth = new Date(birthDate)
  const meas = new Date(measurementDate)
  const msPerMonth = 30.4375 * 24 * 3600 * 1000
  return Math.max(0, (meas - birth) / msPerMonth)
}

// Interpolates an estimated percentile from known percentile boundary points
function estimateFromBoundaries(value, boundaries) {
  // boundaries: array of [percentile, refValue] sorted by percentile
  for (let i = 0; i < boundaries.length - 1; i++) {
    const [p0, v0] = boundaries[i]
    const [p1, v1] = boundaries[i + 1]
    if (value <= v1) {
      const t = v1 === v0 ? 0 : (value - v0) / (v1 - v0)
      return Math.round(p0 + t * (p1 - p0))
    }
  }
  return boundaries[boundaries.length - 1][0]
}

// band: which WHO percentile channel the value falls into
function getBand(p) {
  if (p < 3)  return { band: 'low',    label: 'מתחת לאחוזון 3',   color: '#EF4444' }
  if (p < 15) return { band: 'low-normal', label: 'בין P3 לP15',  color: '#F59E0B' }
  if (p < 50) return { band: 'normal', label: 'בין P15 לחציון',   color: '#22C55E' }
  if (p < 85) return { band: 'normal', label: 'בין החציון לP85',  color: '#22C55E' }
  if (p < 97) return { band: 'high-normal', label: 'בין P85 לP97', color: '#F59E0B' }
  return       { band: 'high',   label: 'מעל אחוזון 97',          color: '#EF4444' }
}

function percentileDesc(p) {
  if (p < 3)  return 'מתחת לאחוזון 3'
  if (p < 15) return 'מתחת לטווח הרגיל'
  if (p < 85) return 'טווח גדילה תקין'
  if (p < 97) return 'מעל הממוצע'
  return 'מעל אחוזון 97'
}

// Returns { percentile, desc, band, bandLabel, bandColor } for a weight measurement
export function getWeightPercentileLabel(weightKg, ageMonths, gender) {
  const table = gender === 'female' ? WHO_WEIGHT_GIRLS : WHO_WEIGHT_BOYS
  const ref = interpolateWHO(table, ageMonths)
  if (!ref) return null
  // ref = [p3, p15, p50, p85, p97]
  const [p3, p15, p50, p85, p97] = ref
  const boundaries = [[3, p3], [15, p15], [50, p50], [85, p85], [97, p97]]
  let percentile
  if (weightKg < p3)  percentile = Math.max(1, Math.round((weightKg / p3) * 3))
  else if (weightKg > p97) percentile = 98
  else percentile = estimateFromBoundaries(weightKg, boundaries)
  const { band, label: bandLabel, color: bandColor } = getBand(percentile)
  return { percentile, desc: percentileDesc(percentile), band, bandLabel, bandColor, p3, p15, p50, p85, p97 }
}

// Returns { percentile, desc, band, bandLabel, bandColor } for a head circumference measurement
export function getHeadPercentileLabel(headCm, ageMonths, gender) {
  const table = gender === 'female' ? WHO_HEAD_GIRLS : WHO_HEAD_BOYS
  const ref = interpolateWHO(table, ageMonths)
  if (!ref) return null
  // ref = [p3, p50, p97]
  const [p3, p50, p97] = ref
  const boundaries = [[3, p3], [50, p50], [97, p97]]
  let percentile
  if (headCm < p3)  percentile = Math.max(1, Math.round((headCm / p3) * 3))
  else if (headCm > p97) percentile = 98
  else percentile = estimateFromBoundaries(headCm, boundaries)
  const { band, label: bandLabel, color: bandColor } = getBand(percentile)
  return { percentile, desc: percentileDesc(percentile), band, bandLabel, bandColor, p3, p50, p97 }
}

// Returns { percentile, desc, band, bandLabel, bandColor } for a height measurement
export function getHeightPercentileLabel(heightCm, ageMonths, gender) {
  const table = gender === 'female' ? WHO_HEIGHT_GIRLS : WHO_HEIGHT_BOYS
  const ref = interpolateWHO(table, ageMonths)
  if (!ref) return null
  // ref = [p3, p50, p97]
  const [p3, p50, p97] = ref
  const boundaries = [[3, p3], [50, p50], [97, p97]]
  let percentile
  if (heightCm < p3)  percentile = Math.max(1, Math.round((heightCm / p3) * 3))
  else if (heightCm > p97) percentile = 98
  else percentile = estimateFromBoundaries(heightCm, boundaries)
  const { band, label: bandLabel, color: bandColor } = getBand(percentile)
  return { percentile, desc: percentileDesc(percentile), band, bandLabel, bandColor, p3, p50, p97 }
}
