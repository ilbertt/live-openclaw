from pathlib import Path
import hashlib,json
base=Path('/usr/lib/node_modules/openclaw/dist'); out=Path(__file__).parent
names=['realtime-quicksilver-instructions-kTl3roXd.mjs','realtime-quicksilver-delegation-controller-1v5hW2XF.mjs','realtime-quicksilver-session-BWooKpPG.mjs','talk-DLn5zMng.mjs']
files={n:(base/n).read_text() for n in names}; original=files.copy()
def replace(name,old,new):
 assert files[name].count(old)==1,(name,files[name].count(old))
 files[name]=files[name].replace(old,new)
replace(names[0], 'You have no tools of your own.', 'Your external tools run through the host. Session-control actions explicitly described below are handled directly by the application.')
replace(names[0],'Host-provided results and status updates are not new requests. Deliver a result naturally once; do not delegate it again.`;', '''Host-provided results and status updates are not new requests. Deliver a result naturally once; do not delegate it again.
SESSION CONTROL ACTION: end_conversation, arguments {}. This application-defined action is carried by client delegation, not by spoken text. When the caller genuinely finishes this live conversation or explicitly asks you to close it, say a short natural farewell first, then invoke it by delegating exactly {"tool":"end_conversation"}, with no prose or code fences. The host executes it directly without consulting another model. Never speak the JSON or announce checking. Use conversational intent: an opening greeting, a quoted farewell, a translation/example, a goodbye to someone else, or a request only to stop speaking is NOT an instruction to close. If uncertain stay connected. If the caller changes their mind, continue naturally; new speech cancels a pending close. Never claim the session has closed before it actually closes.`;''')
replace(names[1],'\t\tthis.transcript = [];\n\t\tthis.completionClaimsAdopted', '\t\tthis.transcript = [];\n\t\tthis.conversationControlIds = new Set();\n\t\tthis.completionClaimsAdopted')
replace(names[1],'\t\tconst handleInput = this.options.handleDelegationInput;', '''\t\t// Exact structured action emitted on the provider delegation channel.
\t\t// Never inspect transcript text for farewell keywords.
\t\tlet command;
\t\ttry { command = JSON.parse(input); } catch {}
\t\tif (command && !Array.isArray(command) && typeof command === "object" &&
\t\t\tObject.keys(command).length === 1 && command.tool === "end_conversation" &&
\t\t\ttypeof this.options.onConversationControl === "function") {
\t\t\tif (this.conversationControlIds.has(id)) return;
\t\t\tthis.conversationControlIds.add(id);
\t\t\tthis.options.onConversationControl({ action: "end_conversation", requestId: id });
\t\t\tthis.sendAppend({ type: "delegation.context.append", delegation_item_id: id },
\t\t\t\t"The application received end_conversation and will close after playback. Do not add another farewell. New user speech cancels the close; respond normally if they continue.", "commentary");
\t\t\treturn;
\t\t}
\t\tconst handleInput = this.options.handleDelegationInput;''')
replace(names[2],'\t\t\t\t\tonTranscript: nativeControl.onTranscript,','''\t\t\t\t\tonTranscript: nativeControl.onTranscript,
\t\t\t\t\tonConversationControl: (control) => nativeControl.onEvent?.({
\t\t\t\t\t\tdirection: "server", type: "friday.conversation.control", ...control
\t\t\t\t\t}),''')
replace(names[3],'\t\t\t\tconst legacyOutcome = handleRealtimeVoiceHarnessBridgeEvent(harness, event);','''\t\t\t\t// Application control, not an OpenAI-native event. Origin is the
\t\t\t\t// model's structured client-delegation request on the trusted sideband.
\t\t\t\tif (event.type === "friday.conversation.control" && event.action === "end_conversation" && typeof event.requestId === "string") {
\t\t\t\t\tharness.emit({ type: "tool.result", payload: {
\t\t\t\t\t\ttoolName: "end_conversation", requestId: event.requestId,
\t\t\t\t\t\tsource: "gpt-live-delegation", status: "close_requested"
\t\t\t\t\t} });
\t\t\t\t\treturn;
\t\t\t\t}
\t\t\t\tconst legacyOutcome = handleRealtimeVoiceHarnessBridgeEvent(harness, event);''')
manifest=[]
for name,s in files.items():
 (out/name).write_text(s)
 manifest.append({'name':name,'before':hashlib.sha256(original[name].encode()).hexdigest(),'after':hashlib.sha256(s.encode()).hexdigest()})
(out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Prepared 4 version-checked patches; installed files unchanged.')
