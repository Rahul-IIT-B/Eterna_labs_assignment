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
   Invoke-RestMethod 'http://eterna-labs-assignment/health'
   ```
 - List Tokens
    ```bash
   Invoke-RestMethod 'http://eterna-labs-assignment/tokens?limit=10&sortBy=volume&sortDir=desc&period=24h' | ConvertTo-Json -Depth 4
    ```
 - Get Token Details
    ```bash
    $r = Invoke-RestMethod 'http://eterna-labs-assignment/tokens?limit=1'
    $addr = $r.items[0].address
    Invoke-RestMethod "http://eterna-labs-assignment/tokens/$([System.Uri]::EscapeDataString($addr))" | ConvertTo-Json -Depth 5
    ```
 - Benchmark List Tokens
    ```bash
   Measure-Command { 1..10 | ForEach-Object { Invoke-RestMethod 'http://eterna-labs-assignment/tokens?limit=20' > $null } }
    ```
 - Redis
    ```bash
   docker exec -it test-redis redis-cli --raw KEYS 'token:*'
   docker exec -it test-redis redis-cli GET 'token:DTF6900'
    ```

## Create connection in browser devtools console
```bash
const s = document.createElement('script');
s.src = 'https://cdn.socket.io/4.8.1/socket.io.min.js';
document.head.appendChild(s);
s.onload = () => {
  const socket = io('https://eterna-labs-assignment.onrender.com');       
  socket.on('connect', () => console.log('socket connected', socket.id));
  socket.on('initial_snapshot', m => console.log('initial_snapshot', m));
  socket.on('token_update', m => console.log('token_update', m));
};
```






