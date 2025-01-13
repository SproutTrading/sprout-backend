## Requirements
- Node.js LTS v20/v22
- Docker

## Server keys
Generate server keys:
```
ssh-keygen -t rsa -b 4096 -m PEM -f sprout.trading
openssl rsa -in sprout.trading -pubout -outform PEM -out sprout.trading.pub
``` 

Rename docker-compose.example.yaml to docker-compose.yaml and fill the following information:

## Docker - Postgres (database)
```
services:
  db:
    image: postgres:latest
    container_name: sprout_db
    volumes:
      - ./current_db:/var/lib/postgresql
    environment:
      POSTGRES_USER: "example-user"
      POSTGRES_DB: "example-db"
      POSTGRES_PASSWORD: "p4ssw0rdsExample"
    ports:
      - "5435:5432"
    healthcheck:
      test:
        [
          "CMD-SHELL",
          "sh -c 'pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}'",
        ]
      interval: 3s
      timeout: 3s
      retries: 3
```

## Environiment variables
Rename .env.example to .env and fill the following information:
```
NODE_ENVIRONMENT='mainnet'
PORT=8000
WS_PORT=8001
ENCRYPTION_PK=

NODE_SOLANA_HTTP=""

POSTGRES_HOST=localhost
POSTGRES_PORT=5435
POSTGRES_DATABASE=
POSTGRES_USER=
POSTGRES_PASSWORD=

SOLANA_EPOCH=
TOKEN_ADDRESS=""
SOLSCAN_API_KEY=""
```

## Installation
```
> npm install
> npm install typescript -g
> tsc -w
> npm run init_db
> npm run start
```

## Scripts
- init_db: is used to create tables
- start: is used to run the application