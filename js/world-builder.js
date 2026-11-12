// ============================================================================
// WORLD-BUILDER — DỰNG THẾ GIỚI MỞ ĐẦU (AI 0 - WORLD DIRECTOR) & CÔNG CỤ HỖ TRỢ
// Tách riêng phần build thế giới mở đầu ra một file (không đụng prompts.js).
// Nạp SAU 02-api-config.js + firebase.js + prompts.js, TRƯỚC game.js.
//
// Nội dung (bê từ v196 về, đã lược bỏ tiền tệ / thể lực / avatar / đồng nhân):
//   1. Random ngày giờ khởi đầu + tự dò năm từ bối cảnh.
//   2. AI 0 — World Director 3 giai đoạn TUẦN TỰ (OUTLINE → DETAIL → CONNECT).
//   3. buildWorldContextForConsumer: digest theo người nhận (writer / verifier).
//   4. Seed thực thể ban đầu vào kho + dựng canonical fact chuẩn.
//   5. Prompt điền nền NPC / nhân vật chính (chạy nền sau khi mở đầu xong).
//
// QUY TẮC ĐÃ CHỐT VỚI NGƯỜI CHƠI:
//   • AI 0 chạy ĐÚNG 3 lần nối tiếp như v196 (không gộp) — chờ lâu không sao.
//   • Kết quả AI 0 CHỈ LÀ GỢI Ý — cổng kiểm chứng trí nhớ KHÔNG đối chiếu gắt.
//   • Thực thể người chơi tự tạo LÀ sự thật chuẩn (ghi thành canonical fact).
//   • Không có công tắc "Dựng thế giới chi tiết" (luôn chạy khi tạo game mới).
//   • AI 0 lỗi KHÔNG được crash game — để ngữ cảnh rỗng rồi chơi tiếp.
// ============================================================================
'use strict';

