# OpenClaw modifications

These files change OpenClaw itself. The relay and connector do not import or install them.

- `end-conversation/` adds an `end_conversation` control to the voice adapter and sends its result to the Mini App. The Mini App uses that event to end a call after the farewell audio finishes. Without the Gateway change, calls can still be ended with the End button.
- `responsive-merged/` contains later versions of some of the same files. They add an immediate acknowledgement when work is delegated, avoid sending duplicate conversation history, and retain overlapping follow-up questions.
- `tests/` checks the saved responsiveness and follow-up behavior. These tests run as part of `bun test`; they do not test your installed Gateway.

Each manifest lists the expected file hashes before and after replacement. These are complete replacements for specific compiled OpenClaw files, not patches that can be applied to any release. The filenames and hashes must match your installation. The two directories overlap and should not be installed independently in an arbitrary order.

Older copies and installer scripts are kept in `legacy/openclaw/`. Those scripts refer to the original machine's paths and services. There is no portable installer in this repository.
