# Raycast Page-Capture Direct RPC Evaluation

## Decision

Route first-party Raycast webpage captures directly through a narrow authenticated PostgREST RPC. Keep the general BathOS MCP service for other clients and capture types.

## Evidence

- Five authenticated MCP `whoami` calls with no task mutation averaged 2,185 ms.
- Five authenticated zero-row Data API reads with the same OAuth token averaged 215 ms.
- Recent task submission through MCP averaged 2,735 ms.
- The difference isolates about 1.97 seconds of baseline latency to the general MCP Edge Function path before task creation work.

## Implementation Boundary

`tasks_create_raycast_page_capture` accepts only an idempotency UUID, title, and URL. It runs as `SECURITY INVOKER`, is executable only by `authenticated`, and calls the existing transactional `tasks_create_mcp_task` function with fixed Raycast placement and provenance.

The Raycast client uses a public project key to identify the application and the existing delegated OAuth bearer token to identify the user. No privileged key is introduced.

## Expected Result

The BathOS stage should move toward approximately 0.4 to 0.8 seconds, saving roughly 1.9 to 2.3 seconds per capture. Production timing samples are required after database-first deployment to confirm the actual p50 and p95 change.
