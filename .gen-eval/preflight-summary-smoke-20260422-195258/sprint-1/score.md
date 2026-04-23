---
run_id: "preflight-summary-smoke-20260422-195258"
artifact: "score"
sprint: 1
evaluation_mode: "static-fallback"
verdict: "FAIL"
created_at: "2026-04-22T19:52:58.423Z"
updated_at: "2026-04-22T19:52:58.423Z"
---

# Sprint 1 Score

## Verdict summary
FAIL

## Criteria table
| Criterion ID | Dimension | Score | Threshold | Status | Evidence |
|--------------|-----------|-------|-----------|--------|----------|
| criterion-1 | Design Quality | 0 | 7 | UNVERIFIED | None |
| criterion-2 | Functionality | 0 | 7 | UNVERIFIED | None |

## Blocking findings
- Infrastructure failure: browserType.launch: spawn EPERM
Call log:
[2m  - <launching> C:\Users\eriks\AppData\Local\ms-playwright\chromium_headless_shell-1217\chrome-headless-shell-win64\chrome-headless-shell.exe --disable-field-trial-config --disable-background-networking --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-back-forward-cache --disable-breakpad --disable-client-side-phishing-detection --disable-component-extensions-with-background-pages --disable-component-update --no-default-browser-check --disable-default-apps --disable-dev-shm-usage --disable-extensions --disable-features=AvoidUnnecessaryBeforeUnloadCheckSync,BoundaryEventDispatchTracksNodeRemoval,DestroyProfileOnBrowserClose,DialMediaRouteProvider,GlobalMediaControls,HttpsUpgrades,LensOverlay,MediaRouter,PaintHolding,ThirdPartyStoragePartitioning,Translate,AutoDeElevate,RenderDocument,OptimizationHints --enable-features=CDPScreenshotNewSurface --allow-pre-commit-input --disable-hang-monitor --disable-ipc-flooding-protection --disable-popup-blocking --disable-prompt-on-repost --disable-renderer-backgrounding --force-color-profile=srgb --metrics-recording-only --no-first-run --password-store=basic --use-mock-keychain --no-service-autorun --export-tagged-pdf --disable-search-engine-choice-screen --unsafely-disable-devtools-self-xss-warnings --edge-skip-compat-layer-relaunch --enable-automation --disable-infobars --disable-search-engine-choice-screen --disable-sync --enable-unsafe-swiftshader --headless --hide-scrollbars --mute-audio --blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4 --no-sandbox --user-data-dir=C:\Users\eriks\AppData\Local\Temp\playwright_chromiumdev_profile-uBwMsy --remote-debugging-pipe --no-startup-window[22m

- Criterion criterion-1 remained unverified.
- Criterion criterion-2 remained unverified.

## Non-blocking observations
- None

## Unverified claims
- No live evidence confirmed criterion-1.
- No live evidence confirmed criterion-2.
