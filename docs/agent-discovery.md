# Agent discovery

How CareerOtter presents itself to AI agents and registries: what the origin
publishes, where each document is generated, and the two categories of thing we
deliberately do not publish.

## What is published

| Resource | Standard | Source |
| --- | --- | --- |
| `Link:` response headers | [RFC 8288](https://www.rfc-editor.org/rfc/rfc8288) | `next.config.mjs` (`headers()`) |
| `/robots.txt` with `Content-Signal` | [contentsignals.org](https://contentsignals.org), `draft-romm-aipref-contentsignals` | `app/robots.txt/route.ts` |
| `/llms.txt` | de-facto convention | `app/llms.txt/route.ts` |
| `/openapi.json` | OpenAPI 3.1 | `app/openapi.json/route.ts` |
| `/.well-known/api-catalog` | [RFC 9727](https://www.rfc-editor.org/rfc/rfc9727) / [RFC 9264](https://www.rfc-editor.org/rfc/rfc9264) | `app/.well-known/api-catalog/route.ts` |
| `/.well-known/ai-catalog.json` | [ARD](https://agenticresourcediscovery.org) | `app/.well-known/ai-catalog.json/route.ts` |
| `/.well-known/agent-skills/index.json` | Agent Skills Discovery v0.2.0 | `app/.well-known/agent-skills/index.json/route.ts` |
| Markdown content negotiation | `Accept: text/markdown` | `middleware.ts` + `app/api/markdown/route.ts` |
| WebMCP tools | [webmachinelearning.github.io/webmcp](https://webmachinelearning.github.io/webmcp/) | `components/agents/webmcp-provider.tsx` |

Two things keep these honest and are worth preserving:

- **Nothing is hand-copied.** Pricing, tool lists, and blog entries come from the
  same constants the pages render (`lib/constants/homepage-content.ts`,
  `lib/constants/free-tools.ts`, `lib/blog.ts`). Skill digests are computed from
  the bytes on disk at build time, so editing a `SKILL.md` updates the index.
- **Only IANA-registered link relations appear in the `Link` header.** A bare
  token that isn't registered is not a conforming relation type.

### Adding an agent skill

1. Create `content/agent-skills/<name>/SKILL.md` with YAML frontmatter (`name`,
   `description`).
2. Add the name and description to `AGENT_SKILLS` in
   `lib/agent-discovery/skills.ts`.

The index entry, digest, `/.well-known/agent-skills/<name>/SKILL.md` route, and
the ARD manifest entry all follow automatically.
`__tests__/agent-discovery/discovery-documents.test.ts` fails if a declared skill
has no file, or if a published digest stops matching what is served.

### Adding a markdown rendering

Add the path to `STATIC_MARKDOWN_PATHS` in
`lib/agent-discovery/markdown-negotiation.ts` and a case to
`renderMarkdownPage` in `lib/agent-discovery/markdown-pages.ts`. Blog posts are
already covered — they render from their MDX source.

Pages whose copy lives only in JSX (`/privacy`, `/terms`, the role landing
pages) are deliberately absent. They keep serving HTML rather than a
hand-written summary that would silently go stale.

## Not published: DNS-AID

DNS for AI Discovery ([`draft-mozleywilliams-dnsop-dnsaid-02`](https://datatracker.ietf.org/doc/html/draft-mozleywilliams-dnsop-dnsaid-02)) is the one item here
that cannot live in this repository — it is zone configuration, applied wherever
`careerotter.io` DNS is hosted.

To publish it, add ServiceMode SVCB records under `_agents`:

```
; Well-known entry point. Points agents at the origin serving the
; ARD manifest and the rest of the /.well-known documents.
_index._agents.careerotter.io. 3600 IN SVCB 1 careerotter.io. (
                                 alpn="h2,http/1.1"
                                 port=443
                                 well-known="ai-catalog.json"
                                 mandatory=alpn )
```

Notes before doing this:

- Alongside the RFC 9460 keys (`alpn`, `port`, `ipv4hint`, `ipv6hint`,
  `mandatory`), draft `-02` defines six of its own: `well-known` (an RFC 8615
  path, with the `.well-known/` prefix assumed — hence `ai-catalog.json` above,
  not the full path), `cap` and `cap-sha256` (a capability descriptor locator
  and the base64url SHA-256 digest of its canonical form), `policy`, `realm`,
  and `bap`.
- **Those six have no numeric code points yet.** The draft defers assignment to
  IANA under Standards Action, so today they can only be published as
  experimental `key65xxx` numbers that no two implementations agree on. That,
  not a gap in the draft, is the reason to wait.
- The schema of the organization index that `_index._agents` points at is out of
  scope for the draft. CareerOtter would serve `/.well-known/ai-catalog.json`,
  which is what the ARD manifest above already is.
- `_mcp._agents` and `_a2a._agents` records should **not** be added. They would
  advertise an MCP server and an A2A agent that do not exist (see below).
- The draft asks that the discovery zone be DNSSEC-signed so validating
  resolvers return authenticated data. Signing `careerotter.io` is a
  registrar/DNS-host operation, not a code change.

## Not published: OAuth, auth.md, and MCP

Four commonly-audited discovery documents are intentionally absent, because
publishing them would describe infrastructure CareerOtter does not have. An
agent that reads a discovery document and then gets a 404 is worse off than one
that found nothing and fell back to the website.

- **`/.well-known/openid-configuration`, `/.well-known/oauth-authorization-server`.**
  CareerOtter is not an OAuth authorization server. Authentication is a Supabase
  session cookie obtained by the first-party web app. There is no client
  registration, no authorization endpoint, and no token endpoint a third party
  could use.
- **`/.well-known/oauth-protected-resource`.** Same reason: it would have to name
  authorization servers that can issue tokens for this resource, and none can.
- **`/auth.md`.** Its whole purpose is agent registration instructions. There is
  no agent registration.
- **`/.well-known/mcp/server-card.json`.** There is no MCP server. The in-browser
  WebMCP tools in `components/agents/webmcp-provider.tsx` are a different thing:
  they run in the user's tab, are not reachable over the network, and are not
  described by a server card.

These become worth publishing the day a public, token-authenticated API exists —
not before. The prerequisite is a real API surface with its own authorization
story, at which point `/openapi.json` and `/.well-known/api-catalog` grow to
describe it and the OAuth documents follow.
