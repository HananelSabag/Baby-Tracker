import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useToast } from '../hooks/useToast'

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('adds a toast to the list when showToast is called', () => {
    const { result } = renderHook(() => useToast())

    act(() => {
      result.current.showToast({ message: 'האכלה נוספה', emoji: '🍼' })
    })

    expect(result.current.toasts).toHaveLength(1)
    expect(result.current.toasts[0].message).toBe('האכלה נוספה')
    expect(result.current.toasts[0].emoji).toBe('🍼')
  })

  it('removes a toast automatically after 4 seconds', () => {
    const { result } = renderHook(() => useToast())

    act(() => {
      result.current.showToast({ message: 'חיתול הוחלף', emoji: '👶' })
    })

    expect(result.current.toasts).toHaveLength(1)

    // Advance the fake clock by 4 seconds — the auto-dismiss setTimeout fires
    act(() => {
      vi.advanceTimersByTime(4000)
    })

    expect(result.current.toasts).toHaveLength(0)
  })

  it('dismissToast removes only the specific toast by id', () => {
    const { result } = renderHook(() => useToast())

    act(() => {
      result.current.showToast({ message: 'ראשון', emoji: '1️⃣' })
    })
    // Advance 1ms so the second toast gets a different Date.now() id
    act(() => {
      vi.advanceTimersByTime(1)
      result.current.showToast({ message: 'שני', emoji: '2️⃣' })
    })

    expect(result.current.toasts).toHaveLength(2)

    const firstId = result.current.toasts[0].id

    act(() => {
      result.current.dismissToast(firstId)
    })

    expect(result.current.toasts).toHaveLength(1)
    expect(result.current.toasts[0].message).toBe('שני')
  })
})
