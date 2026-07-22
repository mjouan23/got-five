# Got Five!

Got Five! est un jeu de societe multijoueur en temps reel, jouable sur smartphone via une application web installable (PWA).

## Presentation

- Pas de compte utilisateur.
- Un joueur cree une session, partage un code ou un QR Code.
- Les autres joueurs rejoignent via scan ou saisie manuelle.
- Le salon est synchronise en temps reel avec Socket.IO.

## Technologies

- Frontend: Vue 3, Vite, Vue Router, Pinia, Socket.IO Client, Axios, html5-qrcode, qrcode, vite-plugin-pwa.
- Backend: Node.js, Express, Socket.IO, SQLite (better-sqlite3), Helmet, CORS, rate limiting.
- Langage: JavaScript uniquement (sans TypeScript).

## Prerequis

- Node.js 20+
- npm 10+

## Installation

```bash
npm install
npm run install:all
```

## Configuration

1. Copier les exemples d'environnement.

```bash
copy client\.env.example client\.env
copy server\.env.example server\.env
```

2. Verifier les valeurs:

Frontend [client/.env.example](client/.env.example)

- VITE_API_URL=http://localhost:3000
- VITE_SOCKET_URL=http://localhost:3000
- VITE_PUBLIC_URL=http://localhost:5173

Backend [server/.env.example](server/.env.example)

- PORT=3000
- CLIENT_URL=http://localhost:5173
- PUBLIC_APP_URL=http://localhost:5173
- SQLITE_PATH=./data/got-five.sqlite
- SESSION_EXPIRATION_HOURS=24
- MAX_PLAYERS_PER_SESSION=4

## Demarrage en developpement

```bash
npm run dev
```

Cette commande demarre simultanement:

- le frontend Vite sur http://localhost:5173
- le backend Express + Socket.IO sur http://localhost:3000

## Construction PWA

```bash
npm run build
```

Le build frontend est genere dans [client/dist](client/dist).

## Demarrage production

```bash
npm run start
```

Le script lance le backend Node.js.

## Tests E2E automatiques

Les tests E2E couvrent l'API REST et Socket.IO.

Prerequis local: backend en cours d'execution sur `http://localhost:3000`.

```bash
npm run test:e2e:api
npm run test:e2e:socket
npm run test:e2e
```

Vous pouvez aussi cibler une autre URL backend:

```bash
BACKEND_URL=https://gotfive.meeplix.fr npm run test:e2e
```

## Structure du projet

```text
got-five/
|-- client/
|   |-- public/
|   |   |-- icons/
|   |   `-- logo.png
|   |-- src/
|   |   |-- assets/
|   |   |-- components/
|   |   |-- composables/
|   |   |-- router/
|   |   |-- services/
|   |   |-- stores/
|   |   |-- views/
|   |   |-- App.vue
|   |   `-- main.js
|   |-- index.html
|   |-- vite.config.js
|   |-- package.json
|   `-- .env.example
|-- server/
|   |-- src/
|   |   |-- config/
|   |   |-- controllers/
|   |   |-- database/
|   |   |-- repositories/
|   |   |-- routes/
|   |   |-- services/
|   |   |-- sockets/
|   |   |-- utils/
|   |   |-- app.js
|   |   `-- server.js
|   |-- data/
|   |   `-- .gitkeep
|   |-- package.json
|   `-- .env.example
|-- shared/
|   |-- socket-events.js
|   `-- game-status.js
|-- .gitignore
|-- package.json
`-- README.md
```

## Fonctionnement des sessions

- Une session contient: id, code, statut, horodatages, host_player_id, host_token.
- Un joueur contient: id, session_id, nickname, reconnect_token, role, connected, socket_id, horodatages.
- Statuts: LOBBY, PLAYING, FINISHED.
- Roles: HOST, PLAYER.
- Nettoyage periodique des sessions inactives > 24h (configurable).

## QR Codes

- Le salon genere un QR Code de type: `https://gotfive.meeplix.fr/join/ABC123` en production.
- En local, l'URL utilise automatiquement `VITE_PUBLIC_URL`.
- Le scanner mobile lit l'URL et redirige vers la route [client/src/views/JoinByCodeView.vue](client/src/views/JoinByCodeView.vue).

## SQLite

- Fichier: [server/data/got-five.sqlite](server/data/got-five.sqlite)
- Creation automatique au demarrage du backend.
- Tables: `sessions`, `players`.
- Contraintes: index unique sur code session, cle etrangere + suppression cascade.

## Logo

Le logo principal doit etre place manuellement ici:

- [client/public/logo.png](client/public/logo.png)

Il est utilise:

- sur l'accueil
- dans le header
- dans le manifeste PWA
- pour les icones PWA
- pour l'installation de l'application

## Deploiement derriere reverse proxy

En production pour `https://gotfive.meeplix.fr`:

- servir le frontend en HTTPS
- exposer le backend Node.js derriere un proxy
- activer le support WebSocket sur `/socket.io`
- renseigner `PUBLIC_APP_URL=https://gotfive.meeplix.fr`
- renseigner `CLIENT_URL=https://gotfive.meeplix.fr`

## Check-list de deploiement production

- Build frontend effectue: `npm run build`
- Backend demarrable: `npm run start`
- Variables d'environnement configurees (client + server)
- HTTPS actif (certificats valides)
- Reverse proxy configure pour `/`, `/api`, `/socket.io`
- Upgrade WebSocket actif sur `/socket.io`
- CORS backend aligne sur le domaine public
- `PUBLIC_APP_URL` configure avec l'URL finale HTTPS
- `CLIENT_URL` configure avec le domaine frontend HTTPS
- Fichier logo present: [client/public/logo.png](client/public/logo.png)
- Base SQLite persistante: [server/data/got-five.sqlite](server/data/got-five.sqlite)
- Test sante backend valide: `GET /api/health`
- Tests E2E valides: `npm run test:e2e`

## Exemple Nginx

```nginx
server {
    listen 80;
    server_name gotfive.meeplix.fr;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name gotfive.meeplix.fr;

    ssl_certificate /etc/letsencrypt/live/gotfive.meeplix.fr/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gotfive.meeplix.fr/privkey.pem;

    location / {
        root /var/www/got-five/client/dist;
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

## HTTPS obligatoire

En production, HTTPS est indispensable:

- pour l'acces camera (scan QR)
- pour une installation PWA fiable
- pour la securite des echanges
