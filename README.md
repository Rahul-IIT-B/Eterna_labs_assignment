# Real-time Meme Coin Aggregator

Single service that fetches trending pairs from DexScreener and Jupiter, deduplicates by token address, caches them in Redis for 30s, and exposes both REST + Socket.IO updates (initial snapshot + incremental refresh pushes).

## Run It

```bash
cp .env.example .env
npm install
npm run dev
```

Redis must be reachable at `REDIS_URL` (defaults to `redis://localhost:6379`). Use `npm run build && npm start` for production.

## Interfaces

- REST
  - `GET /health`
  - `GET /tokens?limit=20&cursor=...&sortBy=volume|priceChange|marketCap&sortDir=asc|desc&period=1h|24h|7d`
  - `GET /tokens/:address`
- WebSocket
  - `initial_snapshot` on connect
  - `token_update` after each refresh

## Design Notes

- Axios + axios-retry handles upstream rate limits with exponential backoff.
- Aggregated tokens are stored both in Redis (key `token:{address}` + sorted sets for metrics) and in-memory for quick lookups.
- Refresh loop runs on `node-cron`, and the same aggregator emits `snapshot` events that Socket.IO relays to connected clients.


## Powershell Commands
 - Health
   ```bash
   Invoke-RestMethod 'http://localhost:4000/health'
   ```
 - List Tokens
    ```bash
   Invoke-RestMethod 'http://localhost:4000/tokens?limit=10&sortBy=volume&sortDir=desc&period=24h' | ConvertTo-Json -Depth 4
    ```
 - Get Token Details
    ```bash
    $r = Invoke-RestMethod 'http://localhost:4000/tokens?limit=1'
    $addr = $r.items[0].address
    Invoke-RestMethod "http://localhost:4000/tokens/$([System.Uri]::EscapeDataString($addr))" | ConvertTo-Json -Depth 5
    ```
 - Benchmark List Tokens
    ```bash
   Measure-Command { 1..10 | ForEach-Object { Invoke-RestMethod 'http://localhost:4000/tokens?limit=20' > $null } }
    ```
 - Redis
    ```bash
   docker exec -it test-redis redis-cli --raw KEYS 'token:*'
   docker exec -it test-redis redis-cli GET 'token:DTF6900'
    ```

## Create connection in browser devtools console
```bash
const sScript = document.createElement('script');
sScript.src = 'https://cdn.socket.io/4.8.1/socket.io.min.js';
document.head.appendChild(sScript);
sScript.onload = () => {
  const s = io('http://localhost:4000');
  s.on('connect', () => console.log('connected', s.id));
  s.on('initial_snapshot', data => console.log('snapshot', data));
  s.on('token_update', data => console.log('update', data));
};
```






