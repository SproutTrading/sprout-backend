<p align="center">
  <img src="https://github.com/user-attachments/assets/4b25d26d-5e4b-4d81-8c50-8fd86f553fa8" alt="banner">
</p>

# Sprout Trading Backend

[![Twitter Follow](https://img.shields.io/twitter/follow/sprout_trading?style=social)](https://x.com/sprout_trading)
[![Website](https://img.shields.io/badge/Website-sprout.trading-blue)](https://sprout.trading/)

A decentralized platform for nurturing projects through community collaboration. Sprout.trading enables users to contribute essential resources like water, fertilizer, and sunshine to Sprout v1, fostering growth through an innovative "gardening" mechanism. The platform features a desktop application for resource management, a launchpad for new projects, and a farm system for tracking and trading Sprout-launched tokens. Built with Node.js and PostgreSQL, this repository contains the backend infrastructure that powers the Sprout Trading ecosystem.

<p align="center">
  <img src="https://github.com/user-attachments/assets/f4411c76-5871-4f07-a8b2-14547d0a8c2d" alt="banner">
</p>

## Prerequisites

- Node.js LTS (v20/v22)
- Docker

## Server Configuration

### Generate Server Keys

```bash
ssh-keygen -t rsa -b 4096 -m PEM -f sprout.trading
openssl rsa -in sprout.trading -pubout -outform PEM -out sprout.trading.pub
```

## Docker Setup

1. Rename `docker-compose.example.yaml` to `docker-compose.yaml`
2. Configure PostgreSQL settings:

```yaml
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

##  Environment Setup

1. Rename `.env.example` to `.env`
2. Configure the following variables:

```bash
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

```bash
npm install
npm install typescript -g
tsc -w
npm run init_db
npm run start
```

## Available Scripts

- `npm run init_db` - Creates database tables
- `npm run start` - Starts the application

## Connect with Us

- Website: [sprout.trading](https://sprout.trading/)
- Twitter: [@sprout_trading](https://x.com/sprout_trading)
