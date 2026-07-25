import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import {
  ChevronRight, Baby, Moon, Milk, Droplets, TrendingUp,
  Sparkles, BookOpen, ExternalLink, Info,
} from 'lucide-react'
import { useApp } from '../hooks/useAppContext'
import { useChildren } from '../hooks/useChildren'
import { useTrackers } from '../hooks/useTrackers'
import { useFamilyMembers } from '../hooks/useFamily'
import { useChildSummary, RECENT_WINDOW_DAYS } from '../hooks/useChildSummary'
import {
  WHO_WEIGHT_BOYS, WHO_WEIGHT_GIRLS,
  interpolateWHO, ageInMonths, getWeightPercentileLabel,
} from '../lib/whoGrowthData'
import {
  sleepBandForAgeMonths, milestoneBandsForAgeMonths,
  WET_DIAPER_MIN_PER_DAY, WET_DIAPER_RELEVANT_UNTIL_MONTHS,
  SOURCES, MEDICAL_DISCLAIMER,
} from '../lib/childReference'
import { goBack, formatChildAge, cn } from '../lib/utils'
import { HomeSkeleton } from '../components/ui/Skeleton'

const CARD = {
  boxShadow: '0 4px 20px rgba(61,43,31,0.08), inset 0 1px 0 rgba(255,255,255,0.95)',
}

export function ChildSummaryPage() {
  const { identity } = useApp()
  const navigate = useNavigate()
  const { children } = useChildren(identity.familyId)
  const { trackers } = useTrackers(identity.familyId)
  const members = useFamilyMembers(identity.familyId)

  const child = children.find(c => c.id === identity.activeChildId) ?? children[0] ?? null
  const { overview, feeding, diaper, sleep, growth, windowDays, loading, truncated } =
    useChildSummary(identity.familyId, child?.id ?? null, trackers)

  const ageMonths = child?.birth_date ? ageInMonths(child.birth_date, new Date()) : null

  return (
    <div className="px-4 pt-8 pb-10 space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => goBack(navigate, '/')}
          className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center text-brown-600 cursor-pointer active:scale-95 transition-transform flex-shrink-0 border border-cream-200"
          style={{ boxShadow: '0 2px 8px rgba(61,43,31,0.08), inset 0 1px 0 rgba(255,255,255,0.9)' }}
          aria-label="חזור"
        >
          <ChevronRight size={20} />
        </button>
        <div className="min-w-0">
          <h1 className="font-rubik font-bold text-3xl text-brown-800 leading-tight truncate">
            {child ? `הסיפור של ${child.name}` : 'סיכום ילד'}
          </h1>
          <p className="font-rubik text-sm text-brown-400 mt-0.5">כל מה שתיעדתם, במקום אחד</p>
        </div>
      </div>

      {!child ? (
        <EmptyNote
          emoji="👶"
          title="אין ילד/ה נבחר/ת"
          body="הוסיפו ילד/ה בפרופיל המשפחה כדי לראות סיכום."
        />
      ) : loading ? (
        <HomeSkeleton />
      ) : (
        <>
          <HeroSection child={child} overview={overview} />

          <StorySection overview={overview} members={members} feeding={feeding} diaper={diaper} sleep={sleep} />

          <GrowthSection child={child} growth={growth} ageMonths={ageMonths} />

          <SleepSection sleep={sleep} ageMonths={ageMonths} windowDays={windowDays} />

          <FeedingSection feeding={feeding} windowDays={windowDays} />

          <DiaperSection diaper={diaper} ageMonths={ageMonths} windowDays={windowDays} />

          <MilestonesSection child={child} ageMonths={ageMonths} />

          {truncated && (
            <p className="font-rubik text-brown-300 text-xs text-center">
              מוצגים האירועים האחרונים בלבד — הסכומים הכוללים הם מינימום.
            </p>
          )}

          <SourcesSection />
        </>
      )}
    </div>
  )
}

// ── Hero ─────────────────────────────────────────────────────────────────────

