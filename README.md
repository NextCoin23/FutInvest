# FutInvest — Robôs de Futebol ao Vivo (Telegram Mini App)

## Arranque rápido

### Backend
```bash
cd backend
npm install
npm run init-db
ADMIN_SECRET=teu-segredo npm run dev
```

### Frontend
```bash
npm install
echo "VITE_API_URL=http://localhost:3001" > .env
npm run dev
```

## O que está ligado à API

- Utilizador e saldo
- Robôs ao vivo (estados no servidor, refresh a cada 4s)
- Histórico de jogos
- Depósitos e saques
- Endereços BTC / ETH / USDC

## Endereços de depósito

- BTC: `175DBVQbmokQFmbP1xXvChpmQxwCLeiDim`
- ETH / USDC: `0x253b6EA9a69D60400C5170022362eebd442bEdF9`

## Admin

Headers: `x-admin-secret: teu-segredo`

- GET `/api/admin/pending-deposits`
- GET `/api/admin/pending-withdrawals`
- POST `/api/admin/credit-deposit` `{ depositId, amount }`
- POST `/api/admin/process-withdraw` `{ withdrawId, action: "complete"|"reject" }`

## Painel Admin

Abre no browser:

```
backend/admin.html
```

1. Coloca o `ADMIN_SECRET`
2. URL da API (ex: `http://localhost:3001`)
3. Clica **Carregar tudo**

### Separadores

| Separador | O que faz |
|-----------|-----------|
| **Saques** | Lista pedidos com **valor, rede e carteira do cliente**. Botões: Pago / Rejeitar |
| **Depósitos** | Creditar saldo após veres o tx na blockchain |
| **Utilizadores** | Todos os users, saldo e lucro |
| **Robôs** | Estado ao vivo de cada bot |
| **Histórico** | Jogos e resultados |

Nos saques podes **copiar a carteira** do cliente com um clique antes de enviar o crypto.
