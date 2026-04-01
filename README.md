# xCloud Deck

MVP Decky plugin fork for exploring a controller-first Xbox xHome/xCloud experience on Steam Deck.

## Current MVP

- Manual config storage in Decky backend
- Manual auth/token entry
- xHome console discovery
- Start a saved xHome/xCloud stream target
- In-route WebRTC player surface
- Browser Gamepad API controller input
- Basic keepalive + stream stats text

## Current limitations

- Auth is still manual; this does **not** yet implement a full Junkstore-style login launcher flow
- Home streaming may require a valid MSAL user token in addition to streaming token/host
- Stream route is an MVP view, not polished full-screen game-mode UX yet
- No touch/mouse/keyboard mapping UI yet
- No robust reconnect/retry/error handling yet

## References used

- `xbox-xcloud-player`
- `greenlight`
- `junkstore`

## Development

```bash
pnpm install
pnpm build
```
