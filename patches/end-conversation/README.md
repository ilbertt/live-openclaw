# Model-issued conversation close (experimental adapter control)

This is NOT a public OpenAI function-tool registration or a native hangup-intent event.
The installed gpt-live-1-codex adapter parses the legacy provider event
`delegation.created.item.content[].text`. The patch instructs GPT-Live to put
exactly `{"tool":"end_conversation"}` there after a brief farewell. A strict JSON
dispatcher handles that action before agent consultation. Transcripts never
invoke the action. Invalid or prose-wrapped commands follow the existing delegation path.

The native WebRTC session forwards the application control into the existing Talk
`tool.result` envelope with source `gpt-live-delegation`. The Mini App only handles
it for its active voice session, deduplicates request IDs, observes audio quiet,
and cancels on new user transcript or sustained local microphone activity.
Missing output telemetry or prolonged playback leaves the session open.

The historical installer is in `legacy/openclaw/install-conversation-close.sh`.
It contains machine-specific paths, restarts services, and uses the old repository
layout. It is not a portable installation command. See [the patch overview](../README.md)
for the relationship between these files and the later replacements.

The historical test is in `legacy/openclaw/test-conversation-close.mjs` and also
uses paths from the original layout. It proves command
transport/dispatch, no backend consult for valid commands, rejection of transcript
matching, idempotence, interruption, playback gating, timeout, and stop/reset.
Build and browser checks are separate. No spoken model-generation proof yet:
after installation test a genuine farewell, opening ciao, quoted/translated bye,
stop-speaking-only, and a last-second change of mind. Do not call model behavior
verified based solely on mocked event tests. New calls are required after restart.

## Failed spoken test and backend fallback (2026-09-22)
The live test delegated `Termina la conversazione` as prose, not the JSON action. The direct-model convention is therefore not reliable or a registered native tool. The revised controller gives the already-delegated model a scoped structured-response contract and consumes an exact close action from either result delivery path, without speaking the JSON. This adds backend latency when the direct path is missed. It is not keyword matching, nor a registered backend function tool. Controller tests use mocked model output; real intent selection remains unverified. The saved controller includes this revision.
