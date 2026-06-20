# Home Nursing Backend

Node.js/TypeScript API for the home nursing management platform.

## Requirements

- Node.js 18+
- PostgreSQL

## Setup

```bash
npm install
npm run db:generate
npm run db:push
npm run dev
```

Default API URL: `http://localhost:3847/api`

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Compile TypeScript |
| `npm start` | Run production build |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Sync schema to database |
| `npm test` | Run tests |

## Environment

Create a `.env` file with at least `DATABASE_URL` and other secrets required by your deployment. Do not commit `.env`.