const WB = (function () {

  // ------------------------------------------------------------------
  // 0. TIỆN ÍCH GỌI GEMINI (qua Canvas Bridge — geminiFetch ở firebase.js)
  // ------------------------------------------------------------------
  async function callGeminiText(promptText, generationConfig) {
    const payload = {
      contents: [{ role: 'user', parts: [{ text: promptText }] }],
      generationConfig: generationConfig || buildFastGenerationConfig(),
      safetySettings: BLOCK_NONE_SAFETY
    };
    const res = await geminiFetch(GEMINI_MODEL_ID, payload);
    if (!res.ok) throw new Error('Gemini API lỗi: ' + res.status);
    const body = await res.text();
    let json = null;
    try { json = JSON.parse(body); } catch (_) { throw new Error('Gemini trả về không phải JSON.'); }
    const parts = (json && json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts) || [];
    // Với model suy nghĩ: parts có thể chứa thought — chỉ lấy part có text thật
    let text = '';
    const realParts = parts.filter(p => p && p.text && !p.thought);
    if (realParts.length > 0) text = realParts[realParts.length - 1].text;
    else { const p = parts.find(p => p && p.text); text = p ? p.text : ''; }
    if (!text) {
      const reason = (json && json.promptFeedback && json.promptFeedback.blockReason)
        || (json && json.candidates && json.candidates[0] && json.candidates[0].finishReason)
        || 'phản hồi rỗng';
      throw new Error('Gemini không trả nội dung: ' + reason);
    }
    return text;
  }

  // Bóc JSON từ text AI (chấp nhận bọc ```json, văn xuôi thừa quanh JSON).
  function parseJson(text) {
    if (!text) return null;
    let s = String(text).trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '');
    try { return JSON.parse(s); } catch (_) { /* rơi xuống regex */ }
    const objMatch = s.match(/\{[\s\S]*\}/);
    if (objMatch) { try { return JSON.parse(objMatch[0]); } catch (_) {} }
    const arrMatch = s.match(/\[[\s\S]*\]/);
    if (arrMatch) { try { return JSON.parse(arrMatch[0]); } catch (_) {} }
    return null;
  }

  // ------------------------------------------------------------------
  // 1. NGÀY GIỜ KHỞI ĐẦU — random + tự dò năm từ bối cảnh
  //    (bản cũ luôn bắt đầu 1/1/năm 1 — rất giả trân)
  // ------------------------------------------------------------------
  function randomizeWorldTime(worldTime, setting) {
    const wt = Object.assign({ day: 1, month: 1, year: 1 }, worldTime || {});
    const isLeap = (yr) => (yr % 4 === 0 && yr % 100 !== 0) || yr % 400 === 0;
    // Chỉ random khi người chơi chưa đặt ngày (mặc định 1/1)
    if (wt.month <= 1 && wt.day <= 1) {
      const yearForFeb = wt.year > 1 ? wt.year : 2024; // fallback an toàn cho tháng 2
      const daysInMonth = [0, 31, isLeap(yearForFeb) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      const month = Math.floor(Math.random() * 12) + 1;
      wt.month = month;
      wt.day = Math.floor(Math.random() * daysInMonth[month]) + 1;
      wt.hour = Math.floor(Math.random() * 17) + 6;      // 6h–22h
      wt.minute = [0, 0, 0, 15, 30, 45][Math.floor(Math.random() * 6)];
    }
    if (wt.year <= 1 && setting) {
      const m = String(setting).match(/\b(\d{4})\b/);     // ví dụ "Hà Nội năm 2025"
      if (m) {
        const year = parseInt(m[1], 10);
        if (year > 1) {
          if (wt.month === 2 && wt.day > 28 && !isLeap(year)) wt.day = 28;
          wt.year = year;
        }
      }
    }
    return wt;
  }

  // Áp dụng năm do AI 0 suy luận (gọi sau Giai đoạn 1).
  function applySuggestedYear(worldTime, suggestedYear) {
    // Model có thể trả "năm 1234" / "1234" / 1234 — trích cụm số đầu tiên
    const m = String(suggestedYear != null ? suggestedYear : '').match(/\d{3,4}/);
    const year = m ? parseInt(m[0], 10) : NaN;
    const wt = Object.assign({}, worldTime || {});
    if (!(year > 1)) return wt;
    const isLeap = (yr) => (yr % 4 === 0 && yr % 100 !== 0) || yr % 400 === 0;
    if (wt.month === 2 && wt.day > 28 && !isLeap(year)) wt.day = 28;
    wt.year = year;
    return wt;
  }

  // ------------------------------------------------------------------
  // 2. AI 0 — WORLD DIRECTOR (3 GIAI ĐOẠN TUẦN TỰ)
  //    Mỗi giai đoạn: gọi Gemini → parse JSON → trả { map, raw }.
  //    Lỗi giai đoạn nào: bỏ qua giai đoạn đó, KHÔNG throw.
  // ------------------------------------------------------------------
  function buildAi0SharedHeader(gameSettings, worldTime, worldKnowledge) {
    const gs = gameSettings || {};
    const wt = worldTime || { day: 1, month: 1, year: 1 };
    const elements = (gs.initialWorldElements || [])
      .map(el => `- [${el.type}] ${el.name}${el.description ? `: ${el.description}` : ''}${el.personality ? ` | Tính cách: ${el.personality}` : ''}`)
      .join('\n') || 'Không có phần tử khởi đầu.';
    const worldRules = (worldKnowledge || [])
      .filter(r => r && r.enabled !== false)
      .map(r => {
        if (r.type === 'FACT') return `- [SỰ THẬT]: (${r.subject || '?'}) -[${r.verb || '?'}]-> (${r.object || '?'})${r.content ? ` — ${r.content}` : ''}`;
        if (r.type === 'CONDITIONAL') return `- [ĐIỀU KIỆN]: NẾU (${r.condition || '?'}) THÌ (${r.effect || '?'})`;
        if (r.type === 'RELATIONSHIP') return `- [QUAN HỆ]: (${r.subject || '?'}) -[${r.verb || '?'}]-> (${r.object || '?'})`;
        return `- [LUẬT]: ${r.content || '(trống)'}`;
      }).join('\n') || 'Không có luật thế giới nào.';
    return `=== DỮ LIỆU THIẾT LẬP GAME ===
• Thể loại: ${gs.theme || 'Chưa xác định'}
• Bối cảnh thế giới (ĐỌC TOÀN BỘ):
${gs.setting || 'Chưa xác định'}
• Phong cách kể chuyện: ${gs.writingStyle || 'Mặc định'}
• Từ điển ngôn ngữ/văn phong: ${gs.languageDictionary || 'Mặc định'}
• Xưng hô: ${gs.pronounContext || 'Mặc định'}
• Mức drama: ${gs.dramaLevel || 'Mặc định'}
• Nhân vật chính: ${gs.characterName || 'Chưa đặt tên'} (${gs.characterGender || 'Không xác định'})
  Tiểu sử (ĐỌC TOÀN BỘ):
${gs.characterBackstory || 'Không có'}
• Mục tiêu nhân vật: ${gs.useCharacterGoal ? (gs.characterGoal || 'Tự do') : 'Tự do'}
• Kỹ năng mong muốn: ${gs.preferredInitialSkill || 'Để AI quyết định'}
• Độ khó: ${gs.difficulty || 'Thường'}${gs.difficultyDescription ? ` — ${gs.difficultyDescription}` : ''}
• Thời điểm khởi đầu: Ngày ${wt.day} Tháng ${wt.month}${wt.year > 1 ? ` Năm ${wt.year}` : ' (Năm chưa xác định — CẦN SUY LUẬN)'}, ${String(wt.hour != null ? wt.hour : 8).padStart(2, '0')}:${String(wt.minute != null ? wt.minute : 0).padStart(2, '0')}
=== LUẬT/QUY TẮC THẾ GIỚI (NGƯỜI CHƠI NHẬP) ===
${worldRules}
=== CÁC YẾU TỐ KHỞI ĐẦU (NGƯỜI CHƠI TẠO) ===
${elements}`;
  }

  async function callAi0Stage(promptText, generationConfig, stageLabel) {
    try {
      const raw = await callGeminiText(promptText, generationConfig);
      const map = parseJson(raw);
      if (!map) console.warn(`[AI 0 - ${stageLabel}] Parse JSON thất bại. Raw (200 ký tự cuối):`, String(raw).slice(-200));
      return { map: map || {}, raw };
    } catch (err) {
      console.warn(`[AI 0 - ${stageLabel}] Lỗi:`, err && err.message);
      return { map: {}, raw: '' };
    }
  }

  async function callAI0WorldDirector(opts) {
    const gameSettings = (opts && opts.gameSettings) || {};
    const worldKnowledge = (opts && opts.worldKnowledge) || [];
    let worldTime = (opts && opts.worldTime) || { day: 1, month: 1, year: 1 };
    const onProgress = (opts && opts.onProgress) || function () {};
    const yearIsDefault = !(worldTime.year > 1);
    const header = buildAi0SharedHeader(gameSettings, worldTime, worldKnowledge);

    // ===== GIAI ĐOẠN 1 — OUTLINE =====
    onProgress('AI 0 — Giai đoạn 1/3: Dựng khung thế giới...');
    const promptStage1 = `Ngươi là AI 0 — Giai đoạn 1/3 OUTLINE (ĐẠO DIỄN THẾ GIỚI). Đọc dữ liệu thiết lập và xuất JSON cho các trường khung thế giới.
${header}
=== NHIỆM VỤ: Xuất JSON chỉ gồm các trường sau (KHÔNG markdown, KHÔNG giải thích; SỐ LƯỢNG: world_laws 5-12 mục, key_mechanics ≤ 6) ===
{
  "world_name": "Tên thế giới/bối cảnh ngắn gọn",
  "genre_tone": "Thể loại và giọng điệu chủ đạo — đủ màu sắc thế giới, mức tối tăm/khắc nghiệt (3-4 câu)",
  "suggested_year": ${yearIsDefault ? `0` : worldTime.year},
  "time_system": {
    "calendar_name": "Tên lịch pháp",
    "current_date_ingame": "Ngày ${worldTime.day} Tháng ${worldTime.month} Năm [điền từ suggested_year]",
    "current_time_ingame": "${String(worldTime.hour != null ? worldTime.hour : 8).padStart(2, '0')}:${String(worldTime.minute != null ? worldTime.minute : 0).padStart(2, '0')}",
    "time_flow_note": "Cách tính thời gian, mùa, thời đại, mốc lịch sử"
  },
  "world_laws": ["Từ 5-12 luật vật lý/ma pháp/công nghệ/xã hội suy ra từ bối cảnh và luật người chơi nhập"],
  "power_system": "Hệ thống sức mạnh/cấp bậc: class, rank, cơ chế thức tỉnh, điều kiện đặc biệt (4-6 câu). Nếu thế giới không có, ghi 'Không có'.",
  "key_mechanics": ["Cơ chế/hệ thống đặc biệt của thế giới"],
  "social_structure": "Cấu trúc xã hội, chính trị, tôn giáo, giai cấp (3-5 câu)",
  "processed_world_rules": ["Chuẩn hóa lại LUẬT/QUY TẮC THẾ GIỚI do người chơi nhập ở trên: sửa lỗi diễn đạt, gộp trùng, tách ý — GIỮ NGUYÊN ý nghĩa gốc, KHÔNG sáng tác thêm luật mới. Không có thì trả []"]
}
VÍ DỤ FORMAT (CHỈ MINH HỌA CẤU TRÚC): {"world_name":"...","genre_tone":"...","suggested_year":1234,"time_system":{"calendar_name":"...","current_date_ingame":"...","current_time_ingame":"...","time_flow_note":"..."},"world_laws":["..."],"power_system":"...","key_mechanics":["..."],"social_structure":"...","processed_world_rules":["..."]}
🔴 QUY TẮC suggested_year: ${yearIsDefault ? 'TUYỆT ĐỐI KHÔNG trả về 0 hay 1 hoặc kèm chữ. Suy luận MỘT số nguyên dương từ bối cảnh (ví dụ: cổ trang Trung Hoa → năm phong kiến hợp lý; hiện đại → năm gần hiện tại).' : `Giữ nguyên ${worldTime.year}.`}
🔴 QUY TẮC world_laws: bám sát bối cảnh và luật người chơi đã nhập, không mâu thuẫn với chúng.`;
    const stage1Cfg = { temperature: 0.1, maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: GEMINI_THINKING_BUDGET_HIGH } };
    const { map: stage1 } = await callAi0Stage(promptStage1, stage1Cfg, 'Giai đoạn 1 OUTLINE');

    // Suy luận năm ngay sau Giai đoạn 1 (như v196)
    if (yearIsDefault && stage1 && stage1.suggested_year != null) {
      worldTime = applySuggestedYear(worldTime, stage1.suggested_year);
    }
    const finalYear = worldTime.year;

    // ===== GIAI ĐOẠN 2 — DETAIL =====
    onProgress('AI 0 — Giai đoạn 2/3: Đào sâu địa lý/lịch sử/văn hóa...');
    const stage1Summary = `=== KẾT QUẢ GIAI ĐOẠN 1 (OUTLINE) — DÙNG LÀM NỀN, KHÔNG MÂU THUẪN ===
Tên thế giới: ${(stage1 && stage1.world_name) || ''}
Giọng điệu: ${(stage1 && stage1.genre_tone) || ''}
Luật thế giới: ${((stage1 && stage1.world_laws) || []).join('; ')}
Hệ thống sức mạnh: ${(stage1 && stage1.power_system) || ''}
Cơ chế đặc biệt: ${((stage1 && stage1.key_mechanics) || []).join('; ')}
Cấu trúc xã hội: ${(stage1 && stage1.social_structure) || ''}`;
    const promptStage2 = `Ngươi là AI 0 — Giai đoạn 2/3 DETAIL — chuyên gia ĐÀO SÂU thế giới học. Mức chi tiết: tương đương tiểu thuyết high-fantasy chính trị phức tạp — mỗi vùng đất có lịch sử riêng, mỗi phe phái có mục tiêu và bí mật riêng, mâu thuẫn hiện tại bắt nguồn rõ ràng từ lịch sử. KHÔNG viết chung chung kiểu "có nhiều xung đột" — phải cụ thể: xung đột gì, giữa ai, vì sao, từ khi nào.
${header}
${stage1Summary}
=== NHIỆM VỤ: Xuất JSON chỉ gồm các trường sau (KHÔNG markdown, KHÔNG giải thích; SỐ LƯỢNG: history_timeline ≤ 10 mốc, key_locations 6-10, current_tensions 4-6, world_rules_interpretation 1 câu/luật ≤ 12) ===
{
  "geography": "Địa lý: lục địa, khí hậu, sông ngòi, tài nguyên, vị trí các vương quốc/thành bang",
  "history_timeline": ["Tối đa 10 mốc lịch sử định hình thế giới, mỗi mốc 1 câu: thời gian + sự kiện + hệ quả"],
  "cultures_and_factions": "Văn hóa, tín ngưỡng, ngôn ngữ, phong tục theo từng khu vực/chủng tộc",
  "current_tensions": ["Các mâu thuẫn đang âm ỉ: tranh chấp biên giới, khủng hoảng, bất ổn, âm mưu — mỗi mục 1-2 câu"],
  "key_locations": [{"name": "", "type": "", "description": "1-2 câu", "danger_level": ""}],
  "magic_or_tech_system": "Nguồn gốc, giới hạn, giá phải trả, ai dùng được, tác động xã hội (nếu thế giới không có hệ thống sức mạnh thì để rỗng)",
  "world_rules_interpretation": ["Với MỖI luật ở world_laws Giai đoạn 1 (mỗi luật 1 câu), giải thích: luật này tồn tại vì lý do gì trong lịch sử/xã hội — KHÔNG bỏ luật nào. Nếu GĐ1 không có luật, suy luận 5-8 luật nền tảng."]
}
VÍ DỤ FORMAT (CHỈ MINH HỌA CẤU TRÚC): {"geography":"...","history_timeline":["..."],"cultures_and_factions":"...","current_tensions":["..."],"key_locations":[{"name":"","type":"","description":"","danger_level":""}],"magic_or_tech_system":"...","world_rules_interpretation":["..."]}`;
    const stage2Cfg = { temperature: 0.7, maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: GEMINI_THINKING_BUDGET_NONE } };
    const { map: stage2 } = await callAi0Stage(promptStage2, stage2Cfg, 'Giai đoạn 2 DETAIL');

    // ===== GIAI ĐOẠN 3 — CONNECT =====
    onProgress('AI 0 — Giai đoạn 3/3: Kết nối nhân vật & phe phái...');
    const stage2Summary = `=== KẾT QUẢ GIAI ĐOẠN 2 (DETAIL) — DÙNG LÀM NỀN, KHÔNG MÂU THUẪN ===
Địa lý: ${(stage2 && stage2.geography) || ''}
Mốc lịch sử: ${((stage2 && stage2.history_timeline) || []).join(' | ')}
Văn hóa: ${(stage2 && stage2.cultures_and_factions) || ''}
Mâu thuẫn hiện tại: ${((stage2 && stage2.current_tensions) || []).join(' | ')}
Địa điểm trọng yếu: ${((stage2 && stage2.key_locations) || []).map(l => l && l.name).join(', ')}`;
    const promptStage3 = `Ngươi là AI 0 — Giai đoạn 3/3 CONNECT — chuyên gia XÂY DỰNG NHÂN VẬT, PHE PHÁI & CHỈ THỊ VẬN HÀNH. Đọc dữ liệu thiết lập và 2 giai đoạn trước, xuất JSON.
${header}
${stage1Summary}
${stage2Summary}
=== NHIỆM VỤ: Xuất JSON chỉ gồm các trường sau (KHÔNG markdown, KHÔNG giải thích; SỐ LƯỢNG: key_npcs ≤ 10, major_npcs_extended ≤ 6, faction_relations ≤ 8, random_encounter_table 5-8) ===
{
  "key_npcs": ["Tối đa 10 NPC khởi đầu — BẮT BUỘC ưu tiên các thực thể người chơi tự tạo nếu có trong dữ liệu: tên, mối quan hệ với NV chính, tính cách, hoàn cảnh, động lực. Mỗi NPC 1-2 câu"],
  "mc_profile": "Hồ sơ nhân vật chính: tên, giới tính, tuổi (nếu biết), đặc điểm nổi bật, hoàn cảnh xuất thân, điểm yếu, hạn chế cứng",
  "starting_context": "Ngữ cảnh khởi đầu — NV chính đang ở đâu, làm gì, áp lực gì đang đến gần (3-4 câu)",
  "difficulty_directive": "Độ khó môi trường: ${gameSettings.difficulty || 'Thường'}. Dựng NPC/kẻ địch và bối cảnh khởi đầu phản ánh đúng mức độ này. Viết 2-3 câu chỉ thị về mức nguy hiểm của MÔI TRƯỜNG/KẺ ĐỊCH xung quanh — không nói về nhân vật chính.",
  "ai_directive": "Chỉ thị TỐI QUAN TRỌNG cho mọi AI kể chuyện: những thứ CẤM làm, BẮT BUỘC phải làm, lỗi phổ biến cần tránh. Dạng gạch đầu dòng, cụ thể",
  "major_npcs_extended": [{"name": "", "motivation": "", "secret": "", "weakness": "", "relation_to_other_npcs": ""}],
  "faction_relations": [{"faction_a": "", "faction_b": "", "relation_type": "đồng minh|thù địch|trung lập|ngầm xung đột", "reason": ""}],
  "starting_conflict_seed": "Điều gì sẽ xảy ra trong 5-10 lượt tới nếu NV chính không can thiệp — 3-4 câu cụ thể",
  "random_encounter_table": ["5-8 loại sự kiện ngẫu nhiên hợp lý ở khu vực khởi đầu"]
}
VÍ DỤ FORMAT (CHỈ MINH HỌA CẤU TRÚC): {"key_npcs":["..."],"mc_profile":"...","starting_context":"...","difficulty_directive":"...","ai_directive":"...","major_npcs_extended":[{"name":"","motivation":"","secret":"","weakness":"","relation_to_other_npcs":""}],"faction_relations":[{"faction_a":"","faction_b":"","relation_type":"thù địch","reason":""}],"starting_conflict_seed":"...","random_encounter_table":["..."]}`;
    const stage3Cfg = { temperature: 0.7, maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 8000 } };
    const { map: stage3, raw: rawStage3 } = await callAi0Stage(promptStage3, stage3Cfg, 'Giai đoạn 3 CONNECT');

    onProgress('');

    // ===== GỘP KẾT QUẢ → contextBlock (core) =====
    const worldMap = Object.assign({}, stage1, stage3);
    let contextBlock = '';
    if (worldMap && Object.keys(worldMap).length > 0) {
      contextBlock = `
=== 🌐 BẢN ĐỒ THẾ GIỚI (DO AI 0 - WORLD DIRECTOR THIẾT LẬP) ===
Tên thế giới: ${worldMap.world_name || ''}
Thể loại & Giọng điệu: ${worldMap.genre_tone || ''}
📅 HỆ THỐNG THỜI GIAN (TUÂN THỦ TUYỆT ĐỐI):
  • Lịch pháp: ${(worldMap.time_system && worldMap.time_system.calendar_name) || 'Lịch chuẩn'}
  • Thời điểm bắt đầu ván chơi: Ngày ${worldTime.day} Tháng ${worldTime.month} Năm ${finalYear}, ${String(worldTime.hour != null ? worldTime.hour : 8).padStart(2, '0')}:${String(worldTime.minute != null ? worldTime.minute : 0).padStart(2, '0')}
  • Lưu ý thời gian: ${(worldMap.time_system && worldMap.time_system.time_flow_note) || ''}
⚖️ LUẬT THẾ GIỚI:
${(worldMap.world_laws || []).map(l => `  • ${l}`).join('\n')}
⚔️ HỆ THỐNG SỨC MẠNH: ${worldMap.power_system || ''}
🏛️ CẤU TRÚC XÃ HỘI: ${worldMap.social_structure || ''}
${(worldMap.key_mechanics && worldMap.key_mechanics.length > 0) ? `\n⚙️ CƠ CHẾ ĐẶC BIỆT:\n${worldMap.key_mechanics.map(m => `  • ${m}`).join('\n')}` : ''}
${(worldMap.key_npcs && worldMap.key_npcs.length > 0) ? `\n👥 NPC KHỞI ĐẦU:\n${worldMap.key_npcs.map(n => `  • ${n}`).join('\n')}` : ''}
${worldMap.mc_profile ? `\n🧍 HỒ SƠ NHÂN VẬT CHÍNH:\n  ${worldMap.mc_profile}` : ''}
🎬 BỐI CẢNH KHỞI ĐẦU: ${worldMap.starting_context || ''}
${worldMap.difficulty_directive ? `\n⚔️ CHỈ THỊ ĐỘ KHÓ (BẮT BUỘC TUÂN THỦ):\n${worldMap.difficulty_directive}` : ''}
🔴 CHỈ THỊ TỐI CAO CHO MỌI AI:
${worldMap.ai_directive || ''}
=== HẾT BẢN ĐỒ THẾ GIỚI ===`.trim();
    } else if (rawStage3) {
      contextBlock = `=== 🌐 WORLD DIRECTOR CONTEXT (AI 0) ===\n${rawStage3}\n===`;
    }

    return {
      stage1: stage1 || {},
      stage2: stage2 || {},
      stage3: stage3 || {},
      contextBlock: contextBlock,
      suggestedYear: (stage1 && stage1.suggested_year != null) ? parseInt(stage1.suggested_year, 10) : null,
      worldTime: worldTime,
      createdAt: new Date().toISOString()
    };
  }

  // ------------------------------------------------------------------
  // 3. DIGEST THEO NGƯỜI NHẬN (bê ý tưởng buildWorldContextForConsumer)
  //    • 'writer'   : core + bách khoa FLAVOR (địa lý, lịch sử, NPC mở rộng...)
  //    • 'verifier' : core + luật & quan hệ phe phái (không văn miêu tả)
  //    Kết quả AI 0 CHỈ LÀ GỢI Ý — ghi rõ trong header để AI không coi là
  //    "sự thật chuẩn" đối chiếu gắt với người chơi.
  // ------------------------------------------------------------------
  function buildWorldContextForConsumer(consumer, wb) {
    if (!wb) return '';
    const core = wb.contextBlock || '';
    if (!core && consumer !== 'writer') return '';
    const s1 = wb.stage1 || {}, s2 = wb.stage2 || {}, s3 = wb.stage3 || {};

    const flavorParts = [];
    if (s2.geography) flavorParts.push(`🗺️ ĐỊA LÝ THẾ GIỚI:\n${s2.geography}`);
    if (Array.isArray(s2.history_timeline) && s2.history_timeline.length > 0) {
      const timeline = s2.history_timeline.length > 5 ? s2.history_timeline.slice(-5) : s2.history_timeline;
      flavorParts.push(`📜 MỐC LỊCH SỬ:\n${timeline.map(t => `  • ${t}`).join('\n')}`);
    }
    if (s2.cultures_and_factions) flavorParts.push(`🎭 VĂN HÓA & TÍN NGƯỠNG:\n${s2.cultures_and_factions}`);
    if (Array.isArray(s2.current_tensions) && s2.current_tensions.length > 0) {
      flavorParts.push(`⚡ MÂU THUẪN ĐANG ÂM Ỉ:\n${s2.current_tensions.slice(0, 6).map(t => `  • ${t}`).join('\n')}`);
    }
    if (Array.isArray(s2.key_locations) && s2.key_locations.length > 0) {
      flavorParts.push(`📍 ĐỊA ĐIỂM TRỌNG YẾU:\n${s2.key_locations.filter(Boolean).slice(0, 8).map(l => `  • ${l.name || '?'} (${l.type || '?'}, nguy hiểm: ${l.danger_level || '?'}): ${l.description || ''}`).join('\n')}`);
    }
    if (s2.magic_or_tech_system) flavorParts.push(`✨ HỆ THỐNG MA PHÁP/CÔNG NGHỆ:\n${s2.magic_or_tech_system}`);
    if (Array.isArray(s3.major_npcs_extended) && s3.major_npcs_extended.length > 0) {
      flavorParts.push(`👤 NPC MỞ RỘNG (động cơ/bí mật/điểm yếu — NPC KHÔNG TỰ BIẾT bí mật của nhau):\n${s3.major_npcs_extended.filter(Boolean).slice(0, 6).map(n => `  • ${n.name || '?'}: động cơ="${n.motivation || ''}", bí mật="${n.secret || ''}", điểm yếu="${n.weakness || ''}", quan hệ NPC khác="${n.relation_to_other_npcs || ''}"`).join('\n')}`);
    }
    if (s3.starting_conflict_seed) flavorParts.push(`🔥 HẠT GIỐNG XUNG ĐỘT (nếu NV chính không can thiệp):\n${s3.starting_conflict_seed}`);
    if (Array.isArray(s3.random_encounter_table) && s3.random_encounter_table.length > 0) {
      flavorParts.push(`🎲 SỰ KIỆN NGẪU NHIÊN KHU VỰC KHỞI ĐẦU:\n${s3.random_encounter_table.filter(Boolean).slice(0, 8).map(e => `  • ${e}`).join('\n')}`);
    }
    const flavor = flavorParts.join('\n');

    const rulesParts = [];
    if (Array.isArray(s2.world_rules_interpretation) && s2.world_rules_interpretation.length > 0) {
      rulesParts.push(`⚖️ DIỄN GIẢI LUẬT (lý do tồn tại):\n${s2.world_rules_interpretation.filter(Boolean).slice(0, 12).map(r => `  • ${r}`).join('\n')}`);
    }
    if (Array.isArray(s1.processed_world_rules) && s1.processed_world_rules.length > 0) {
      rulesParts.push(`📖 LUẬT NGƯỜI CHƠI (đã chuẩn hóa):\n${s1.processed_world_rules.filter(Boolean).slice(0, 12).map(r => `  • ${r}`).join('\n')}`);
    }
    if (Array.isArray(s3.faction_relations) && s3.faction_relations.length > 0) {
      rulesParts.push(`🤝 QUAN HỆ PHE PHÁI:\n${s3.faction_relations.filter(Boolean).slice(0, 10).map(r => `  • ${r.faction_a || '?'} ↔ ${r.faction_b || '?'}: ${r.relation_type || '?'} (${r.reason || ''})`).join('\n')}`);
    }
    const rules = rulesParts.join('\n');

    const notice = '[LƯU Ý: Toàn bộ khối trên là GỢI Ý THẾ GIỚI do AI 0 dựng lúc khởi tạo — dùng để văn bản nhất quán, KHÔNG phải dữ kiện chuẩn để từ chối/đối chiếu gắt lời kể. Thao tác cụ thể của người chơi và sự thật đã xác nhận LUÔN được ưu tiên hơn.]';

    if (consumer === 'verifier' || consumer === 'auditor') {
      const out = [core, rules ? `=== ⚖️ LUẬT & QUAN HỆ PHE PHÁI (CHÍNH XÁC) ===\n${rules}\n=== HẾT ===` : ''].filter(Boolean).join('\n\n');
      return out ? `${notice}\n\n${out}` : '';
    }
    // mặc định: writer
    const out = [core, flavor ? `=== 🌍 BÁCH KHOA THẾ GIỚI MỞ RỘNG (FLAVOR) ===\n${flavor}\n=== HẾT BÁCH KHOA MỞ RỘNG ===` : ''].filter(Boolean).join('\n\n');
    return out ? `${notice}\n\n${out}` : '';
  }

  // ------------------------------------------------------------------
  // 4. SEED THỰC THỂ BAN ĐẦU VÀO KHO + FACT CHUẨN
  //    (v196 ghi thẳng vào kho trước khi gọi AI — bản cũ chỉ chép thành chữ
  //     trong prompt nên AI có thể bỏ sót vĩnh viễn)
  //    Fact trả về ở định dạng canonicalEvents để game.js nạp qua
  //    applyCanonicalEventsToFacts — đây là SỰ THẬT CHUẨN (ý đồ người chơi).
  // ------------------------------------------------------------------
  function seedInitialEntities(elements) {
    const npcs = [], items = [], locations = [], facts = [];
    (elements || []).forEach(el => {
      if (!el || !el.name || !String(el.name).trim()) return;
      const name = String(el.name).trim();
      const desc = (el.description || '').trim();
      const type = String(el.type || 'NPC').toUpperCase();
      const entity = {
        id: el.id || crypto.randomUUID(),
        Name: name,
        Description: desc || 'Chưa có mô tả.'
      };
      let typeLabel = 'ITEM';
      if (type === 'NPC') {
        typeLabel = 'NPC';
        npcs.push(Object.assign({}, entity, {
          Personality: el.personality || null,
          memory: [],
          skills: [],
          plan: [],
          relationships: [],
          lifeStatus: 'alive'
        }));
        if (el.personality) {
          facts.push({ type: 'fact', subject: name, predicate: 'personality', value: String(el.personality), importance: 'normal', action: 'set' });
        }
      } else if (type === 'LOCATION') {
        typeLabel = 'LOCATION';
        locations.push(entity);
      } else {
        items.push(entity);
      }
      facts.push({ type: 'fact', subject: name, predicate: 'entity_type', value: typeLabel, importance: 'high', action: 'set' });
      facts.push({ type: 'fact', subject: name, predicate: 'exists_in_world', value: true, importance: 'critical', action: 'set' });
      if (desc) facts.push({ type: 'fact', subject: name, predicate: 'description', value: desc, importance: 'high', action: 'set' });
    });
    return { npcs, items, locations, facts };
  }

  // ------------------------------------------------------------------
  // 5. PROMPT ĐIỀN NỀN NPC / NHÂN VẬT CHÍNH (chạy nền, không block game)
  //    • Chỉ điền chỗ trống — KHÔNG ghi đè dữ liệu người chơi đã nhập.
  //    • Trường NPC gồm cả lớp tính cách mới (TrueEgo/Persona/StateOfMind/
  //      Boundaries/CoreDesire/CoreFear/SpeakingStyle/TypicalSchedule).
  // ------------------------------------------------------------------
  const FILL_CFG = { temperature: 0.7, maxOutputTokens: GEMINI_FAST_MAX_OUTPUT_TOKENS, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 2000 } };

  function buildNpcLorePrompt(npc, gameSettings, worldDirector) {
    const gs = gameSettings || {};
    const planString = Array.isArray(npc.plan) ? npc.plan.filter(Boolean).join('; ')
      : (Array.isArray(npc.Plan) ? npc.Plan.filter(Boolean).join('; ') : (npc.Plan || npc.plan || 'Chưa có.'));
    const worldCtx = worldDirector && worldDirector.contextBlock
      ? `\n**BẢN ĐỒ THẾ GIỚI (AI 0 - tham khảo):**\n${worldDirector.contextBlock.slice(0, 4000)}\n` : '';
    return `
--- CHUẨN HÓA HỒ SƠ NPC (NPC LORE OPTIMIZATION) ---
Ngươi là Game Designer. Nhiệm vụ: "Gọt giũa, Chuẩn hóa và Sáng tạo" hồ sơ NPC dựa trên thông tin gốc và bối cảnh.
**Bối cảnh:** ${gs.theme || '?'} - ${gs.setting || '?'}.
**Thông tin đầu vào của NPC:**
- Tên: ${npc.Name || '?'}
- Xuất thân (TĨNH - không được sửa): ${npc.Origin || 'Chưa có'}
- Dung mạo (TĨNH - không được sửa): ${npc.Appearance || 'Chưa có'}
- Mô tả/hiện trạng: ${npc.Description || 'Chưa có'}
- Bản Ngã (TrueEgo): ${npc.TrueEgo || npc.Personality || 'Chưa có'}
- Vỏ Bọc (Persona): ${npc.Persona || 'Chưa có'}
- Tâm trạng (StateOfMind): ${npc.StateOfMind || 'Chưa có'}
- Giới hạn đạo đức (Boundaries): ${npc.Boundaries || 'Chưa có'}
- Mục tiêu: ${npc.Goal || 'Chưa có'}
- Niềm tin: ${npc.Beliefs || 'Chưa có'}
- Kế hoạch (BẮT BUỘC KẾ THỪA): ${planString || 'Chưa có.'}
- Lịch thường nhật: ${npc.TypicalSchedule || 'Chưa có'}
- Khao khát thầm kín (CoreDesire): ${npc.CoreDesire || 'Chưa có'}
- Sợ hãi sâu xa (CoreFear): ${npc.CoreFear || 'Chưa có'}
- Phong cách nói chuyện (SpeakingStyle): ${npc.SpeakingStyle || 'Chưa có'}
- Tuổi: ${npc.Age || 'Chưa rõ'} | Phe: ${npc.Faction || 'Chưa rõ'} | Tài sản: ${npc.Wealth || 'Chưa rõ'} | Thể trạng: ${npc.Status || 'Chưa rõ'}
${worldCtx}
**LUẬT BẮT BUỘC:**
0. 🔴 [QUY TẮC BỐI CẢNH - TUYỆT ĐỐI TRÊN HẾT]: Trước khi sinh BẤT KỲ thông tin nào, phân tích bối cảnh "${gs.theme || ''} - ${gs.setting || ''}": thời đại này có nghề gì tồn tại? Nghề/Tuổi/Phong cách PHẢI hợp thời đại — CẤM nghề hiện đại vào bối cảnh cổ trang và ngược lại.
1. NẾU thông tin còn trống: TỰ SÁNG TẠO dựa trên bối cảnh — nhưng tuân thủ Quy tắc 0.
2. 🔴 "TrueEgo" là TÍNH CÁCH THẬT bên trong. "Persona" là VỎ BỌC thể hiện ra ngoài. Hai ô này CHỈ ĐƯỢC chứa tính từ/cụm từ NGẮN (tối đa 10-15 chữ). CẤM viết thành đoạn văn.
3. 🔴 BẢO VỆ KẾ HOẠCH: Kế hoạch đã có → GIỮ NGUYÊN và chỉ bổ sung bước mới logic. Trống → mới được tạo mới.
4. 🔴 StateOfMind: bám sát hiện trạng để suy luận cảm xúc lúc này (1 câu).
5. 🔴 ĐỘ DÀI: Các ô còn lại (ngoài TrueEgo/Persona) = 1-2 câu siêu ngắn — đây là BẢN NỀN khởi tạo, các lượt sau AI kể chuyện sẽ bổ sung chi tiết qua thẻ [NPC_UPDATE].
6. Trả về đúng 1 JSON object thuần (KHÔNG markdown) với key:
   Description, TrueEgo, Persona, StateOfMind, Boundaries, Goal, Beliefs, Plan, Age, TypicalSchedule, CoreDesire, CoreFear, SpeakingStyle, Skills.
   - Plan: chuỗi các bước cách nhau bằng "; ".
   - Skills: mảng tối đa 3 tên kỹ năng/hay sở trường hợp nghề và bối cảnh (chuỗi thuần; nếu NPC không có kỹ năng đáng chú ý thì []).
   - TypicalSchedule: lịch sinh hoạt theo khung giờ, bám sát nghề/bối cảnh. CẤM lịch công sở hiện đại cho nhân vật cổ trang.
   - CoreDesire: điều NPC THỰC SỰ khao khát sâu thẳm (thường giấu kín) — 1 câu cụ thể.
   - CoreFear: điều NPC THỰC SỰ sợ nhất (thường phủ nhận) — 1 câu cụ thể.
   - SpeakingStyle: đặc trưng lời nói — ẩn dụ hay dùng, chủ đề né tránh, cách phản ứng khi bất an — 1-2 câu.
   - Description: hiện trạng/nơi ở/tu vi lúc này — 1-2 câu (bản nền khởi tạo).
⚠️ VÍ DỤ FORMAT (CHỈ MINH HỌA CẤU TRÚC):
{"Description":"...","TrueEgo":"Cần cù, cam chịu, thầm lo cho vụ mùa.","Persona":"Hiền lành, ít nói, không muốn gây thù.","StateOfMind":"Đang lo âu vì hạn hán, nghi ngờ người lạ.","Boundaries":"Không bao giờ xúc phạm tổ tiên.","Goal":"Có đủ lúa qua mùa đông.","Beliefs":"Trời cao có mắt.","Plan":"Bước 1; Bước 2","Age":"48","TypicalSchedule":"Sáng 5-7: ra đồng...","CoreDesire":"...","CoreFear":"...","SpeakingStyle":"...","Skills":["Trồng lúa"]}`;
  }

  function buildPlayerFillPrompt(gameSettings, playerSkills, worldDirector) {
    const gs = gameSettings || {};
    const skillsNow = (playerSkills || []).map(s => s && (s.Name || s.name)).filter(Boolean).join(', ');
    const worldCtx = worldDirector && worldDirector.contextBlock
      ? `\n**BẢN ĐỒ THẾ GIỚI (AI 0 - tham khảo):**\n${worldDirector.contextBlock.slice(0, 4000)}\n` : '';
    return `Ngươi là Game Designer chuyên xây dựng hồ sơ nhân vật. Hãy suy luận và BỔ SUNG các phần còn thiếu của nhân vật chính — TUYỆT ĐỐI KHÔNG sửa tên/tiểu sử người chơi đã nhập.
**Thông tin hiện tại:**
- Tên: ${gs.characterName || 'Chưa rõ'}
- Giới tính: ${gs.characterGender || 'Chưa rõ'}
- Bối cảnh: ${gs.theme || ''} — ${gs.setting || ''}
- Tiểu sử (GIỮ NGUYÊN): ${gs.characterBackstory || 'Chưa có'}
- Mục tiêu hiện tại: ${gs.useCharacterGoal ? (gs.characterGoal || 'Chưa có') : 'Người chơi chưa đặt mục tiêu'}
- Kỹ năng hiện có: ${skillsNow || 'Chưa có — CẦN sinh kỹ năng khởi đầu'}
${worldCtx}
**YÊU CẦU:**
1. initialSkills: CHỈ điền nếu "Kỹ năng hiện có" ở trên là "Chưa có". Nếu đã có → trả về mảng rỗng []. Tối đa 3 kỹ năng hợp bối cảnh (cổ trang/fantasy đặt tên huyễn hoặc; hiện đại đặt tên thực tế). Mỗi phần tử: {"Name":"...","Description":"1-2 câu"}.
2. characterGoal: CHỈ điền nếu người chơi chưa đặt mục tiêu ở trên ("Người chơi chưa đặt mục tiêu"). Mục tiêu 1 câu rõ ràng hợp tiểu sử/bối cảnh. Nếu người chơi đã có mục tiêu → trả chuỗi rỗng "".
3. ageHint: tuổi hợp lý nhất của nhân vật theo bối cảnh (chuỗi, ví dụ "17-19"); nếu không suy luận được → "".
Trả về JSON thuần (KHÔNG markdown):
{"initialSkills":[{"Name":"","Description":""}],"characterGoal":"","ageHint":""}`;
  }

  // Gọi 1 lượt điền nền — trả object đã parse hoặc null (không throw).
  async function fillProfile(promptText) {
    try {
      const raw = await callGeminiText(promptText, FILL_CFG);
      return parseJson(raw);
    } catch (err) {
      console.warn('[WB.fillProfile] Lỗi:', err && err.message);
      return null;
    }
  }

  return {
    callGeminiText,
    parseJson,
    randomizeWorldTime,
    applySuggestedYear,
    buildAi0SharedHeader,
    callAI0WorldDirector,
    buildWorldContextForConsumer,
    seedInitialEntities,
    buildNpcLorePrompt,
    buildPlayerFillPrompt,
    fillProfile
  };
})();