function HeroSection({ child, overview }) {
  return (
    <div className="relative rounded-3xl overflow-hidden border border-cream-200" style={CARD}>
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(145deg, #FFF8F0 0%, #F5E6D3 55%, #EDD5B8 100%)' }}
      />
      <div
        className="absolute -top-12 -left-10 w-44 h-44 rounded-full opacity-20"
        style={{ background: 'radial-gradient(circle, #D4A030 0%, transparent 70%)' }}
      />
      <div className="relative px-5 py-5 flex items-center gap-4">
        <div
          className="w-20 h-20 rounded-3xl overflow-hidden bg-cream-200 flex items-center justify-center flex-shrink-0"
          style={{ boxShadow: '0 6px 20px rgba(61,43,31,0.18), 0 0 0 3px #E8C9A8' }}
        >
          {child.avatar_url
            ? <img src={child.avatar_url} alt={child.name} className="w-full h-full object-cover" />
            : <span className="text-4xl">👶</span>
          }
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-rubik font-black text-brown-800 text-2xl leading-tight truncate">{child.name}</p>
          {child.birth_date && (
            <p className="font-rubik text-brown-600 text-sm mt-0.5">
              {formatChildAge(child.birth_date, child.gender)}
            </p>
          )}
          <p className="font-rubik text-brown-500 text-xs mt-1.5">
            {overview.activeDays > 0
              ? `${overview.totalEvents.toLocaleString('he-IL')} דיווחים לאורך ${overview.activeDays} ימים`
              : 'עוד אין דיווחים'}
          </p>
        </div>
      </div>
    </div>
  )
}

// ── The human story ──────────────────────────────────────────────────────────

function StorySection({ overview, members, feeding, diaper, sleep }) {
  // Who logged more. A genuinely nice couple stat, and it comes straight out of
  // the data with no interpretation at all.
  const contributors = useMemo(() => {
    return Object.entries(overview.byMember)
      .map(([id, count]) => ({
        id,
        count,
        name: members.find(m => m.id === id)?.display_name ?? 'לא ידוע',
      }))
      .sort((a, b) => b.count - a.count)
  }, [overview.byMember, members])

  const totalSleepHours = sleep.hasData
    ? Math.round(Object.values(sleep.perDayMs).reduce((s, ms) => s + ms, 0) / 3600000)
    : null

  const tiles = [
    { icon: '🍼', value: feeding.count, label: 'האכלות' },
    { icon: '🧷', value: diaper.count, label: 'חיתולים' },
    { icon: '😴', value: sleep.sessionCount, label: 'תנומות' },
    feeding.totalMl > 0
      ? { icon: '🥛', value: `${(feeding.totalMl / 1000).toFixed(1)} ל׳`, label: 'סה״כ נוזלים' }
      : { icon: '⏱️', value: totalSleepHours ? `${totalSleepHours} שע׳` : '—', label: 'שינה שתועדה' },
  ]

  return (
    <Section icon={<Sparkles size={15} className="text-amber-600" />} title="הסיפור שלכם">
      <div className="grid grid-cols-2 gap-2.5">
        {tiles.map(t => (
          <div
            key={t.label}
            className="bg-white rounded-2xl border border-cream-200 px-3.5 py-3 flex items-center gap-3"
            style={CARD}
          >
            <span className="text-2xl flex-shrink-0">{t.icon}</span>
            <div className="min-w-0">
              <p className="font-rubik font-bold text-brown-800 text-lg leading-none">
                {typeof t.value === 'number' ? t.value.toLocaleString('he-IL') : t.value}
              </p>
              <p className="font-rubik text-brown-400 text-xs mt-0.5 truncate">{t.label}</p>
            </div>
          </div>
        ))}
      </div>

      {contributors.length > 1 && (
        <div className="bg-white rounded-2xl border border-cream-200 px-4 py-3.5 mt-2.5" style={CARD}>
          <p className="font-rubik text-brown-400 text-xs mb-2.5">מי תיעד</p>
          <div className="space-y-2">
            {contributors.slice(0, 4).map(c => {
              const pct = Math.round((c.count / overview.totalEvents) * 100)
              return (
                <div key={c.id} className="flex items-center gap-2.5">
                  <span className="font-rubik text-brown-700 text-sm font-medium w-16 truncate flex-shrink-0">
                    {c.name}
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-cream-100 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: '#C9956C' }}
                    />
                  </div>
                  <span className="font-rubik text-brown-400 text-xs w-9 text-left flex-shrink-0">{pct}%</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </Section>
  )
}

// ── Growth vs WHO ────────────────────────────────────────────────────────────

function GrowthSection({ child, growth, ageMonths }) {
  const gender = child.gender === 'female' ? 'female' : 'male'
  const table = gender === 'female' ? WHO_WEIGHT_GIRLS : WHO_WEIGHT_BOYS

  // Weight measurements placed on the WHO age axis.
  const measured = useMemo(() => {
    if (!child.birth_date) return []
    return growth.points
      .filter(p => p.weightKg != null)
      .map(p => ({ age: ageInMonths(child.birth_date, p.at), kg: p.weightKg }))
      .filter(p => p.age != null && p.age >= 0)
  }, [growth.points, child.birth_date])

  // One row per half-month across the covered span, carrying the three WHO
  // reference lines; the child's own points are merged in at their exact age.
  const chartData = useMemo(() => {
    if (!measured.length) return []
    const maxAge = Math.min(24, Math.max(6, Math.ceil((ageMonths ?? 0) + 1)))
    const rows = []
    for (let a = 0; a <= maxAge; a += 0.5) {
      const ref = interpolateWHO(table, a)
      rows.push({ age: a, p3: ref?.p3 ?? null, p50: ref?.p50 ?? null, p97: ref?.p97 ?? null, kg: null })
    }
    for (const m of measured) {
      if (m.age > maxAge) continue
      const slot = Math.round(m.age * 2) / 2
      const row = rows.find(r => r.age === slot)
      if (row) row.kg = m.kg
      else rows.push({ age: slot, p3: null, p50: null, p97: null, kg: m.kg })
    }
    return rows.sort((a, b) => a.age - b.age)
  }, [measured, table, ageMonths])

  const latest = growth.latestWeight
  const latestAge = latest && child.birth_date ? ageInMonths(child.birth_date, latest.at) : null
  const percentile = (latest?.weightKg != null && latestAge != null)
    ? getWeightPercentileLabel(latest.weightKg, latestAge, gender)
    : null

  if (!growth.count) {
    return (
      <Section icon={<TrendingUp size={15} className="text-green-600" />} title="גדילה">
        <EmptyNote emoji="⚖️" title="עוד אין מדידות" body="הוסיפו משקל או גובה במעקב הגדילה כדי לראות את העקומה." />
      </Section>
    )
  }

  return (
    <Section icon={<TrendingUp size={15} className="text-green-600" />} title="גדילה">
      <div className="bg-white rounded-2xl border border-cream-200 px-4 py-4" style={CARD}>
        {/* Latest reading */}
        <div className="flex items-end gap-4 flex-wrap mb-1">
          {latest?.weightKg != null && (
            <Stat value={`${latest.weightKg}`} unit='ק״ג' label="משקל אחרון" />
          )}
          {growth.latestHeight?.heightCm != null && (
            <Stat value={`${growth.latestHeight.heightCm}`} unit='ס״מ' label="גובה אחרון" />
          )}
          {percentile && (
            <div className="mr-auto text-left">
              <p
                className="font-rubik font-black text-2xl leading-none"
                style={{ color: percentileColor(percentile.percentile) }}
              >
                P{percentile.percentile}
              </p>
              <p className="font-rubik text-brown-400 text-xs mt-0.5">אחוזון משקל</p>
            </div>
          )}
        </div>

        {percentile && (
          <p className="font-rubik text-brown-500 text-xs leading-relaxed mt-2.5">
            {percentile.desc} — כלומר מבין 100 תינוקות בגיל ובמין הזה, בערך {percentile.percentile} שוקלים פחות.
            <span className="text-brown-400"> מה שחשוב לרופא/ה הוא בדרך כלל שהעקומה ממשיכה באותו קו, לא המספר עצמו.</span>
          </p>
        )}

        {/* WHO curve */}
        {chartData.length > 0 && measured.length > 0 && (
          <div className="mt-4">
            <ResponsiveContainer width="100%" height={210}>
              <LineChart data={chartData} margin={{ top: 6, right: 8, left: -6, bottom: 14 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F5E6D3" />
                <XAxis
                  dataKey="age"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  tick={{ fontFamily: 'Rubik', fontSize: 10, fill: '#A87048' }}
                  tickLine={false}
                  axisLine={{ stroke: '#E8C9A8' }}
                  label={{ value: 'גיל (חודשים)', position: 'insideBottom', offset: -8, fontFamily: 'Rubik', fontSize: 10, fill: '#A87048' }}
                  height={30}
                />
                <YAxis
                  tick={{ fontFamily: 'Rubik', fontSize: 10, fill: '#A87048' }}
                  tickLine={false}
                  axisLine={false}
                  width={34}
                />
                <Tooltip
                  contentStyle={{ fontFamily: 'Rubik', fontSize: 12, borderRadius: 12, border: '1px solid #E8C9A8' }}
                  labelFormatter={v => `גיל: ${v} חודשים`}
                  formatter={(v, name) => {
                    if (v == null) return [null, name]
                    const labels = { kg: 'המדידה שלכם', p50: 'חציון WHO', p3: 'אחוזון 3', p97: 'אחוזון 97' }
                    return [`${Number(v).toFixed(1)} ק״ג`, labels[name] ?? name]
                  }}
                />
                <Line type="monotone" dataKey="p97" stroke="#E8C9A8" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                <Line type="monotone" dataKey="p50" stroke="#C9956C" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                <Line type="monotone" dataKey="p3"  stroke="#E8C9A8" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                <Line
                  type="monotone"
                  dataKey="kg"
                  stroke="#5BAD6F"
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: '#5BAD6F', strokeWidth: 0 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-center gap-4 mt-1">
              <LegendDot color="#5BAD6F" label="הילד/ה שלכם" />
              <LegendDot color="#C9956C" label="חציון WHO" dashed />
              <LegendDot color="#E8C9A8" label="אחוזון 3 / 97" dashed />
            </div>
          </div>
        )}

        <SourceNote text="עקומות: WHO Child Growth Standards" />
      </div>
    </Section>
  )
}

function percentileColor(p) {
  if (p < 3 || p > 97) return '#E05A4B'
  if (p < 15 || p > 85) return '#D9A441'
  return '#5BAD6F'
}

// ── Sleep vs AASM ────────────────────────────────────────────────────────────

function SleepSection({ sleep, ageMonths, windowDays }) {
  const band = sleepBandForAgeMonths(ageMonths)
  const avg = sleep.recentAvgHoursPerDay

  if (!sleep.hasData) {
    return (
      <Section icon={<Moon size={15} className="text-blue-500" />} title="שינה">
        <EmptyNote emoji="🌙" title="עוד אין שינה מתועדת" body="השתמשו בכפתור השינה במסך הבית כדי להתחיל לתעד תנומות." />
      </Section>
    )
  }

  return (
    <Section icon={<Moon size={15} className="text-blue-500" />} title="שינה">
      <div className="bg-white rounded-2xl border border-cream-200 px-4 py-4" style={CARD}>
        <div className="flex items-end gap-5 flex-wrap">
          <Stat value={avg ?? '—'} unit="שעות" label={`ממוצע ל-24 שעות (${windowDays} ימים)`} />
          {sleep.recentNapsPerDay != null && (
            <Stat value={sleep.recentNapsPerDay} unit="ביום" label="תנומות" />
          )}
          {sleep.longestMs && (
            <Stat value={(sleep.longestMs / 3600000).toFixed(1)} unit="שעות" label="הרצף הארוך ביותר" />
          )}
        </div>

        {/* Where the average sits relative to the published band. */}
        {band && avg != null ? (
          <>
            <RangeMeter value={avg} low={band.low} high={band.high} unit="שע׳" />
            <p className="font-rubik text-brown-500 text-xs leading-relaxed mt-3">
              ה-AASM ממליץ על <strong className="text-brown-700">{band.low}–{band.high} שעות ל-24 שעות כולל תנומות</strong> בגיל {band.label}.
              <span className="text-brown-400"> שימו לב: הממוצע כאן מבוסס רק על מה שתיעדתם — תנומות שלא נרשמו יורידו אותו.</span>
            </p>
            <SourceNote text="טווח: AASM 2016, באישור AAP" />
          </>
        ) : (
          <p className="font-rubik text-brown-500 text-xs leading-relaxed mt-3">
            {ageMonths != null && ageMonths < 4
              ? 'ה-AASM לא קבע טווח מומלץ לתינוקות מתחת לגיל 4 חודשים — טווח השינה התקין בגיל הזה רחב מאוד. לכן אנחנו מציגים רק את מה שתיעדתם, בלי השוואה.'
              : 'הוסיפו תאריך לידה בפרופיל הילד/ה כדי להשוות לטווח המומלץ לגיל.'}
          </p>
        )}
      </div>
    </Section>
  )
}

// ── Feeding ──────────────────────────────────────────────────────────────────

function FeedingSection({ feeding, windowDays }) {
  if (!feeding.count) {
    return (
      <Section icon={<Milk size={15} className="text-teal-600" />} title="האכלה">
        <EmptyNote emoji="🍼" title="עוד אין האכלות" body="כל האכלה שתתעדו תיכנס לחישוב הקצב." />
      </Section>
    )
  }

  const gapHours = feeding.typicalGapMs ? feeding.typicalGapMs / 3600000 : null

  return (
    <Section icon={<Milk size={15} className="text-teal-600" />} title="האכלה">
      <div className="bg-white rounded-2xl border border-cream-200 px-4 py-4" style={CARD}>
        <div className="flex items-end gap-5 flex-wrap">
          <Stat value={feeding.recentPerDay ?? '—'} unit="ביום" label={`ממוצע (${windowDays} ימים)`} />
          {feeding.recentMlPerDay != null && (
            <Stat value={feeding.recentMlPerDay} unit='מ״ל' label="ליום בממוצע" />
          )}
          {feeding.avgMlPerFeed != null && (
            <Stat value={feeding.avgMlPerFeed} unit='מ״ל' label="להאכלה" />
          )}
        </div>

        {gapHours != null && (
          <div className="mt-4 rounded-2xl bg-cream-50 border border-cream-200 px-4 py-3.5">
            <p className="font-rubik text-brown-700 text-sm font-bold mb-1">
              המרווח האופייני שלכם: {formatGap(gapHours)}
            </p>
            {feeding.nextEstimate && (
              <p className="font-rubik text-brown-600 text-sm">
                לפי הקצב הזה, ההאכלה הבאה בסביבות{' '}
                <strong className="text-brown-800">{format(feeding.nextEstimate, 'HH:mm')}</strong>
              </p>
            )}
            <p className="font-rubik text-brown-400 text-xs mt-2 leading-relaxed">
              זו חציון המרווחים מ-{feeding.sampleSize} האכלות אחרונות — תיאור של ההרגל שלכם, לא של מה שהתינוק/ת צריך/ה.
              תינוקות אוכלים לפי רעב, לא לפי שעון.
            </p>
          </div>
        )}

        <p className="font-rubik text-brown-400 text-xs mt-3 leading-relaxed">
          לא מוצג כאן טווח "תקין" לכמויות: הוא משתנה מאוד בין הנקה, תמ״ל, גיל ומעבר למוצקים,
          ומספר גורף היה מטעה יותר מאשר עוזר.
        </p>
      </div>
    </Section>
  )
}

function formatGap(hours) {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (h === 0) return `${m} דק׳`
  if (m === 0) return `${h} שעות`
  return `${h} שעות ו-${m} דק׳`
}

// ── Diapers ──────────────────────────────────────────────────────────────────

function DiaperSection({ diaper, ageMonths, windowDays }) {
  if (!diaper.count) return null

  const showMarker = ageMonths != null && ageMonths <= WET_DIAPER_RELEVANT_UNTIL_MONTHS
  const { wet, dirty, both } = diaper.breakdown

  return (
    <Section icon={<Droplets size={15} className="text-purple-500" />} title="חיתולים">
      <div className="bg-white rounded-2xl border border-cream-200 px-4 py-4" style={CARD}>
        <div className="flex items-end gap-5 flex-wrap">
          <Stat value={diaper.recentPerDay ?? '—'} unit="ביום" label={`ממוצע (${windowDays} ימים)`} />
          <Stat value={diaper.wetPerDay ?? '—'} unit="ביום" label="רטובים" />
        </div>

        <div className="flex gap-2 mt-3.5">
          {[
            { emoji: '🌊', label: 'שתן', n: wet },
            { emoji: '💩', label: 'צואה', n: dirty },
            { emoji: '✌️', label: 'שניהם', n: both },
          ].map(x => (
            <div key={x.label} className="flex-1 rounded-xl bg-cream-50 border border-cream-200 px-2 py-2 text-center">
              <p className="text-base leading-none">{x.emoji}</p>
              <p className="font-rubik font-bold text-brown-800 text-sm mt-1">{x.n}</p>
              <p className="font-rubik text-brown-400 text-[10px]">{x.label}</p>
            </div>
          ))}
        </div>

        {showMarker && (
          <>
            <p className="font-rubik text-brown-500 text-xs leading-relaxed mt-3.5">
              סמן ההידרציה המקובל הוא <strong className="text-brown-700">{WET_DIAPER_MIN_PER_DAY} חיתולים רטובים ביום ומעלה</strong> (מהיום החמישי).
              {diaper.wetPerDay != null && diaper.wetPerDay < WET_DIAPER_MIN_PER_DAY && (
                <span className="text-brown-400"> הממוצע שלכם נמוך מזה — לרוב זה פשוט אומר שלא כל החלפה נרשמת, אבל אם יש ספק זו שאלה טובה לרופא/ה.</span>
              )}
            </p>
            <SourceNote text="סמן: הנחיית AAP — כלי לבדיקה עצמית, לא מדד רפואי" />
          </>
        )}
      </div>
    </Section>
  )
}

// ── CDC milestones ───────────────────────────────────────────────────────────

function MilestonesSection({ child, ageMonths }) {
  const { current, next } = milestoneBandsForAgeMonths(ageMonths)

  if (!child.birth_date) {
    return (
      <Section icon={<BookOpen size={15} className="text-amber-600" />} title="מה הלאה">
        <EmptyNote
          emoji="🗓️"
          title="נדרש תאריך לידה"
          body="הוסיפו תאריך לידה בפרופיל הילד/ה כדי לראות את שלב ההתפתחות הרלוונטי."
        />
      </Section>
    )
  }

  const band = next ?? current
  if (!band) return null

  return (
    <Section icon={<BookOpen size={15} className="text-amber-600" />} title="מה הלאה">
      <div className="bg-white rounded-2xl border border-cream-200 px-4 py-4" style={CARD}>
        <p className="font-rubik font-bold text-brown-800 text-sm">
          {next ? `לקראת גיל ${band.age} חודשים` : `רשימת גיל ${band.age} חודשים`}
        </p>
        <p className="font-rubik text-brown-400 text-xs mt-1 leading-relaxed">
          אלה דוגמאות מתוך רשימת ה-CDC לגיל הזה. הרשימה כוללת מה ש<strong className="text-brown-600">75% מהילדים ומעלה</strong> כבר עושים —
          כך שפער אחד לא אומר בהכרח כלום.
        </p>

        <ul className="space-y-2 mt-3.5">
          {band.items.map(item => (
            <li key={item.text} className="flex items-start gap-2.5">
              <span
                className="font-rubik text-[10px] font-bold px-2 py-0.5 rounded-md bg-cream-100 text-brown-500 border border-cream-200 flex-shrink-0 mt-px"
              >
                {item.domain}
              </span>
              <span className="font-rubik text-brown-700 text-sm leading-snug">{item.text}</span>
            </li>
          ))}
        </ul>

        <div className="mt-3.5 flex items-start gap-2 rounded-2xl bg-amber-50 border border-amber-100 px-3 py-2.5">
          <Info size={13} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="font-rubik text-amber-800 text-xs leading-relaxed">
            האפליקציה לא מתעדת אבני דרך, ולכן זו רשימה כללית לגיל — לא הערכה של {child.name}.
          </p>
        </div>

        <a
          href="https://www.cdc.gov/act-early/milestones/index.html"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 mt-3 font-rubik text-brown-600 text-xs font-semibold active:opacity-60"
        >
          <ExternalLink size={12} />
          הרשימה המלאה באתר ה-CDC
        </a>
      </div>
    </Section>
  )
}

// ── Sources + disclaimer ─────────────────────────────────────────────────────

function SourcesSection() {
  return (
    <div className="rounded-3xl border border-cream-200 bg-cream-50 px-4 py-4" style={CARD}>
      <div className="flex items-center gap-2 mb-3">
        <Baby size={13} className="text-brown-400" />
        <p className="font-rubik font-bold text-brown-400 text-xs uppercase tracking-widest">מקורות</p>
      </div>

      <div className="space-y-2.5">
        {SOURCES.map(s => (
          <a
            key={s.id}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-2xl bg-white border border-cream-200 px-3.5 py-3 active:scale-[0.99] transition-transform"
          >
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-rubik font-bold text-brown-700 text-xs leading-tight">{s.title}</p>
                <p className="font-rubik text-brown-400 text-[11px] leading-relaxed mt-1">{s.detail}</p>
              </div>
              <ExternalLink size={12} className="text-brown-300 flex-shrink-0 mt-0.5" />
            </div>
          </a>
        ))}
      </div>

      <p className="font-rubik text-brown-500 text-[11px] leading-relaxed mt-4 pt-3.5 border-t border-cream-200">
        {MEDICAL_DISCLAIMER}
      </p>
    </div>
  )
}

// ── Shared bits ──────────────────────────────────────────────────────────────

function Section({ icon, title, children }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5 px-1">
        {icon}
        <p className="font-rubik font-bold text-brown-400 text-xs uppercase tracking-widest">{title}</p>
      </div>
      {children}
    </div>
  )
}

function Stat({ value, unit, label }) {
  return (
    <div>
      <p className="font-rubik font-black text-brown-800 text-2xl leading-none">
        {value}
        {unit && <span className="font-rubik font-medium text-brown-400 text-sm mr-1">{unit}</span>}
      </p>
      <p className="font-rubik text-brown-400 text-xs mt-1">{label}</p>
    </div>
  )
}

// Horizontal meter showing where a value sits against a recommended range.
//
// Rendered dir="ltr" on purpose. A magnitude axis reads low→high left-to-right
// even in an RTL layout (same as every growth chart in the app), and mixing the
// two put the scale's minimum on the right while its label said maximum.
//
// Deliberately not a pass/fail: the band is shaded, the marker just sits on the
// axis, and being outside it is styled as "worth a look", never as a failure.
function RangeMeter({ value, low, high, unit }) {
  const min = Math.floor(Math.min(low - 3, value - 1))
  const max = Math.ceil(Math.max(high + 3, value + 1))
  const clamp = n => Math.max(0, Math.min(100, n))
  const pct = v => clamp(((v - min) / (max - min)) * 100)
  const inBand = value >= low && value <= high
  const markerColor = inBand ? '#5BAD6F' : '#D9A441'

  return (
    <div className="mt-4" dir="ltr">
      <div className="relative h-9">
        {/* Track */}
        <div className="absolute inset-x-0 top-4 h-2 rounded-full bg-cream-100 border border-cream-200" />
        {/* Recommended band */}
        <div
          className="absolute top-4 h-2 rounded-full"
          style={{
            left: `${pct(low)}%`,
            width: `${pct(high) - pct(low)}%`,
            backgroundColor: '#8FC79E',
          }}
        />
        {/* Marker */}
        <div
          className="absolute top-0 flex flex-col items-center -translate-x-1/2"
          style={{ left: `${pct(value)}%` }}
        >
          <span
            className="font-rubik font-bold text-[10px] px-1.5 py-0.5 rounded-md text-white whitespace-nowrap"
            style={{ backgroundColor: markerColor }}
          >
            {value}
          </span>
          <span className="w-0.5 h-3 rounded-full" style={{ backgroundColor: markerColor }} />
        </div>
      </div>
      <div className="flex justify-between font-rubik text-[10px] text-brown-400 px-0.5">
        <span>{min}</span>
        <span className="text-green-700 font-semibold" dir="rtl">
          {low}–{high} {unit} מומלץ
        </span>
        <span>{max}</span>
      </div>
    </div>
  )
}

function LegendDot({ color, label, dashed }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="w-4 h-0.5 rounded-full"
        style={{
          backgroundColor: dashed ? 'transparent' : color,
          borderTop: dashed ? `2px dashed ${color}` : undefined,
        }}
      />
      <span className="font-rubik text-brown-400 text-[10px]">{label}</span>
    </span>
  )
}

function SourceNote({ text }) {
  return (
    <p className="font-rubik text-brown-300 text-[10px] mt-3 pt-2.5 border-t border-cream-100">
      {text}
    </p>
  )
}

function EmptyNote({ emoji, title, body }) {
  return (
    <div
      className="bg-white rounded-2xl border border-cream-200 px-5 py-7 flex flex-col items-center text-center"
      style={CARD}
    >
      <span className="text-3xl mb-2.5">{emoji}</span>
      <p className="font-rubik font-bold text-brown-700 text-sm">{title}</p>
      <p className="font-rubik text-brown-400 text-xs mt-1 leading-relaxed max-w-[16rem]">{body}</p>
    </div>
  )
}
