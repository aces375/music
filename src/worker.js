// Cloudflare Worker entry point.
// Static files in ./public are served by Workers Static Assets before this code runs;
// requests that match no file (the /api/* routes) arrive here.

import * as extract from "./api/extract.js";
import * as obligations from "./api/obligations.js";
import * as health from "./api/health.js";
import * as regulation from "./api/regulation.js";
import * as review from "./api/review.js"; // TEMPORARY: edge-case review agents
import { error } from "../lib/http.js";

const ROUTES = {
  "/api/extract": extract,
  "/api/obligations": obligations,
  "/api/health": health,
  "/api/regulation": regulation,
  "/api/review": review, // TEMPORARY
};

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    const route = ROUTES[pathname.replace(/\/$/, "")];
    if (!route) return error(404, "Not found");

    // Handlers export onRequestGet / onRequestPost, one per HTTP method.
    const method = request.method.charAt(0) + request.method.slice(1).toLowerCase();
    const handler = route[`onRequest${method}`];
    if (!handler) return error(405, `${request.method} not allowed`);
    return handler({ request, env, ctx });
  },
};
