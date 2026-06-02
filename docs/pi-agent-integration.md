# Pi Agent Integration

This repository vendors the upstream `pi` source tree under [third_party/pi](C:/Users/Administrator/Documents/Codex/desktop-pet/third_party/pi).

Current integration status:

- The Electron app exposes a `/agent ...` chat command.
- `/agent` routes through [pi-agent-service.js](C:/Users/Administrator/Documents/Codex/desktop-pet/pi-agent-service.js).
- In development, the bridge loads the vendored Pi SDK from `third_party/pi/packages/coding-agent/dist/index.js`.
- In packaged builds, the Pi runtime is copied to `resources/pi` via `electron-builder.extraResources` and loaded from there.
- The bridge reuses the app's active OpenAI-compatible API configuration as the Pi model backend.
- The packaged Windows build must include the vendored Pi runtime as an external resource under `resources/pi`.

Execution model:

- Pi runs inside the Electron main process through the SDK, not by shelling out to an external CLI window.
- Built-in agent tools enabled for `/agent` are `read`, `bash`, `edit`, `write`, `find`, `grep`, and `ls`.
- Recent chat turns are folded into the `/agent` prompt as lightweight transcript context.

Validation completed in this environment:

- `third_party/pi` dependencies installed successfully.
- `third_party/pi` built successfully.
- A Pi SDK self-test ran successfully with the built-in faux provider.
- The desktop app test suite passed.
- The Windows unpacked build launched successfully and stayed alive during smoke testing.

Remaining functional prerequisite:

- A real `/agent` conversation still requires an active API configuration in the app settings.
- On this machine there was no active API config present, so live remote-model agent output was not exercised end-to-end.
