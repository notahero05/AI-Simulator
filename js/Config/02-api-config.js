// ============================================================================
// CẤU HÌNH API GEMINI — NGUỒN DUY NHẤT cho model, safety và generationConfig.
// Yêu cầu Gemini được chuyển tiếp qua geminiFetch() -> Canvas Bridge.
// Game luôn gửi đủ model + safetySettings trong payload; canvas_bridge.tsx
// chỉ chuyển tiếp (giữ API key và Firebase), KHÔNG có giá trị mặc định riêng.
// ============================================================================
const CANVAS_URL = 'https://share.gemini.google/3PWeadC0NVee';

const GEMINI_MODEL_ID = "gemini-2.5-flash";
const GEMINI_MAX_OUTPUT_TOKENS = 32000;
const GEMINI_THINKING_BUDGET_HIGH = 24000;
const GEMINI_THINKING_BUDGET_NONE = 0;
const GEMINI_FAST_MAX_OUTPUT_TOKENS = 8192;

const BLOCK_NONE_SAFETY = [
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
];

// Preset cho tác vụ nhanh (gợi ý, tiểu sử, mục tiêu, kiểm chứng): không "suy nghĩ", ngắn.
const buildFastGenerationConfig = () => ({
  temperature: 0.7,
  maxOutputTokens: GEMINI_FAST_MAX_OUTPUT_TOKENS,
  thinkingConfig: {
    thinkingBudget: GEMINI_THINKING_BUDGET_NONE,
  },
});

// Preset cho tác giả (Writer) viết truyện: dài, suy nghĩ nhiều.
const buildWriterGenerationConfig = () => ({
  temperature: 0.7,
  topP: 0.85,
  topK: 40,
  maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
  thinkingConfig: {
    thinkingBudget: GEMINI_THINKING_BUDGET_HIGH,
  },
});