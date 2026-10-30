# Inventory backend

## Production deployment

Deploy this directory as a Node.js application with Node.js 20.9 or newer. Set
`DATABASE_URL` to a reachable production MySQL/MariaDB connection string and set
`AUTH_SECRET` to a strong secret shared with the frontend. Set
`CORS_ALLOWED_ORIGIN` to the exact public frontend origin (for example,
`https://inventory.example.com`); it defaults to `http://localhost:3001` for local
development. Do not commit real environment files or secrets.

Install dependencies with `pnpm install --frozen-lockfile`. The build generates the
Prisma client and builds the application with `pnpm build`. Before serving traffic,
apply committed migrations with `pnpm exec prisma migrate deploy`. Start the
application with `pnpm start`.

Do not run the demo seed against production data. It creates sample users and
inventory records with development credentials.
