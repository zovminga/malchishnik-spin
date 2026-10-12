import { useState } from 'react'
import { Roulette } from './components/Roulette'
import type { Destination } from './destinations'

export default function App() {
  const [result, setResult] = useState<Destination | null>(null)
  const [spinning, setSpinning] = useState(false)
  const [history, setHistory] = useState<Destination[]>([])
  const [flash, setFlash] = useState(false)

  const handleResult = (destination: Destination) => {
    setResult(destination)
    setHistory((prev) => [destination, ...prev].slice(0, 8))
    setFlash(true)
    window.setTimeout(() => setFlash(false), 900)
  }

  return (
    <div className={`page${flash ? ' page--flash' : ''}`}>
      <div className="felt" aria-hidden="true" />
      <div className="neon-grid" aria-hidden="true" />

      <main className="hero">
        <p className="brand">МАЛЬЧИШНИК</p>
        <h1>Куда идём дальше?</h1>
        <p className="lede">
          Крути рулетку — она решит маршрут. Спорить поздно.
        </p>

        <Roulette
          onResult={handleResult}
          spinning={spinning}
          setSpinning={setSpinning}
        />

        <div
          className={`result${result && !spinning ? ' result--show' : ''}`}
          aria-live="polite"
        >
          {result && !spinning ? (
            <>
              <p className="result-kicker">ВЫПАЛО</p>
              <p className="result-label" style={{ color: result.color }}>
                {result.label}
              </p>
              <p className="result-tagline">{result.tagline}</p>
            </>
          ) : (
            <p className="result-placeholder">
              {spinning ? 'Шарик ищет приключение…' : 'Жми кнопку — судьба решит.'}
            </p>
          )}
        </div>
      </main>

      {history.length > 0 && (
        <section className="history" aria-label="История спинов">
          <h2>Уже выпадало</h2>
          <ol>
            {history.map((item, i) => (
              <li key={`${item.id}-${i}`}>
                <span className="dot" style={{ background: item.color }} />
                {item.label}
              </li>
            ))}
          </ol>
        </section>
      )}

      <footer className="footer">
        <p>Только для своих. Ответственность за маршрут — на рулетке.</p>
      </footer>
    </div>
  )
}
