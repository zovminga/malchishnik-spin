# 07: `#room=` link can move a phone to another Firebase for good

**Status:** needs-triage

**Type:** note (not scheduled)

`tryBootFromHash` (index.html) accepts `#room=<base64>` with a `sync.config`, connects to that Firebase and stores the config in localStorage (`malchishnik-sync-v1`); `tryBootSavedSync` then prefers the saved config on every later visit. A crafted link therefore moves a phone to a different database permanently, and it plays alone without any sign. Found by reading the code, not reproduced. The hidden connect / disconnect controls and `firebaseConfigInput` / `roomInput` are leftovers of the same flow.

Decide whether any old share links still rely on it before removing; do not delete silently.
