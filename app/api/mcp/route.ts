import { NextResponse } from "next/server";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { buildMcpServer } from "@/lib/mcp/server";
import { resolveTokenToUserId } from "@/lib/mcp/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authUserId(req: Request): Promise<string | null> {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  return resolveTokenToUserId(match[1]);
}

async function handle(req: Request) {
  const userId = await authUserId(req);
  if (!userId) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: { "WWW-Authenticate": "Bearer" } },
    );
  }

  const body = req.method === "POST" ? await req.json().catch(() => null) : null;

  // Lazy import to ensure Node runtime
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const server = buildMcpServer(userId);
  await server.connect(transport);

  const { req: nodeReq, res: nodeRes, response } = createNodeShims(req, body);
  await transport.handleRequest(nodeReq, nodeRes, body);
  return response();
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;

// Minimal Node IncomingMessage/ServerResponse shims so the MCP SDK can write
// a streamable-HTTP response from within a Next.js Route Handler.
function createNodeShims(req: Request, body: unknown) {
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => {
    headers[k.toLowerCase()] = v;
  });

  const nodeReq = {
    method: req.method,
    url: new URL(req.url).pathname + new URL(req.url).search,
    headers,
    body,
  } as any;

  let statusCode = 200;
  let resHeaders: Record<string, string> = {};
  const chunks: Buffer[] = [];
  let resolveDone!: () => void;
  const done = new Promise<void>((r) => (resolveDone = r));

  const nodeRes = {
    statusCode,
    setHeader(name: string, value: string) {
      resHeaders[name.toLowerCase()] = value;
    },
    getHeader(name: string) {
      return resHeaders[name.toLowerCase()];
    },
    writeHead(code: number, hdrs?: Record<string, string>) {
      statusCode = code;
      if (hdrs) {
        for (const [k, v] of Object.entries(hdrs))
          resHeaders[k.toLowerCase()] = String(v);
      }
      return nodeRes;
    },
    write(chunk: string | Buffer) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
      return true;
    },
    end(chunk?: string | Buffer) {
      if (chunk) {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
      }
      resolveDone();
      return nodeRes;
    },
    on() {
      return nodeRes;
    },
  } as any;

  Object.defineProperty(nodeRes, "statusCode", {
    get: () => statusCode,
    set: (v: number) => {
      statusCode = v;
    },
  });

  const response = async () => {
    await done;
    const body = Buffer.concat(chunks);
    return new NextResponse(body, {
      status: statusCode,
      headers: resHeaders,
    });
  };

  return { req: nodeReq, res: nodeRes, response };
}
