# Marketing Dashboard

Unified marketing analytics across LinkedIn, Instagram, Lemlist, Smartlead, Pipedrive, Google Analytics 4, and Google Search Console — backed by [Windsor.ai](https://windsor.ai) as the data layer, and exposed to Claude via an MCP server.

## Features

- **Executive Summary** with date-range filter (custom, last 7 / 30 / 90 days, year to date)
  - Website metrics from GA4 + Search Console
  - Outreach metrics from Lemlist + Smartlead (separate + combined)
  - CRM funnel from Pipedrive (MQLs, SQLs, meetings, deals)
  - LinkedIn + Instagram organic post performance
- **Settings → Connections** — connect each source through Windsor.ai's OAuth flow
- **Settings → MCP** — generate per-user bearer tokens and expose dashboard metrics to Claude as MCP tools
- Multi-user with email magic-link auth (Resend)
- 10-minute cache (memory + Postgres) to keep the dashboard snappy and rate-limit-friendly

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS · Recharts · NextAuth.js · Prisma · Postgres · Windsor.ai · `@modelcontextprotocol/sdk`

## Getting started

```bash
cp .env.example .env
# fill in DATABASE_URL, NEXTAUTH_SECRET, AUTH_RESEND_KEY, EMAIL_FROM, WINDSOR_API_KEY

npm install
npm run db:push        # creates tables
npm run dev            # http://localhost:3000
```

Then sign in with your email, visit **Settings → Connections** to connect at least one provider, and head back to the Executive Summary.

## MCP

In **Settings → MCP**, create a token. Then add the snippet to your Claude config:

```json
{
  "mcpServers": {
    "marketing-dashboard": {
      "type": "http",
      "url": "https://your-host/api/mcp",
      "headers": { "Authorization": "Bearer mkd_..." }
    }
  }
}
```

Available tools:
- `get_executive_summary({ from, to })`
- `get_website_metrics({ from, to })`
- `get_outreach_stats({ from, to, source? })`
- `get_crm_stats({ from, to })`
- `get_social_stats({ from, to, network? })`
- `list_connections()`

## Deploy

- **Vercel** for the app
- **Neon / Supabase** for Postgres
- **Resend** for email magic links
- **Windsor.ai** account + API key for data
