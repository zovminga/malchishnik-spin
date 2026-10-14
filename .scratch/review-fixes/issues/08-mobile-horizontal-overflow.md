# 08: Page is wider than a phone screen

**Status:** needs-triage

**Type:** note (not scheduled)

At a 390 px viewport `document.documentElement.scrollWidth` is 417 (411 with mobile emulation), so the page scrolls sideways. Likely the full-width ticker (`width: 100vw`) or the wheel burst rays. Seen while checking a click target during P3; layout work was out of scope.
