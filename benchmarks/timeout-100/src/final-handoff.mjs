/** Never grade tool-response JSON or progress messages as the final assistant answer. */
export function finalHandoff(stdout) {
  const lines = stdout.split('\n').filter((s) => s.trim());
  const events = [];
  let plain = false;
  for (const line of lines) {
    try {
      events.push(JSON.parse(line));
    } catch {
      plain = true;
    }
  }
  if (!events.length) return stdout.trim();
  const answers = [];
  for (const e of events) {
    if (
      e.type === 'item.completed' &&
      e.item?.type === 'agent_message' &&
      typeof e.item.text === 'string'
    )
      answers.push(e.item.text);
    if (e.type === 'message_end' && e.message?.role === 'assistant') {
      const text = (e.message.content ?? [])
        .filter((p) => p.type === 'text')
        .map((p) => p.text ?? '')
        .join('\n');
      if (text) answers.push(text);
    }
    if (['result', 'run_result'].includes(e.type) && typeof e.text === 'string')
      answers.push(e.text);
  }
  if (answers.length) return answers.at(-1);
  if (events.every((e) => typeof e === 'object' && e !== null) && !plain)
    return '';
  throw Error(
    'Mixed or unsupported native output. Use a CLI JSON mode with final assistant-message events.',
  );
}
