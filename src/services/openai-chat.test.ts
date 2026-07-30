import { describe, expect, it, vi } from 'vitest';

import { extractOpenAIResponseText, sendOpenAIChat } from './openai-chat';

describe('OpenAI chat service', () => {
  it('extracts text content from a Responses API payload', () => {
    expect(
      extractOpenAIResponseText({
        output: [
          { content: [{ type: 'output_text', text: 'First' }] },
          { content: [{ type: 'output_text', text: 'Second' }] },
        ],
      }),
    ).toBe('First\nSecond');
  });

  it('sends bounded conversation state without exposing the key in the body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'resp_next',
          model: 'gpt-5.6-sol',
          output: [{ content: [{ type: 'output_text', text: 'Answer [01:20]' }] }],
        }),
        { status: 200 },
      ),
    );

    const result = await sendOpenAIChat(
      {
        credential: 'sk-test',
        message: 'Question with transcript',
        previousResponseId: 'resp_previous',
        safetyIdentifier: 'install-id',
      },
      fetchMock,
    );

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    if (typeof request.body !== 'string')
      throw new Error('Expected JSON request body.');
    const body = JSON.parse(request.body) as Record<string, unknown>;
    expect(request.headers).toMatchObject({ Authorization: 'Bearer sk-test' });
    expect(body).toMatchObject({
      model: 'gpt-5.6',
      input: 'Question with transcript',
      previous_response_id: 'resp_previous',
      safety_identifier: 'install-id',
    });
    expect(JSON.stringify(body)).not.toContain('sk-test');
    expect(result).toEqual({
      text: 'Answer [01:20]',
      responseId: 'resp_next',
      model: 'gpt-5.6-sol',
    });
  });

  it('surfaces API error messages', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'Invalid API key.' } }), {
        status: 401,
      }),
    );
    await expect(
      sendOpenAIChat(
        {
          credential: 'bad',
          message: 'Hello',
          previousResponseId: null,
          safetyIdentifier: 'install-id',
        },
        fetchMock,
      ),
    ).rejects.toThrow('Invalid API key.');
  });
});
