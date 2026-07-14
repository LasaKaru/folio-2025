// Circuit City — cosmetic store backend (Stripe Checkout scaffold)
//
// Companion to server/index.js (the multiplayer relay): a separate, small
// HTTP service that turns the `premium: true` entries in
// sources/data/upgrades.js into real Stripe Checkout purchases, and grants
// them back to whichever browser paid. Cosmetic-only, on purpose --
// nothing sold here changes truck stats, weapon damage or fire rate, see
// server/STORE.md.
//
// Needs your own Stripe account: set STRIPE_SECRET_KEY and
// STRIPE_WEBHOOK_SECRET before this does anything real. Without them it
// still starts (so the rest of the game keeps working), it just answers
// checkout requests with 503 instead of crashing.
//
// Usage:
//   npm install
//   STRIPE_SECRET_KEY=sk_test_... STRIPE_WEBHOOK_SECRET=whsec_... node server/store.js
//   # then in .env: VITE_STORE_URL=http://localhost:8081
//
// See server/STORE.md for the full setup (Stripe CLI, webhook forwarding,
// going live).
import http from 'node:http'
import { readFileSync, writeFileSync } from 'node:fs'
import Stripe from 'stripe'
import { truckPaints, heroOutfits, weaponSkins } from '../sources/data/upgrades.js'

const port = process.env.STORE_PORT ? parseInt(process.env.STORE_PORT) : 8081
const successUrl = process.env.STORE_SUCCESS_URL ?? 'http://localhost:5173/?purchase=success'
const cancelUrl = process.env.STORE_CANCEL_URL ?? 'http://localhost:5173/?purchase=cancelled'
const grantsFile = new URL('./store-grants.json', import.meta.url)

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null

const catalog = { paint: truckPaints, outfit: heroOutfits, skin: weaponSkins }

const findItem = (kind, key) =>
{
    const definition = catalog[kind]?.[key]
    return definition?.premium ? definition : null
}

const loadGrants = () =>
{
    try { return JSON.parse(readFileSync(grantsFile, 'utf-8')) }
    catch { return {} }
}

const saveGrants = (grants) => writeFileSync(grantsFile, JSON.stringify(grants, null, 2))

const grant = (playerId, kind, key) =>
{
    const grants = loadGrants()
    grants[playerId] = grants[playerId] ?? []
    const sku = `${kind}:${key}`

    if(!grants[playerId].includes(sku))
        grants[playerId].push(sku)

    saveGrants(grants)
}

const cors = (res) =>
{
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Stripe-Signature')
}

const json = (res, status, body) =>
{
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(body))
}

const readBody = async (req) =>
{
    let body = ''
    for await (const chunk of req)
        body += chunk
    return body
}

const readRawBody = async (req) =>
{
    let body = Buffer.alloc(0)
    for await (const chunk of req)
        body = Buffer.concat([ body, chunk ])
    return body
}

const server = http.createServer(async (req, res) =>
{
    cors(res)

    if(req.method === 'OPTIONS')
    {
        res.writeHead(204)
        res.end()
        return
    }

    const url = new URL(req.url, `http://${req.headers.host}`)

    // Creates a Stripe Checkout session for one premium cosmetic. The
    // client redirects the browser to the returned url; Stripe redirects
    // back to successUrl/cancelUrl when done.
    if(req.method === 'POST' && url.pathname === '/api/checkout')
    {
        if(!stripe)
            return json(res, 503, { error: 'Store not configured (missing STRIPE_SECRET_KEY)' })

        let payload
        try { payload = JSON.parse(await readBody(req)) }
        catch { return json(res, 400, { error: 'Invalid request body' }) }

        const { playerId, kind, key } = payload
        const item = findItem(kind, key)

        if(!playerId || !item)
            return json(res, 400, { error: 'Unknown item' })

        try
        {
            const session = await stripe.checkout.sessions.create({
                mode: 'payment',
                line_items: [ {
                    price_data: {
                        currency: 'usd',
                        product_data: { name: `Circuit City — ${item.name}` },
                        unit_amount: item.priceCents,
                    },
                    quantity: 1,
                } ],
                success_url: successUrl,
                cancel_url: cancelUrl,
                client_reference_id: playerId,
                metadata: { playerId, kind, key },
            })

            return json(res, 200, { url: session.url })
        }
        catch(error)
        {
            return json(res, 502, { error: `Stripe error: ${error.message}` })
        }
    }

    // Stripe calls this directly (not the browser) once payment succeeds.
    // This is the source of truth for grants -- the client polling
    // /api/entitlements after redirect is just so the UI updates promptly,
    // it never grants anything itself.
    if(req.method === 'POST' && url.pathname === '/api/webhook')
    {
        if(!stripe || !process.env.STRIPE_WEBHOOK_SECRET)
            return json(res, 503, { error: 'Webhook not configured' })

        const rawBody = await readRawBody(req)
        let event

        try
        {
            event = stripe.webhooks.constructEvent(rawBody, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET)
        }
        catch(error)
        {
            return json(res, 400, { error: `Webhook signature check failed: ${error.message}` })
        }

        if(event.type === 'checkout.session.completed')
        {
            const { playerId, kind, key } = event.data.object.metadata ?? {}
            if(playerId && findItem(kind, key))
                grant(playerId, kind, key)
        }

        return json(res, 200, { received: true })
    }

    if(req.method === 'GET' && url.pathname.startsWith('/api/entitlements/'))
    {
        const playerId = decodeURIComponent(url.pathname.slice('/api/entitlements/'.length))
        const grants = loadGrants()
        return json(res, 200, { items: grants[playerId] ?? [] })
    }

    json(res, 404, { error: 'Not found' })
})

server.listen(port, () =>
{
    console.log(`Circuit City store listening on http://localhost:${port}`)

    if(!stripe)
        console.warn('STRIPE_SECRET_KEY not set -- /api/checkout will return 503 until configured.')
    else if(!process.env.STRIPE_WEBHOOK_SECRET)
        console.warn('STRIPE_WEBHOOK_SECRET not set -- /api/webhook will return 503 until configured.')
})
