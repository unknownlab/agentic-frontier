import { test } from 'node:test';
import assert from 'node:assert/strict';
import { finalHandoff } from '../src/final-handoff.mjs';
test('grades the last Codex assistant answer, never a diagnostic tool result', () => {
  const tool = {
    type: 'item.completed',
    item: {
      type: 'command_execution',
      aggregated_output: 'vpn_mtu_blackhole gateway secret-verification-code',
    },
  };
  assert.equal(finalHandoff(JSON.stringify(tool)), '');
  const transcript = [
    {
      type: 'item.completed',
      item: { type: 'agent_message', text: 'Investigating.' },
    },
    tool,
    {
      type: 'item.completed',
      item: { type: 'agent_message', text: 'Final confirmed handoff.' },
    },
    { type: 'turn.completed', usage: { input_tokens: 100, output_tokens: 10 } },
  ]
    .map((e) => JSON.stringify(e))
    .join('\n');
  assert.equal(finalHandoff(transcript), 'Final confirmed handoff.');
});
test('handles supported final-answer modes and rejects ambiguous mixed logs', () => {
  assert.equal(
    finalHandoff(
      JSON.stringify({
        type: 'message_end',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Pi final answer' }],
        },
      }),
    ),
    'Pi final answer',
  );
  assert.equal(
    finalHandoff(
      JSON.stringify({ type: 'result', text: 'Native final answer' }),
    ),
    'Native final answer',
  );
  assert.equal(finalHandoff('Plain final answer\n'), 'Plain final answer');
  assert.throws(
    () =>
      finalHandoff(
        'Progress log\n' +
          JSON.stringify({ type: 'tool_result', text: 'Not an answer' }),
      ),
    /unsupported/,
  );
});
