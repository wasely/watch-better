export const CUTTHROUGH_OPENAI_MODEL = 'gpt-5.6';
export const MAX_CHAT_MESSAGE_CHARACTERS = 24_000;

export interface OpenAIChatRequest {
  readonly credential: string;
  readonly message: string;
  readonly previousResponseId: string | null;
  readonly safetyIdentifier: string;
}

export interface OpenAIChatResult {
  readonly text: string;
  readonly responseId: string;
  readonly model: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const extractOpenAIResponseText = (value: unknown): string => {
  if (!isRecord(value) || !Array.isArray(value.output)) return '';
  const parts: string[] = [];
  for (const item of value.output) {
    if (!isRecord(item) || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (
        isRecord(content) &&
        content.type === 'output_text' &&
        typeof content.text === 'string'
      )
        parts.push(content.text);
    }
  }
  return parts.join('\n').trim();
};

export const sendOpenAIChat = async (
  request: OpenAIChatRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<OpenAIChatResult> => {
  const body: Record<string, unknown> = {
    model: CUTTHROUGH_OPENAI_MODEL,
    instructions:
      "You are CutThrough's embedded video assistant. Treat the supplied transcript as the source of truth. Answer the user's question directly, cite useful timestamps, and say when the transcript does not establish an answer.",
    input: request.message,
    store: true,
    reasoning: { effort: 'low' },
    text: { verbosity: 'medium' },
    safety_identifier: request.safetyIdentifier,
  };
  if (request.previousResponseId)
    body.previous_response_id = request.previousResponseId;

  const response = await Reflect.apply(fetchImpl, globalThis, [
    'https://api.openai.com/v1/responses',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${request.credential}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  ]);
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      isRecord(payload) &&
      isRecord(payload.error) &&
      typeof payload.error.message === 'string'
        ? payload.error.message
        : `OpenAI request failed (${response.status}).`;
    throw new Error(message);
  }
  if (!isRecord(payload) || typeof payload.id !== 'string')
    throw new Error('OpenAI returned an invalid response.');
  const text = extractOpenAIResponseText(payload);
  if (!text) throw new Error('OpenAI returned no answer text.');
  return {
    text,
    responseId: payload.id,
    model: typeof payload.model === 'string' ? payload.model : CUTTHROUGH_OPENAI_MODEL,
  };
};
