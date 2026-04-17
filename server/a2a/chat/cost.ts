import log from '../../utils/log.js';

export type UsageMetadata = {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
};

function numberFromEnv(name: string): number | undefined {
    const raw = process.env[name];
    if (raw === undefined || raw === "") return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
}

/**
 * Compute "credits" to subtract from the account.
 *
 * In this codebase, credits are stored as a plain number; we treat them as USD-equivalent.
 * Configure pricing via env:
 * - GEMINI_INPUT_USD_PER_1M_TOKENS
 * - GEMINI_OUTPUT_USD_PER_1M_TOKENS
 */
export function computeTokenCost(model: string, usage?: UsageMetadata | null): number {
    if (!usage) return 0;

    const promptTokens = usage.promptTokenCount ?? 0;
    const outputTokens = usage.candidatesTokenCount ?? 0;

    const inputUsdPer1M = numberFromEnv("GEMINI_INPUT_USD_PER_1M_TOKENS") ?? 0.25;
    const outputUsdPer1M = numberFromEnv("GEMINI_OUTPUT_USD_PER_1M_TOKENS") ?? 1.50;

    if (inputUsdPer1M === 0 && outputUsdPer1M === 0) {
        log.warn(`No Gemini pricing configured; cost will be 0. Set GEMINI_INPUT_USD_PER_1M_TOKENS / GEMINI_OUTPUT_USD_PER_1M_TOKENS. model=${model}`);
        return 0;
    }

    const cost =
        (promptTokens / 1_000_000) * inputUsdPer1M +
        (outputTokens / 1_000_000) * outputUsdPer1M;

    return Number.isFinite(cost) ? cost : 0;
}