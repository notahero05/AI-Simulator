// ============================================================================
// CẤU HÌNH API GEMINI — NGUỒN DUY NHẤT cho model, safety và generationConfig.
// Yêu cầu Gemini được chuyển tiếp qua geminiFetch() -> Canvas Bridge.
// Game luôn gửi đủ model + safetySettings trong payload; canvas_bridge.tsx
// chỉ chuyển tiếp (giữ API key và Firebase), KHÔNG có giá trị mặc định riêng.
// ============================================================================
const CANVAS_URL = 'https://share.gemini.google/EEYolO1w17FQ';

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


// ============================================================================
// [2] LỰA CHỌN THIẾT LẬP GAME
// Danh sách cho các dropdown ở màn thiết lập; phần tử [0] cũng là giá trị mặc định.
// ============================================================================

const LANGUAGE_DICTIONARIES = ["Hán Cổ (Tiên Hiệp, Cổ Đại, Giang Hồ)",
  "Trung Quốc Hiện Đại (Đô Thị, Tổng Tài)",
  "Nhật Bản (Light Novel, Anime, Samurai)",
  "Hàn Quốc (Manhwa, Thợ Săn, Tài Phiệt)",
  "Việt Cổ (Dã Sử, Cổ Tích, Phong Kiến)",
  "Việt Nam Hiện Đại (Đời Thường, Giang Hồ, Học Đường)",
  "Phương Tây (Ma Pháp, Hiệp Sĩ, Quý Tộc, Sci-Fi)"];

const DRAMA_LEVELS = ["Không Drama (Dưỡng Sinh, Bình Yên)",
  "Drama Ít (Thỉnh thoảng có sự cố nhỏ)",
  "Drama Vừa (Cân bằng, có nút thắt logic)",
  "Drama Nhiều (Nguy hiểm rình rập, âm mưu)",
  "Drama Cực Kỳ Nhiều (Sinh tồn khắc nghiệt, liên tục biến cố)"];

const WRITING_STYLES = ["Mặc định (Tiểu thuyết mạng)",
  "Văn phong Light Novel Nhật Bản (Hiện đại)",
  "Tiên Hiệp Cổ Điển (Trang trọng, Hán Việt)",
  "Hài Hước Sảng Văn (Hài hước, nhiều tình tiết bựa)",
  "Nội Tâm Sâu Sắc (Tập trung vào suy nghĩ NV)",
  "Tả Thực Tàn Khốc (Mô tả chi tiết, trần trụi)",
  "Võng Du (Thuật ngữ game, bảng trạng thái)"];

const PRONOUN_CONTEXTS = ["Tiên Hiệp / Huyền Huyễn (Tu chân, Hán Việt)",
  "Cổ Đại / Quân Sự Trung Quốc (Triều đình, Tướng quân, Hán Cổ)",
  "Võ Hiệp / Giang Hồ (Hiệp khách, Bang phái)",
  "Ma Pháp Phương Tây (Kỵ sĩ, Lãnh chúa, Phù thủy)",
  "Nhật Bản Cổ Đại (Shogun, Samurai, Ninja)",
  "Nhật Bản Hiện Đại (Anime, Manga, Học đường)",
  "Đô Thị Trung Quốc (Hiện đại, Tổng tài, Đô thị tu tiên)"];


// ============================================================================
// [3] TRUY HỒI & TRÍ NHỚ
// Từ điển dừng, nhóm đồng nghĩa, ngưỡng điểm và hạn mức cắt ngữ cảnh.
// ============================================================================

const VIETNAMESE_STOP_WORDS = new Set(["bị",
  "bởi",
  "cả",
  "các",
  "cái",
  "cần",
  "càng",
  "chỉ",
  "chiếc",
  "cho",
  "chứ",
  "chưa",
  "có",
  "có thể",
  "cứ",
  "của",
  "cùng",
  "cũng",
  "đã",
  "đang",
  "đây",
  "để",
  "đến",
  "đều",
  "điều",
  "do",
  "đó",
  "được",
  "gì",
  "khi",
  "không",
  "là",
  "lại",
  "lên",
  "lúc",
  "mà",
  "mỗi",
  "một",
  "nên",
  "nếu",
  "ngay",
  "nhiều",
  "như",
  "nhưng",
  "những",
  "nơi",
  "nữa",
  "phải",
  "qua",
  "ra",
  "rằng",
  "rất",
  "rồi",
  "sau",
  "sẽ",
  "số",
  "tại",
  "theo",
  "thì",
  "trên",
  "trước",
  "từ",
  "từng",
  "và",
  "vẫn",
  "vào",
  "vậy",
  "vì",
  "việc",
  "với",
  "vừa"]);

