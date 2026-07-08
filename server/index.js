// Neon Havoc — reference multiplayer relay
//
// A minimal WebSocket broadcast relay for the client's multiplayer feature
// (sources/Game/Multiplayer.js). It does not understand or persist game
// state — it just re-broadcasts every message it receives to every other
// connected client, msgpack-encoded, exactly as the client sends it.
//
// This is a starting point, not a production backend: no auth, no rate
// limiting, no persistence. Good enough for a LAN party or a small private
// deploy behind a reverse proxy; harden it before exposing it publicly.
//
// Usage:
//   npm install ws
//   node server/index.js
//   # then in .env: VITE_SERVER_URL=ws://your-host:8080
import { WebSocketServer } from 'ws'
import msgpack from 'msgpack-lite'

const port = process.env.PORT ? parseInt(process.env.PORT) : 8080
const wss = new WebSocketServer({ port })

const clients = new Map() // ws -> uuid

const broadcast = (raw, exceptSocket) =>
{
    for(const client of clients.keys())
    {
        if(client !== exceptSocket && client.readyState === client.OPEN)
            client.send(raw)
    }
}

wss.on('connection', (ws) =>
{
    ws.on('message', (raw) =>
    {
        let data

        try
        {
            data = msgpack.decode(new Uint8Array(raw))
        }
        catch
        {
            return
        }

        if(data?.uuid)
            clients.set(ws, data.uuid)

        broadcast(raw, ws)
    })

    ws.on('close', () =>
    {
        const uuid = clients.get(ws)
        clients.delete(ws)

        if(uuid)
            broadcast(msgpack.encode({ type: 'mpLeave', uuid }), ws)
    })
})

console.log(`Neon Havoc relay listening on ws://localhost:${port}`)
