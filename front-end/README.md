# Inventory frontend

## Production deployment

Deploy this directory as a Node.js application with Node.js 20.9 or newer. Configure
`NEXT_PUBLIC_API_URL` as the public HTTPS origin of the backend before building;
the frontend uses it to proxy `/api/*` requests and to check page permissions.
See `.env.example` for the expected format.

Install dependencies with `pnpm install --frozen-lockfile`, build with `pnpm build`,
and run with `pnpm start`. Keep the frontend and backend on HTTPS in production.
Set the same strong `AUTH_SECRET` on both applications; the frontend uses it to
validate the backend's session cookie. Never commit real environment files or secrets.