// Mẫu ký tự dùng để tách từ tiếng Việt (đi kèm VIETNAMESE_STOP_WORDS ở trên).
const VIETNAMESE_WORD_PATTERN = "[a-zàáâãèéêìíòóôõùúăđĩũơưăạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳýỵỷỹ]+";
const VIETNAMESE_WORD_REGEX = new RegExp(VIETNAMESE_WORD_PATTERN, "g");

const RECALL_STOP_WORDS = new Set(["va",
  "la",
  "cua",
  "cho",
  "voi",
  "mot",
  "nhung",
  "cac",
  "nhieu",
  "nay",
  "kia",
  "do",
  "ay",
  "roi",
  "da",
  "dang",
  "se",
  "bi",
  "boi",
  "tai",
  "tu",
  "den",
  "di",
  "ve",
  "ra",
  "vao",
  "tren",
  "duoi",
  "trong",
  "ngoai",
  "gi",
  "nao",
  "sao",
  "the",
  "thi",
  "ma",
  "neu",
  "khi",
  "sau",
  "truoc",
  "cung",
  "rat",
  "hon",
  "nhat",
  "duoc",
  "khong",
  "chua",
  "tung",
  "hay",
  "hoac",
  "ta",
  "toi",
  "nguoi",
  "han",
  "nang",
  "ho",
  "hắn",
  "nàng"]);

const RECALL_SYNONYM_GROUPS = [["nhan",
    "tiep nhan",
    "duoc giao",
    "nhan lay",
    "trao",
    "giao",
    "tang",
    "dua",
    "ban giao",
    "trao cho"],
  ["hua",
    "loi hua",
    "the",
    "the nguyen",
    "cam ket",
    "hen"],
  ["bi mat",
    "than phan that",
    "chan tuong",
    "bi lo",
    "tiet lo",
    "giu kin"],
  ["vet nut",
    "vet ran",
    "vet rach",
    "sẹo",
    "vet seo",
    "dau vet",
    "dau an"],
  ["chet",
    "tu vong",
    "thiet mang",
    "bi giet",
    "hy sinh",
    "mat mang",
    "hoi sinh",
    "phuc sinh"],
  ["so huu",
    "nam giu",
    "cam giu",
    "nguoi giu",
    "thuoc ve",
    "trong tay",
    "mat di",
    "that lac"],
  ["gap",
    "tung gap",
    "lan dau gap",
    "cuu",
    "cuu mang",
    "giup do",
    "phan boi",
    "phu bac"]];

const MEMORY_AUDIT_REQUIRED_CHECKS = ["timeline",
  "character_knowledge",
  "character_status",
  "item_ownership",
  "promises_secrets",
  "exact_details"];

// Kích thước tối đa (ký tự) của một đoạn truyện khi chia để truy hồi.
const STORY_CHUNK_SIZE = 1050;

// Hạn mức truy hồi lai: lượt thường / lượt kiểm chứng lại (rộng hơn).
const RECALL_LIMITS = { maxChunks: 12, maxPerTurn: 2, maxFacts: 12 };
const RECALL_LIMITS_DEEP = { maxChunks: 18, maxPerTurn: 3, maxFacts: 18 };

// Ngưỡng điểm liên quan và mức cộng điểm khi mở rộng theo thực thể liên quan.
const RECALL_MIN_SCORE = 0.2;
const RECALL_EXPAND_MIN_SCORE = 0.15;
const RECALL_EXPAND_BOOST = 0.2;

// Giới hạn ký tự JSON gửi cho bộ kiểm chứng trí nhớ.
const VERIFIER_CANDIDATE_JSON_MAX = 12000;
const VERIFIER_BASE_JSON_MAX = 16000;

// Số lượt hội thoại gần nhất gửi kèm, và số dòng nhật ký phụ đưa vào prompt.
const CONVERSATION_WINDOW_TURNS = 21;
const SUB_LOG_LIMIT = 30;

// TextRankSummarizer: tham số mặc định của lớp và số câu tóm tắt mỗi cảnh.
const TEXTRANK_ITERATIONS = 20;
const TEXTRANK_DAMPING = 0.85;
const TEXTRANK_TOLERANCE = 0.0001;
const TEXTRANK_SUMMARY_SENTENCES = 3;

// HNSW_Simulator: hệ số phân rã khi bốc tầng ngẫu nhiên.
const HNSW_LAYER_DECAY = 0.5;