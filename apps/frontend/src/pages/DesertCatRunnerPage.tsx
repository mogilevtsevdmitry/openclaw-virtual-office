import { useEffect, useRef, useState } from 'react'

interface LeaderboardEntry {
  score: number
  date: string
}

const LB_KEY = 'desertCatRunner_lb'

function loadLeaderboard(): LeaderboardEntry[] {
  try {
    return JSON.parse(localStorage.getItem(LB_KEY) || '[]')
  } catch {
    return []
  }
}

export function DesertCatRunnerPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [scores, setScores] = useState<LeaderboardEntry[]>([])
  const [showLb, setShowLb] = useState(false)

  // Sync leaderboard from localStorage (game updates it directly)
  useEffect(() => {
    const sync = () => setScores(loadLeaderboard())
    sync()
    const interval = setInterval(sync, 2000)
    window.addEventListener('storage', sync)
    return () => {
      clearInterval(interval)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const best = scores.length > 0 ? scores[0].score : 0

  return (
    <div className="flex flex-col h-full bg-[#1a0a00] relative">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-black/60 border-b border-amber-800/40 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🐱</span>
          <div>
            <h1 className="text-amber-300 font-bold text-lg leading-none">Desert Cat Runner</h1>
            <p className="text-amber-600 text-xs">3D браузерная игра</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {best > 0 && (
            <div className="text-amber-400 text-sm font-semibold">
              🏆 Рекорд: {best.toLocaleString()}
            </div>
          )}
          <button
            onClick={() => setShowLb(v => !v)}
            className="px-3 py-1 rounded-lg bg-amber-900/40 border border-amber-700/50 text-amber-300 text-sm hover:bg-amber-800/50 transition-colors"
          >
            {showLb ? '🎮 Игра' : '🏆 Рейтинг'}
          </button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Game iframe */}
        <iframe
          ref={iframeRef}
          src="/desert-cat-runner/index.html"
          className="w-full h-full border-0"
          title="Desert Cat Runner"
          allow="autoplay"
          style={{ display: showLb ? 'none' : 'block' }}
        />

        {/* Leaderboard panel */}
        {showLb && (
          <div className="w-full h-full flex items-center justify-center bg-[#1a0a00]">
            <div className="bg-black/70 border border-amber-700/40 rounded-2xl p-8 min-w-[320px] max-w-md w-full mx-4">
              <h2 className="text-amber-300 text-2xl font-bold mb-6 text-center">
                🏆 Таблица рекордов
              </h2>
              {scores.length === 0 ? (
                <p className="text-amber-600 text-center py-8">Пока нет рекордов.<br />Сыграй первую партию!</p>
              ) : (
                <ol className="space-y-3">
                  {scores.slice(0, 10).map((entry, i) => (
                    <li
                      key={i}
                      className={`flex items-center justify-between px-4 py-3 rounded-xl ${
                        i === 0
                          ? 'bg-amber-900/50 border border-amber-500/50'
                          : 'bg-black/30 border border-amber-900/30'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-amber-500">
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                        </span>
                        <span className={`font-mono font-bold text-lg ${i === 0 ? 'text-amber-300' : 'text-amber-500'}`}>
                          {entry.score.toLocaleString()}
                        </span>
                      </div>
                      <span className="text-amber-700 text-sm">{entry.date}</span>
                    </li>
                  ))}
                </ol>
              )}
              <button
                onClick={() => setShowLb(false)}
                className="mt-6 w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-black font-bold text-lg transition-colors"
              >
                ▶ Играть
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
