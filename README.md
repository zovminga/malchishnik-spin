# МАЛЬЧИШНИК — рулетка

Казино-рулетка для мальчишника: колесо мест, задания, общие очки.

**Сайт:** https://zovminga.github.io/malchishnik-spin/

Синк уже вшит — кидаешь друзьям ту же ссылку, у всех одна рулетка и одна таблица.

1. Открой сайт  
2. **«Скопировать ссылку»** → в чат  
3. **«★ Места и задания ★»** — правишь список  
4. **«Очистить баллы»** / **«Перезапустить игру»** внизу — сброс очков или полный перезапуск без игроков (места остаются)

## Локально

Весь продукт — один файл [`index.html`](./index.html).

```bash
python3 -m http.server 8765
```

Открой http://127.0.0.1:8765/

## QA (Playwright)

Одна команда, macOS или Linux:

```bash
npm install
npm run qa
```

- Проверяется рабочая копия на локальном сервере `http://127.0.0.1:8765/`. Если сервер не запущен, `npm run qa` сам поднимет `python3 -m http.server` и погасит его в конце.
- Браузер: установленный Google Chrome (macOS — `/Applications/Google Chrome.app`, Linux — `/usr/bin/google-chrome-stable`), путь можно задать через `CHROME=...`. Если Chrome нет — один раз `npx playwright install chromium`.
- В конце печатается сводка `PASS | FAIL` по каждому скрипту; код выхода 0 только если все зелёные.
- Отдельно: `npm run test:wipe` (новый браузер не затирает очки, `LOOP GREEN`), `npm run test:qa` (остальные сценарии).
- Проверить live GitHub Pages вместо рабочей копии: `QA_URL=https://zovminga.github.io/malchishnik-spin/ npm run qa`.
- Скриншоты и отчёты — в `qa-artifacts/<скрипт>/` (в git не попадают), или в `QA_OUT`.

### Тестовые Room в Firebase

QA пишет только в изолированные Room с id `qa-…` (`review-…` — ручные проверки); Room вечеринки без `?room=` тесты не трогают — `qa-lib` откажется открыть другой id. Правила Firebase не дают получить список всех Room, поэтому каждый id, созданный тестами на этой машине, записывается в `qa-artifacts/rooms.txt`.

```bash
npm run qa:rooms                 # сколько тестовых Room записано
npm run qa:rooms -- --delete     # удалить их из Firebase (необратимо) и очистить список
```

Room, созданные раньше этого списка или на другой машине, отсюда не видны — их можно удалить в консоли Firebase (Realtime Database → Data → `rooms`).
