import {
  metadataCorsOptionsRequestHandler,
  protectedResourceHandler,
} from "mcp-handler";
import { getAuthConfig } from "../../../lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const { issuer } = getAuthConfig();
const handler = protectedResourceHandler({ authServerUrls: [issuer] });
const corsHandler = metadataCorsOptionsRequestHandler();

export { handler as GET, corsHandler as OPTIONS };
