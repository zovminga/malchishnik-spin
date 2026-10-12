export type Destination = {
  id: string
  label: string
  tagline: string
  color: string
  text: string
}

export const DESTINATIONS: Destination[] = [
  {
    id: 'casino',
    label: 'КАЗИНО',
    tagline: 'Фишки, свет, чужая удача. Ставим на зеро и на друга.',
    color: '#c41e3a',
    text: '#fff8e7',
  },
  {
    id: 'bar',
    label: 'БАР',
    tagline: 'Шоты, тосты и ни одного трезвого решения.',
    color: '#1a6bff',
    text: '#f0f7ff',
  },
  {
    id: 'strip',
    label: 'СТРИПУХА',
    tagline: 'Неон, дым и легенды, которые лучше не вспоминать утром.',
    color: '#ff2d6a',
    text: '#fff0f5',
  },
  {
    id: 'kc',
    label: 'KC GRAD',
    tagline: 'Культовый маршрут. Если выпало — значит судьба.',
    color: '#00c853',
    text: '#04150a',
  },
  {
    id: 'comps',
    label: 'КОМПЫ',
    tagline: 'Интернет-клуб, реванш и «ещё одну катку».',
    color: '#ff9f1a',
    text: '#1a0d00',
  },
]
