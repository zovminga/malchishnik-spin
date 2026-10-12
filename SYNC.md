# Общая рулетка на всех (Firebase)

Чтобы **все друзья правили одни и те же места, задания и очки** на сайте, нужна общая «комната» в Firebase (бесплатно).

## Один раз настраивает хост (2–3 минуты)

1. Открой [https://console.firebase.google.com](https://console.firebase.google.com) → Create project (Google-аналитику можно выключить).
2. Build → **Realtime Database** → Create Database → Start in **test mode**.
3. Project settings (шестерёнка) → Your apps → **Web** (`</>`) → зарегистрируй app → скопируй `firebaseConfig`.
4. Realtime Database → **Rules** → поставь на время мальчишника:

```json
{
  "rules": {
    "rooms": {
      "$room": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

Publish.

5. На сайте рулетки открой **«Список / синк»** → вставь конфиг → room например `malchishnik` → **Подключить**.
6. Нажми **«Ссылка для друзей»** — кинь её в чат. По этой ссылке у всех тот же синк.

## Важно

- Без синка сайт работает локально (у каждого свой список).
- С синком — одна рулетка и одна таблица на всех.
- После праздника в Rules лучше закрыть запись.
