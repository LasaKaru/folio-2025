// No privileged APIs are exposed to the game -- it's a plain web app that
// only needs the standard browser surface (WebGPU/WebGL, WebSocket for
// multiplayer, localStorage for saves), all of which Electron's renderer
// already provides without any preload bridge.
