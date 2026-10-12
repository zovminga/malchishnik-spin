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
    tagline: 'Стол, фишки, минус депозит.',
    color: '#ff003c',
    text: '#fff8e7',
  },
  {
    id: 'bar',
    label: 'БАР',
    tagline: 'Шоты по кругу. Без обсуждений.',
    color: '#1a6bff',
    text: '#f0f7ff',
  },
  {
    id: 'strip',
    label: 'СТРИПУХА',
    tagline: 'Неон, дым, нулевая память.',
    color: '#ff1493',
    text: '#fff0f5',
  },
  {
    id: 'kc',
    label: 'KC GRAD',
    tagline: 'Выпало — едем. Точка.',
    color: '#b8ff00',
    text: '#04150a',
  },
  {
    id: 'comps',
    label: 'КОМПЫ',
    tagline: 'Интернет-клуб. Реванш обязателен.',
    color: '#ff9f1a',
    text: '#1a0d00',
  },
]
