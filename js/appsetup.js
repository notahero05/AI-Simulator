// ============================================================================
// MÀN HÌNH ĐẦU GAME: InitialScreen (menu chính) + GameSetupScreen (bảng thiết lập)
// Tách ra từ 03-app.js. PHẢI được nạp TRƯỚC 03-app.js (03-app.js tạo <App/> ở dòng cuối).
// Các hằng dùng chung (LANGUAGE_DICTIONARIES, DRAMA_LEVELS, ...) và hook React
// (useState, ...) vẫn khai báo trong 03-app.js; chúng chỉ được dùng lúc render nên không lỗi.
// ============================================================================
const InitialScreen = e => {
  const t = React.useRef(null);
  return React.createElement("div",
    {
    className: "flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-6"
  },
    React.createElement("h1",
      {
    className: "text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 mb-12 text-center animate-pulse"
  }, "Nhập Vai A.I Simulator"),
    React.createElement("div", {
    className: "space-y-4 w-full max-w-md"
  },
      React.createElement("button",
        {
    onClick: () => e.setCurrentScreen("setup"),
    className: "w-full flex items-center justify-center bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-4 px-6 rounded-xl shadow-xl hover:shadow-2xl transition-all transform hover:scale-105 text-xl focus:outline-none focus:ring-4 focus:ring-pink-400 focus:ring-opacity-50"
  }, "▶️ Bắt Đầu Cuộc Phiêu Lưu Mới"),
      React.createElement("button",
        {
    onClick: () => e.setShowLoadGameModal(!0),
    disabled: 0 === e.savedGames.length,
    className: "w-full flex items-center justify-center bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105 text-lg disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed focus:outline-none focus:ring-4 focus:ring-cyan-400 focus:ring-opacity-50"
  }, "💾 Tải Game Đã Lưu (", e.savedGames.length, ")"),
      React.createElement("button",
        {
    onClick: () => {
      t.current.click()
    },
    className: "w-full flex items-center justify-center bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105 text-lg focus:outline-none focus:ring-4 focus:ring-blue-400 focus:ring-opacity-50"
  }, "📂 Tải Game Từ Tệp (.json)"),
      React.createElement("input",
        {
    type: "file",
    ref: t,
    onChange: e.handleLoadGameFromFile,
    accept: ".json",
    className: "hidden"
  })),
    e.userId && React.createElement("p", {
    className: "mt-1 text-xs text-gray-400"
  }, "UserID: ", e.userId))
},
GameSetupScreen = ({
  goHome: e,
  gameSettings: t,
  handleInputChange: n,
  initializeGame: a,
  isLoading: i,
  handleFetchSuggestions: r,
  isFetchingSuggestions: c,
  handleGenerateBackstory: l,
  isGeneratingContent: s,
  handleGenerateDifficultyDescription: o,
  isGeneratingDifficultyDesc: h,
  addInitialWorldElement: m,
  removeInitialWorldElement: g,
  handleInitialElementChange: u,
  handleGenerateInitialElementDescription: d,
  isGeneratingInitialElementDesc: p,
  handleGenerateGoal: N,
  isGeneratingGoal: y,
  handleGenerateCharacterName: T,
  isGeneratingCharacterName: C,
  handleGenerateInitialSkill: f,
  isGeneratingInitialSkill: b
}) => React.createElement("div",
  {
  className: "min-h-screen bg-gray-800 text-white p-4 md:p-6 flex flex-col items-center"
},
  React.createElement("div",
    {
  className: "w-full max-w-3xl bg-gray-700 p-6 md:p-8 rounded-xl shadow-2xl relative"
},
    React.createElement("button",
      {
  onClick: e,
  className: "absolute top-4 left-4 text-purple-400 hover:text-purple-300 text-sm flex items-center bg-gray-600 hover:bg-gray-500 p-2 rounded-lg shadow transition-colors"
}, "↩️ Về Trang Chủ"),
    React.createElement("h2",
      {
  className: "text-3xl md:text-4xl font-bold text-purple-400 mb-8 text-center pt-10 sm:pt-0"
}, "Kiến Tạo Thế Giới Của Ngươi"),
    React.createElement("div",
      {
  className: "grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 mb-6"
},
      React.createElement("div", {
  className: "space-y-6"
},
        React.createElement("fieldset", {
  className: "border border-gray-600 p-4 rounded-lg"
},
          React.createElement("legend",
            {
  className: "text-xl font-semibold text-pink-400 px-2"
}, "📜 Bối Cảnh Truyện"),
          React.createElement("div", {
  className: "mt-2 space-y-4"
},
            React.createElement("div", null,
              React.createElement("label",
                {
  htmlFor: "theme",
  className: "block text-lg font-medium text-gray-300 mb-1"
}, "Thể loại:"),
              React.createElement("div", {
  className: "flex items-center gap-2"
},
                React.createElement("input",
                  {
  type: "text",
  name: "theme",
  id: "theme",
  value: t.theme,
  onChange: n,
  placeholder: "VD: Tiên hiệp, Huyền huyễn...",
  className: "w-full p-3 bg-gray-600 border border-gray-500 rounded-lg focus:ring-pink-500 focus:border-pink-500"
}),
                React.createElement("button",
                  {
  onClick: () => r("theme"),
  disabled: c,
  className: "p-3 bg-pink-600 hover:bg-pink-700 rounded-lg disabled:bg-gray-500",
  title: "✨ Gợi ý Chủ đề"
},
                  c ? React.createElement("div",
                    {
  className: "w-5 h-5 border-2 border-t-transparent border-white rounded-full animate-spin"
}): "✨"))),
            React.createElement("div", null,
              React.createElement("label",
                {
  htmlFor: "setting",
  className: "block text-lg font-medium text-gray-300 mb-1"
}, "Thế Giới/Bối Cảnh Chi Tiết:"),
              React.createElement("div", {
  className: "flex items-center gap-2"
},
                React.createElement("input",
                  {
  type: "text",
  name: "setting",
  id: "setting",
  value: t.setting,
  onChange: n,
  placeholder: "VD: Đại Lục Phong Vân...",
  className: "w-full p-3 bg-gray-600 border border-gray-500 rounded-lg focus:ring-pink-500 focus:border-pink-500"
}),
                React.createElement("button",
                  {
  onClick: () => r("setting"),
  disabled: c,
  className: "p-3 bg-pink-600 hover:bg-pink-700 rounded-lg disabled:bg-gray-500",
  title: "✨ Gợi ý Bối cảnh"
},
                  c ? React.createElement("div",
                    {
  className: "w-5 h-5 border-2 border-t-transparent border-white rounded-full animate-spin"
}): "✨"))))),
        React.createElement("fieldset", {
  className: "border border-gray-600 p-4 rounded-lg"
},
          React.createElement("legend",
            {
  className: "text-xl font-semibold text-pink-400 px-2"
}, "🖋️ Phong Cách Viết & Xưng Hô"),
          React.createElement("div", {
  className: "mt-2 space-y-4"
},
            React.createElement("div", null,
              React.createElement("label",
                {
  htmlFor: "languageDictionary",
  className: "block text-lg font-medium text-gray-300 mb-1"
}, "Từ điển ngôn ngữ:"),
              React.createElement("select",
                {
  name: "languageDictionary",
  id: "languageDictionary",
  value: t.languageDictionary,
  onChange: n,
  className: "w-full p-2 bg-gray-600 border border-gray-500 rounded-md focus:ring-pink-500 focus:border-pink-500"
},
                LANGUAGE_DICTIONARIES.map(e => React.createElement("option",
                    {
  key: e,
  value: e
}, e)))),
            React.createElement("div", null,
              React.createElement("label",
                {
  htmlFor: "writingStyle",
  className: "block text-lg font-medium text-gray-300 mb-1"
}, "Văn phong chi tiết:"),
              React.createElement("select",
                {
  name: "writingStyle",
  id: "writingStyle",
  value: t.writingStyle,
  onChange: n,
  className: "w-full p-2 bg-gray-600 border border-gray-500 rounded-md focus:ring-pink-500 focus:border-pink-500"
},
                WRITING_STYLES.map(e => React.createElement("option", {
  key: e,
  value: e
}, e)))),
            React.createElement("div", null,
              React.createElement("label",
                {
  htmlFor: "pronounContext",
  className: "block text-lg font-medium text-gray-300 mb-1"
}, "Bối cảnh xưng hô:"),
              React.createElement("select",
                {
  name: "pronounContext",
  id: "pronounContext",
  value: t.pronounContext,
  onChange: n,
  className: "w-full p-2 bg-gray-600 border border-gray-500 rounded-md focus:ring-pink-500 focus:border-pink-500"
},
                PRONOUN_CONTEXTS.map(e => React.createElement("option", {
  key: e,
  value: e
}, e)))))),
        React.createElement("fieldset", {
  className: "border border-gray-600 p-4 rounded-lg"
},
          React.createElement("legend",
            {
  className: "text-xl font-semibold text-teal-400 px-2"
}, "🎲 Độ Khó & Nội Dung"),
          React.createElement("div", {
  className: "mt-2 space-y-4"
},
            React.createElement("div", null,
              React.createElement("label",
                {
  htmlFor: "difficulty",
  className: "block text-lg font-medium text-gray-300 mb-1"
}, "Chọn Độ Khó:"),
              React.createElement("select",
                {
  name: "difficulty",
  id: "difficulty",
  value: t.difficulty,
  onChange: n,
  className: "w-full p-3 bg-gray-600 border border-gray-500 rounded-lg focus:ring-teal-500 focus:border-teal-500"
}, React.createElement("option", {
  value: "Dễ"
}, "Dễ - Dành cho người mới"),
                React.createElement("option", {
  value: "Thường"
}, "Thường - Cân bằng, phù hợp đa số"),
                React.createElement("option", {
  value: "Khó"
}, "Khó - Thử thách cao, cần tính toán"),
                React.createElement("option", {
  value: "Ác Mộng"
}, "Ác Mộng - Cực kỳ khó"),
                React.createElement("option", {
  value: "Tuỳ Chỉnh AI"
}, "Tuỳ Chỉnh AI - Để AI mô tả"))),
            React.createElement("div", null,
              React.createElement("label",
                {
  htmlFor: "dramaLevel",
  className: "block text-lg font-medium text-gray-300 mb-1"
}, "Mức Độ Drama (Kịch Tính):"),
              React.createElement("select",
                {
  name: "dramaLevel",
  id: "dramaLevel",
  value: t.dramaLevel,
  onChange: n,
  className: "w-full p-3 bg-gray-600 border border-gray-500 rounded-lg focus:ring-teal-500 focus:border-teal-500"
}, DRAMA_LEVELS.map(e => React.createElement("option", {
  key: e,
  value: e
}, e))),
              React.createElement("p", {
  className: "text-xs text-gray-400 mt-1 italic"
}, "Điều chỉnh tần suất AI tự động ném các sự kiện bất ngờ, kẻ thù, hoặc rắc rối vào bạn.")),
            ("Tuỳ Chỉnh AI" === t.difficulty || t.difficultyDescription) && React.createElement("div",
              null,
              React.createElement("label",
                {
  htmlFor: "difficultyDescription",
  className: "block text-lg font-medium text-gray-300 mb-1"
}, "Mô Tả Độ Khó:"),
              React.createElement("div", {
  className: "flex items-center gap-2"
},
                React.createElement("textarea",
                  {
  name: "difficultyDescription",
  id: "difficultyDescription",
  value: t.difficultyDescription,
  onChange: n,
  rows: "2",
  placeholder: "AI sẽ mô tả độ khó ở đây...",
  className: "w-full p-3 bg-gray-600 border border-gray-500 rounded-lg focus:ring-teal-500 focus:border-teal-500"
}),
                "Tuỳ Chỉnh AI" === t.difficulty && React.createElement("button",
                  {
  onClick: o,
  disabled: h,
  className: "p-3 bg-teal-600 hover:bg-teal-700 rounded-lg disabled:bg-gray-500 self-start",
  title: "✨ AI Tạo Mô Tả Độ Khó"
},
                  h ? React.createElement("div",
                    {
  className: "w-5 h-5 border-2 border-t-transparent border-white rounded-full animate-spin"
}): "✨"))),
            React.createElement("p", {
  className: "text-xs text-gray-400 italic"
},
              "Khi tick chọn, AI sẽ được khuyến khích tạo nội dung khiêu dâm, bạo lực cực đoan một cách trần trụi và chi tiết hơn.")))),
      React.createElement("div", {
  className: "space-y-6"
},
        React.createElement("fieldset", {
  className: "border border-gray-600 p-4 rounded-lg"
},
          React.createElement("legend",
            {
  className: "text-xl font-semibold text-sky-400 px-2"
}, "👤 Nhân Vật Chính"),
          React.createElement("div", {
  className: "mt-2 space-y-4"
},
            React.createElement("div", null,
              React.createElement("label",
                {
  htmlFor: "characterName",
  className: "block text-lg font-medium text-gray-300 mb-1"
}, "Danh Xưng/Tên:"),
              React.createElement("div", {
  className: "flex items-center gap-2"
},
                React.createElement("input",
                  {
  type: "text",
  name: "characterName",
  id: "characterName",
  value: t.characterName,
  onChange: n,
  placeholder: "VD: Diệp Phàm, Hàn Lập...",
  className: "w-full p-3 bg-gray-600 border border-gray-500 rounded-lg focus:ring-sky-500 focus:border-sky-500"
}),
                React.createElement("button",
                  {
  onClick: T,
  disabled: C,
  className: "p-3 bg-sky-600 hover:bg-sky-700 rounded-lg disabled:bg-gray-500",
  title: "✨ Gợi ý Tên Nhân Vật"
},
                  C ? React.createElement("div",
                    {
  className: "w-5 h-5 border-2 border-t-transparent border-white rounded-full animate-spin"
}): "✨"))),
            React.createElement("div", null,
              React.createElement("label",
                {
  htmlFor: "characterGender",
  className: "block text-lg font-medium text-gray-300 mb-1"
}, "Giới Tính:"),
              React.createElement("select",
                {
  name: "characterGender",
  id: "characterGender",
  value: t.characterGender,
  onChange: n,
  className: "w-full p-3 bg-gray-600 border border-gray-500 rounded-lg focus:ring-sky-500 focus:border-sky-500"
},
                React.createElement("option", {
  value: "Không xác định"
}, "Không xác định / Để AI quyết định"),
                React.createElement("option", {
  value: "Nam"
}, "Nam"), React.createElement("option", {
  value: "Nữ"
}, "Nữ"), React.createElement("option", {
  value: "Khác"
}, "Khác"))),
            React.createElement("div", null,
              React.createElement("label",
                {
  htmlFor: "characterBackstory",
  className: "block text-lg font-medium text-gray-300 mb-1"
}, "Sơ Lược Tiểu Sử:"),
              React.createElement("div", {
  className: "flex items-center gap-2"
},
                React.createElement("textarea",
                  {
  name: "characterBackstory",
  id: "characterBackstory",
  value: t.characterBackstory,
  onChange: n,
  rows: "3",
  placeholder: "VD: Một phế vật mang huyết mạch thượng cổ...",
  className: "w-full p-3 bg-gray-600 border border-gray-500 rounded-lg focus:ring-sky-500 focus:border-sky-500"
}),
                React.createElement("button",
                  {
  onClick: l,
  disabled: s,
  className: "p-3 bg-sky-600 hover:bg-sky-700 rounded-lg disabled:bg-gray-500 self-start",
  title: "✨ Tạo Tiểu sử"
},
                  s ? React.createElement("div",
                    {
  className: "w-5 h-5 border-2 border-t-transparent border-white rounded-full animate-spin"
}): "✨"))),
            React.createElement("div", null,
              React.createElement("label",
                {
  htmlFor: "preferredInitialSkill",
  className: "block text-lg font-medium text-gray-300 mb-1"
}, "Kỹ Năng Khởi Đầu (Tùy chọn):"),
              React.createElement("div", {
  className: "flex items-center gap-2"
},
                React.createElement("input",
                  {
  type: "text",
  name: "preferredInitialSkill",
  id: "preferredInitialSkill",
  value: t.preferredInitialSkill,
  onChange: n,
  placeholder: "VD: Thuật ẩn thân...",
  className: "w-full p-3 bg-gray-600 border border-gray-500 rounded-lg focus:ring-sky-500 focus:border-sky-500"
}),
                React.createElement("button",
                  {
  onClick: f,
  disabled: b,
  className: "p-3 bg-sky-600 hover:bg-sky-700 rounded-lg disabled:bg-gray-500",
  title: "✨ Gợi ý Kỹ năng"
},
                  b ? React.createElement("div",
                    {
  className: "w-5 h-5 border-2 border-t-transparent border-white rounded-full animate-spin"
}): "✨")),
              React.createElement("p", {
  className: "text-xs text-gray-400 mt-1 italic"
}, "Gợi ý cho AI về loại kỹ năng ngươi muốn bắt đầu.")))),
        React.createElement("fieldset",
          {
  className: "border border-red-500/70 p-4 rounded-lg bg-gray-700/20"
},
          React.createElement("legend",
            {
  className: "text-xl font-semibold text-red-400 px-2 flex items-center"
}, "🎯 Mục Tiêu/Động Lực"),
          React.createElement("div", {
  className: "mt-3 space-y-3"
},
            React.createElement("div", {
  className: "flex items-center"
},
              React.createElement("input",
                {
  type: "checkbox",
  name: "useCharacterGoal",
  id: "useCharacterGoal",
  checked: t.useCharacterGoal,
  onChange: n,
  className: "h-5 w-5 text-red-500 bg-gray-600 border-gray-500 rounded focus:ring-red-600 focus:ring-offset-gray-800"
}),
              React.createElement("label",
                {
  htmlFor: "useCharacterGoal",
  className: "ml-2 text-sm font-medium text-gray-300"
}, "Thêm Mục Tiêu/Động Lực")),
            t.useCharacterGoal && React.createElement("div", null,
              React.createElement("label",
                {
  htmlFor: "characterGoal",
  className: "block text-lg font-medium text-gray-300 mb-1"
}, "Mục Tiêu/Động Lực:"),
              React.createElement("div", {
  className: "flex items-center gap-2"
},
                React.createElement("textarea",
                  {
  name: "characterGoal",
  id: "characterGoal",
  value: t.characterGoal,
  onChange: n,
  rows: "3",
  placeholder: "VD: Trả thù cho gia tộc...",
  className: "w-full p-3 bg-gray-600 border border-gray-500 rounded-lg focus:ring-red-500 focus:border-red-500"
}),
                React.createElement("button",
                  {
  onClick: N,
  disabled: y,
  className: "p-3 bg-red-600 hover:bg-red-700 rounded-lg disabled:bg-gray-500 self-start",
  title: "✨ AI Gợi Ý Mục Tiêu"
},
                  y ? React.createElement("div",
                    {
  className: "w-5 h-5 border-2 border-t-transparent border-white rounded-full animate-spin"
}): "✨")),
              React.createElement("p", {
  className: "text-xs text-gray-400 mt-1 italic"
}, "Mục tiêu này sẽ ảnh hưởng đến suy nghĩ và hành động của nhân vật.")))))),
    React.createElement("fieldset",
      {
  className: "border-2 border-lime-600 p-4 rounded-lg mb-6 bg-gray-700/30"
},
      React.createElement("legend",
        {
  className: "text-xl font-semibold text-lime-300 px-2 flex items-center"
}, "🏛️ Kiến Tạo Thế Giới Ban Đầu (Tùy chọn)"),
      React.createElement("div", {
  className: "mt-3 space-y-4"
},
        t.initialWorldElements.map((e, t) => React.createElement("div",
            {
  key: e.id,
  className: "p-3 bg-gray-600/50 rounded-lg border border-gray-500"
},
            React.createElement("div",
              {
  className: "grid grid-cols-1 md:grid-cols-2 gap-3 mb-2"
},
              React.createElement("div", null,
                React.createElement("label",
                  {
  htmlFor: `elementName-${t}`,
  className: "block text-sm font-medium text-gray-300 mb-1"
}, "Tên Thực Thể:"),
                React.createElement("input",
                  {
  type: "text",
  id: `elementName-${t}`,
  name: "name",
  value: e.name,
  onChange: e => u(t, e),
  placeholder: "VD: Lão Ma Đầu...",
  className: "w-full p-2 bg-gray-500 border border-gray-400 rounded-md focus:ring-lime-500 focus:border-lime-500 text-sm"
})),
              React.createElement("div", null,
                React.createElement("label",
                  {
  htmlFor: `elementType-${t}`,
  className: "block text-sm font-medium text-gray-300 mb-1"
}, "Loại Thực Thể:"),
                React.createElement("select",
                  {
  id: `elementType-${t}`,
  name: "type",
  value: e.type,
  onChange: e => u(t, e),
  className: "w-full p-2 bg-gray-500 border border-gray-400 rounded-md focus:ring-lime-500 focus:border-lime-500 text-sm"
}, React.createElement("option", {
  value: "NPC"
}, "Nhân Vật (NPC)"), React.createElement("option", {
  value: "LOCATION"
}, "Địa Điểm"), React.createElement("option", {
  value: "ITEM"
}, "Vật Phẩm (Lore)"))),
              React.createElement("div", {
  className: "md:col-span-2"
},
                React.createElement("label",
                  {
  htmlFor: `elementPersonality-${t}`,
  className: "block text-sm font-medium text-gray-300 mb-1"
}, "Tính Cách (Nếu là NPC):"),
                React.createElement("input",
                  {
  type: "text",
  id: `elementPersonality-${t}`,
  name: "personality",
  value: e.personality || "",
  onChange: e => u(t, e),
  placeholder: "VD: Lạnh lùng, Đa nghi...",
  className: "w-full p-2 bg-gray-500 border border-gray-400 rounded-md focus:ring-lime-500 focus:border-lime-500 text-sm"
})),
              React.createElement("div", {
  className: "md:col-span-2"
},
                React.createElement("label",
                  {
  htmlFor: `elementDesc-${t}`,
  className: "block text-sm font-medium text-gray-300 mb-1"
}, "Mô Tả Thực Thể:"),
                React.createElement("div", {
  className: "flex items-start gap-2"
},
                  React.createElement("textarea",
                    {
  id: `elementDesc-${t}`,
  name: "description",
  value: e.description,
  onChange: e => u(t, e),
  rows: "2",
  placeholder: "Mô tả chi tiết về thực thể này...",
  className: "w-full p-2 bg-gray-500 border border-gray-400 rounded-md focus:ring-lime-500 focus:border-lime-500 text-sm"
}),
                  React.createElement("button",
                    {
  onClick: () => d(t),
  disabled: p[e.id] || !e.name,
  className: "p-2.5 bg-lime-600 hover:bg-lime-700 rounded-md disabled:bg-gray-500 self-center",
  title: "✨ AI Tạo Mô Tả Thực Thể"
},
                    p[e.id] ? React.createElement("div",
                      {
  className: "w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin"
}): "✨")))),
            React.createElement("button",
              {
  onClick: () => g(e.id),
  className: "mt-1 text-xs bg-red-700 hover:bg-red-800 text-white py-1 px-2 rounded-md flex items-center"
}, "🗑️ Xóa"))),
        React.createElement("button",
          {
  onClick: m,
  className: "w-full mt-2 py-2 px-4 bg-lime-700 hover:bg-lime-800 text-white font-semibold rounded-lg shadow-md flex items-center justify-center text-sm"
}, "➕ Thêm Thực Thể"))),
    React.createElement("button",
      {
  onClick: a,
  disabled: i,
  className: "w-full mt-6 bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white font-bold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105 text-xl disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed flex items-center justify-center"
}, "➕ ", i ? "Đang Khởi Tạo..." : "Khởi Tạo Thế Giới")));