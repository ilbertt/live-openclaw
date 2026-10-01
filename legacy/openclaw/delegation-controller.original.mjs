import { i as extractErrorCode, l as toErrorObject, s as readErrorName } from "./error-coercion-C1ZWqtQc.mjs";
import { r as truncateUtf16Safe } from "./utf16-slice-D_ngcYKd.mjs";
import { t as canonicalizeBase64 } from "./base64-Vw7DZYSc.mjs";
import { n as rawDataToString } from "./ws-BdD3UP1C.mjs";
import { o as buildRealtimeVoiceAgentControlSpeechMessage } from "./agent-run-control-shared-DXVEJ-0Y.mjs";
import "./realtime-voice-provider-BEROLKpx.mjs";
import { r as buildOpenAIQuicksilverDelegationPrompt } from "./realtime-quicksilver-instructions-kTl3roXd.mjs";
import { o as projectOpenAIQuicksilverErrorMessage } from "./realtime-quicksilver-redaction-Cfc2vSbu.mjs";
import { t as parseOpenAIQuicksilverEvent } from "./realtime-quicksilver-events-QgQ7pOPR.mjs";
import { n as boundOpenAIQuicksilverDelegationResult, s as chunkOpenAIQuicksilverAppendText, t as boundOpenAIQuicksilverContextItems } from "./realtime-quicksilver-wire-Cgpx8X2S.mjs";
//#region extensions/openai/realtime-quicksilver-delegation-controller.ts
const WEBSOCKET_OPEN = 1;
const CONSULT_FAILURE_TEXT = "The agent task failed. Tell the user it did not complete and offer to try again.";
function projectWireEventType(event) {
	switch (event.kind) {
		case "session-started": return "session.started";
		case "audio-cleared": return "output_audio_buffer.cleared";
		case "audio": return "output_audio.delta";
		case "transcript-delta": return event.role === "user" ? "input_transcript.added" : "output_transcript.added";
		case "transcript-done": return "turn.done";
		case "delegation": return "delegation.created";
		case "error": return "error";
		case "ignored": return event.eventType === "session.updated" ? "session.updated" : void 0;
		case "unknown": return;
	}
}
/** Owns the provider's single active delegation and its once-consumed transcript context. */
var OpenAIQuicksilverDelegationController = class {
	constructor(options, formatErrorMessage) {
		this.options = options;
		this.formatErrorMessage = formatErrorMessage;
		this.delegationGeneration = 0;
		this.onSessionAbort = () => {
			const reason = this.options.signal.reason;
			this.stop(reason instanceof Error ? reason : /* @__PURE__ */ new Error("GPT-Live session stopped"));
		};
		this.stopped = false;
		this.transcript = [];
		this.completionClaimsAdopted = options.runAgentConsult.adoptCompletionClaims !== void 0;
		options.runAgentConsult.adoptCompletionClaims?.();
		if (options.signal.aborted) this.onSessionAbort();
		else options.signal.addEventListener("abort", this.onSessionAbort, { once: true });
	}
	handleFrame(data, isBinary) {
		if (this.stopped) return;
		if (isBinary) {
			this.fail(/* @__PURE__ */ new Error("OpenAI GPT-Live sideband returned an unexpected binary frame"));
			return;
		}
		const payload = rawDataToString(data);
		const event = parseOpenAIQuicksilverEvent(payload);
		if (event) {
			const eventType = projectWireEventType(event);
			if (eventType) this.options.onWireEventType?.(eventType);
			this.handleEvent(event);
		}
	}
	handleEvent(event) {
		if (this.stopped || event.kind === "ignored" || event.kind === "audio-cleared") return;
		if (event.kind === "unknown") {
			this.options.logger.debug?.("OpenAI GPT-Live ignored an unsupported sideband event");
			return;
		}
		if (event.kind === "session-started") {
			this.options.onSessionStarted?.(event.expiresAt);
			return;
		}
		if (event.kind === "transcript-delta" || event.kind === "transcript-done") {
			this.appendTranscript(event);
			this.options.onTranscript?.(event.role, event.text, event.kind === "transcript-done");
			return;
		}
		if (event.kind === "error") {
			const error = new Error(projectOpenAIQuicksilverErrorMessage("provider"));
			this.options.logger.warn(error.message);
			if (event.fatalAuth) this.options.onFatalError(error);
			else this.options.onError?.(error);
			return;
		}
		if (event.kind === "audio") {
			if (!this.options.onAudio) return;
			const audio = canonicalizeBase64(event.data);
			if (!audio) {
				this.fail(/* @__PURE__ */ new Error("OpenAI GPT-Live returned malformed base64 audio"));
				return;
			}
			this.options.onAudio(Buffer.from(audio, "base64"));
			return;
		}
		this.startDelegation(event.id, event.prompt);
	}
	sendSessionContext(text, channel) {
		const content = text.trim();
		if (content) this.sendAppend({ type: "session.context.append" }, content, channel);
	}
	stop(reason) {
		if (this.stopped) return;
		this.markStopped();
		this.consultController?.abort(reason);
		this.consultController = void 0;
	}
	/** Releases sideband ownership without canceling work already accepted by the host. */
	detach() {
		if (this.stopped) return;
		this.markStopped();
	}
	appendTranscript(event) {
		const last = this.transcript.at(-1);
		if (event.kind === "transcript-delta") {
			if (last?.role === event.role && this.partialTranscriptRole === event.role) last.text += event.text;
			else this.transcript.push({
				role: event.role,
				text: event.text
			});
			this.partialTranscriptRole = event.role;
		} else {
			if (last?.role === event.role && this.partialTranscriptRole === event.role) last.text = event.text;
			else this.transcript.push({
				role: event.role,
				text: event.text
			});
			this.partialTranscriptRole = void 0;
		}
		this.transcript = boundOpenAIQuicksilverContextItems(this.transcript);
	}
	startDelegation(id, input) {
		if (this.stopped || this.options.signal.aborted || !input.trim()) return;
		const handleInput = this.options.handleDelegationInput;
		if (handleInput) {
			const socket = this.options.getSocket();
			let responded = false;
			const respond = (message) => {
				if (responded) return;
				responded = true;
				if (!socket || socket !== this.options.getSocket()) return;
				try {
					this.sendAppend({
						type: "delegation.context.append",
						delegation_item_id: id
					}, message, "speakable", socket);
				} catch (error) {
					this.fail(toErrorObject(error, "OpenAI GPT-Live control response failed"));
				}
			};
			try {
				if (handleInput(input, respond) === "control") return;
			} catch (error) {
				this.fail(toErrorObject(error, "OpenAI GPT-Live control admission failed"));
				return;
			}
		}
		const transcript = this.transcript;
		this.transcript = [];
		this.partialTranscriptRole = void 0;
		const delegation = {
			id,
			prompt: buildOpenAIQuicksilverDelegationPrompt({
				input,
				transcript
			})
		};
		if (this.consultController) {
			this.pendingDelegation = delegation;
			const runner = this.options.runAgentConsult;
			if (runner.steer) this.schedulePendingSteering(this.consultController, runner.steer);
			else {
				this.revokeRequesterFinal();
				this.consultController.abort(/* @__PURE__ */ new Error("Realtime delegation superseded"));
			}
			return;
		}
		this.launchDelegation(delegation);
	}
	launchDelegation(delegation) {
		if (this.stopped || this.options.signal.aborted) return;
		const controller = new AbortController();
		const generation = ++this.delegationGeneration;
		this.consultController = controller;
		this.activeDelegationId = delegation.id;
		this.requesterFinalOwner = {
			delegationId: delegation.id,
			generation
		};
		this.runDelegation(delegation, generation, controller.signal).catch((error) => this.fail(toErrorObject(error, "OpenAI GPT-Live delegation failed"))).finally(() => {
			if (this.consultController !== controller) return;
			this.consultController = void 0;
			this.activeDelegationId = void 0;
			const pending = this.pendingDelegation;
			this.pendingDelegation = void 0;
			if (pending) this.launchDelegation(pending);
		});
	}
	schedulePendingSteering(controller, steer) {
		if (this.steeringPromise) return;
		const completion = (async () => {
			await Promise.resolve();
			while (!this.stopped && !controller.signal.aborted && this.consultController === controller) {
				const delegation = this.pendingDelegation;
				this.pendingDelegation = void 0;
				if (!delegation) return;
				try {
					await steer({
						prompt: delegation.prompt,
						signal: controller.signal
					});
				} catch (error) {
					this.revokeRequesterFinal();
					if (this.stopped || controller.signal.aborted || readErrorName(error) === "AbortError" || extractErrorCode(error) === "ABORT_ERR") return;
					const fatal = toErrorObject(error, "Realtime delegation steering failed");
					this.pendingDelegation = void 0;
					controller.abort(fatal);
					this.fail(fatal);
					return;
				}
				if (this.stopped || controller.signal.aborted || this.consultController !== controller) return;
				this.activeDelegationId = delegation.id;
				const requesterFinalOwner = this.requesterFinalOwner;
				if (requesterFinalOwner) this.requesterFinalOwner = {
					delegationId: delegation.id,
					generation: requesterFinalOwner.generation
				};
			}
		})().finally(() => {
			if (this.steeringPromise === completion) this.steeringPromise = void 0;
			if (this.pendingDelegation && !this.stopped) this.schedulePendingSteering(controller, steer);
		});
		this.steeringPromise = completion;
	}
	markStopped() {
		this.stopped = true;
		this.revokeRequesterFinal();
		this.options.signal.removeEventListener("abort", this.onSessionAbort);
		this.pendingDelegation = void 0;
		this.partialTranscriptRole = void 0;
		this.transcript = [];
	}
	async runDelegation(delegation, generation, signal) {
		let text;
		let failed = false;
		const runner = this.options.runAgentConsult;
		try {
			if (this.options.handleDelegationInput) this.sendSessionContext(buildRealtimeVoiceAgentControlSpeechMessage("I’ll check that request."), "speakable");
			const result = await runner({
				prompt: delegation.prompt,
				signal,
				requesterFinal: { append: (finalText) => this.appendRequesterFinal(generation, finalText) }
			});
			if (signal.aborted) {
				runner.claimAppend?.();
				this.revokeRequesterFinal();
				return;
			}
			text = boundOpenAIQuicksilverDelegationResult(result.text);
		} catch (error) {
			if (signal.aborted || readErrorName(error) === "AbortError" || extractErrorCode(error) === "ABORT_ERR") {
				runner.claimAppend?.();
				this.revokeRequesterFinal();
				return;
			}
			const reason = this.formatErrorMessage(error).replaceAll(/\s+/g, " ").trim();
			this.options.logger.warn(`OpenAI GPT-Live delegation consult failed: ${truncateUtf16Safe(reason, 180) || "unknown error"}`);
			failed = true;
			text = CONSULT_FAILURE_TEXT;
		}
		while (this.steeringPromise) await this.steeringPromise;
		if (signal.aborted || this.stopped) {
			runner.claimAppend?.();
			this.revokeRequesterFinal();
			return;
		}
		const claim = failed ? runner.claimFailureAppend : runner.claimAppend;
		if (claim) {
			if (!claim()) {
				this.revokeRequesterFinal();
				return;
			}
		} else if (this.completionClaimsAdopted) {
			this.revokeRequesterFinal();
			this.fail(/* @__PURE__ */ new Error(failed ? "Realtime delegation failure ownership is unavailable" : "Realtime delegation completion ownership is unavailable"));
			return;
		}
		const delegationId = this.activeDelegationId;
		if (!delegationId) {
			this.revokeRequesterFinal();
			return;
		}
		if (!this.sendAppend({
			type: "delegation.context.append",
			delegation_item_id: delegationId
		}, text, "speakable")) this.revokeRequesterFinal();
	}
	appendRequesterFinal(generation, text) {
		const owner = this.requesterFinalOwner;
		if (this.stopped || !owner || owner.generation !== generation) return false;
		this.requesterFinalOwner = void 0;
		return this.sendAppend({
			type: "delegation.context.append",
			delegation_item_id: owner.delegationId
		}, boundOpenAIQuicksilverDelegationResult(text), "speakable");
	}
	revokeRequesterFinal() {
		this.requesterFinalOwner = void 0;
		this.options.runAgentConsult.revokeRequesterFinal?.();
	}
	sendAppend(target, text, channel, socket = this.options.getSocket()) {
		for (const chunk of chunkOpenAIQuicksilverAppendText(text)) {
			if (this.stopped || this.options.signal.aborted || !socket || socket !== this.options.getSocket() || socket.readyState !== WEBSOCKET_OPEN) return false;
			socket.send(JSON.stringify({
				...target,
				channel,
				content: [{
					type: "input_text",
					text: chunk
				}]
			}));
		}
		return true;
	}
	fail(error) {
		if (this.stopped) return;
		this.options.logger.warn(error.message);
		this.options.onFatalError(error);
	}
};
//#endregion
export { OpenAIQuicksilverDelegationController as t };
