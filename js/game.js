// ============================================================================
// CANVAS BRIDGE, FIREBASE COMPATIBILITY LAYER, AND ERROR REPORTING
// ============================================================================
// ============================================================================
// BÁO LỖI TOÀN CỤC
// Hiển thị lỗi JavaScript / Promise ở cạnh dưới màn hình.
// ============================================================================
(function () {
  function show(m) {
    var d = document.getElementById('__err');
    if (!d) {
      d = document.createElement('pre');
      d.id = '__err';
      d.style.cssText = 'position:fixed;left:0;right:0;bottom:0;max-height:40%;overflow:auto;margin:0;padding:8px;background:#7f1d1d;color:#fff;font:12px monospace;z-index:99999;white-space:pre-wrap';
      document.body.appendChild(d);
    }
    d.textContent += m + '\n';
  }

  window.addEventListener('error', function (e) {
    show('LỖI: ' + e.message + ' (' + (e.filename || '').slice(-30) + ':' + e.lineno + ')');
  });

  window.addEventListener('unhandledrejection', function (e) {
    show('LỖI PROMISE: ' + (e.reason && e.reason.message || e.reason));
  });

  window.__showErr = show;
})();

// ============================================================================
// GAME APPLICATION LOGIC
// ============================================================================
const {
  useState: useState,
  useEffect: useEffect,
  useCallback: useCallback,
  useRef: useRef,
  useMemo: useMemo
} = React;
const HISTORY_TURN_LIMIT = 4000;
function preprocessText(e) {
  if (!e) return [];
  return (e.toLowerCase().match(VIETNAMESE_WORD_REGEX) || []).filter(e => !VIETNAMESE_STOP_WORDS.has(e))
}
class KnowledgeGraph {
  constructor() {
    this.graph = {
      nodes: new Map,
      edges: new Map
    },
    console.log("Knowledge Graph Initialized (Simulated).")
  }
  addOrUpdateNode(e, t, n) {
    if (!e || "string" != typeof e) return;
    const a = e.trim();
    if (this.graph.nodes.has(a)) {
      const e = this.graph.nodes.get(a);
      this.graph.nodes.set(a, {
        ...e,
        ...n
      })
    } else this.graph.nodes.set(a, {
      type: t,
      ...n
    })
  }
  addOrUpdateEdge(e, t, n, a) {
    if (!e || !t || !n) return;
    const i = `${e.trim()}|${n.trim()}|${t.trim()}`;
    if (this.addOrUpdateNode(e.trim(), "UNKNOWN", {
    }), this.addOrUpdateNode(t.trim(), "UNKNOWN", {
    }), this.graph.edges.has(i)) {
      const e = this.graph.edges.get(i);
      this.graph.edges.set(i, {
        ...e,
        ...a
      })
    } else this.graph.edges.set(i,
      {
      source: e.trim(),
      target: t.trim(),
      label: n.trim(),
      ...a
    })
  }
  getNodeDetails(e) {
    return this.graph.nodes.get(e.trim())
  }
  getEdgesForNode(e) {
    const t = [];
    return this.graph.edges.forEach(n => {
      n.source !== e.trim() && n.target !== e.trim() || t.push(n)
    }),
    t
  }
  getContextSummary(e) {
    if (!e) return "Chưa có nhân vật chính để tạo báo cáo quan hệ.";
    const t = this.getNodeDetails(e);
    if (!t) return `Không có thông tin về thực thể trung tâm "${e}".`;
    let n = `Báo cáo quan hệ cho "${e}" (${t.type}):\n`;
    for (const [e, a] of Object.entries(t)) "type" !== e && a && (n += `- ${e}: ${String(a)}\n`);
    const a = this.getEdgesForNode(e);
    return a.length > 0 && (n += "Các mối quan hệ trực tiếp:\n",
      a.forEach(t => {
      t.source === e ? n += `- (${e}) -[${t.label}]-> (${t.target})\n` : n += `- (${t.source}) -[${t.label}]-> (${e})\n`
    })),
    n
  }
}
class VectorMemory {
  constructor() {
    this.memoryStore = new Map,
    this.documentFrequencies = new Map,
    this.idfCache = new Map,
    this.nextId = 0,
    this.isDirty = !0,
    this.hnsw = new HNSW_Simulator((e, t) => 1 - this._cosineSimilarity(e, t)),
    console.log("Vector Memory Initialized (TF-IDF + HNSW Simulation).")
  }
  async addMemory(e) {
    const t = this.nextId++,
    n = preprocessText(e);
    new Set(n).forEach(e => {
      const t = this.documentFrequencies.get(e) || 0;
      this.documentFrequencies.set(e, t + 1)
    }),
    this.memoryStore.set(t, {
      text: e,
      tokens: n,
      tfidfVector: null
    }),
    this.isDirty = !0
  }
  _calculateAllTfidfVectors() {
    const e = this.memoryStore.size;
    if (0 !== e) {
      this.idfCache.clear();
      for (const [t, n] of this.documentFrequencies.entries()) {
        const a = Math.log(e / (1 + n)) + 1;
        this.idfCache.set(t, a)
      }
      for (const e of this.memoryStore.values()) {
        const t = new Map,
        n = new Map;
        let a = 0;
        e.tokens.forEach(e => {
          const t = (n.get(e) || 0) + 1;
          n.set(e, t),
            t > a && (a = t)
        });
        for (const [e, i] of n.entries()) {
          const n = .5 + i / a * .5,
          r = this.idfCache.get(e) || 0;
          t.set(e, n * r)
        }
        e.tfidfVector = t
      }
      this.isDirty = !1,
      console.log("TF-IDF vectors recalculated for all memories.")
    }
  }
  _rebuildHnswGraph() {
    this.hnsw.buildGraph(this.memoryStore)
  }
  _cosineSimilarity(e, t) {
    let n = 0,
    a = 0,
    i = 0;
    return new Set([...e.keys(),
      ...t.keys()]).forEach(r => {
      const c = e.get(r) || 0,
        l = t.get(r) || 0;
      n += c * l,
        a += c * c,
        i += l * l
    }),
    a = Math.sqrt(a),
    i = Math.sqrt(i),
    0 === a || 0 === i ? 0 : n / (a * i)
  }
  async retrieveRelevantMemories(e, t = 5) {
    if (0 === this.memoryStore.size) return [];
    this.isDirty && (this._calculateAllTfidfVectors(), this._rebuildHnswGraph());
    const n = preprocessText(e),
    a = new Map,
    i = new Map;
    let r = 0;
    n.forEach(e => {
      const t = (i.get(e) || 0) + 1;
      i.set(e, t),
        t > r && (r = t)
    });
    for (const [e, t] of i.entries()) {
      const n = .5 + t / r * .5,
      i = this.idfCache.get(e) || 0;
      a.set(e, n * i)
    }
    const c = this.hnsw.search(a, 5 * t),
    l = [];
    for (const e of c) {
      const t = this.memoryStore.get(e);
      if (t) {
        const n = this._cosineSimilarity(a, t.tfidfVector);
        n > 0 && l.push({
          id: e,
          similarity: n,
          text: t.text
        })
      }
    }
    return l.sort((e, t) => t.similarity - e.similarity),
    l.slice(0, t)
  }
}
class HNSW_Simulator {
  constructor(e) {
    this.distanceFunction = e,
    this.graphs = [],
    this.entryPoint = null,
    this.maxLayer = - 1,
    this.nodes = new Map
  }
  buildGraph(e) {
    if (this.graphs = [], this.entryPoint = null, this.maxLayer = - 1, this.nodes.clear(),
      0 !== e.size) {
      for (const [t, n] of e.entries()) this.addNode(t, n.tfidfVector);
      console.log(`HNSW graph rebuilt with ${this.nodes.size} nodes and ${this.maxLayer+1} layers.`)
    }
  }
  addNode(e, t) {
    const n = this._getRandomLayer(),
    a = {
      id: e,
      vector: t,
      neighbors: Array.from({
        length: n + 1
      }, () => [])
    };
    if (this.nodes.set(e, a), null === this.entryPoint) {
      this.entryPoint = a,
      this.maxLayer = n;
      for (let e = 0; e <= n; e++) this.graphs[e] = [a];
      return
    }
    let i = this.entryPoint;
    for (let e = this.maxLayer; e > n; e--) i = this._searchLayer(t, i, 1, e)[0];
    for (let r = Math.min(n, this.maxLayer); r >= 0; r--) {
      this.graphs[r] || (this.graphs[r] = []),
      this.graphs[r].push(a);
      const n = this._searchLayer(t, i, 5, r);
      a.neighbors[r] = n.map(e => e.id),
      n.forEach(t => {
        const n = this.nodes.get(t.id);
        n.neighbors[r].length < 5 && n.neighbors[r].push(e)
      }),
      i = n[0]
    }
    n > this.maxLayer && (this.maxLayer = n, this.entryPoint = a)
  }
  search(e, t) {
    if (!this.entryPoint) return [];
    let n = this.entryPoint;
    for (let t = this.maxLayer; t > 0; t--) n = this._searchLayer(e, n, 1, t)[0];
    return this._searchLayer(e, n, t, 0).map(e => e.id)
  }
  _searchLayer(e, t, n, a) {
    const i = new Set([t.id]),
    r = [{
        node: t,
        distance: this.distanceFunction(e, t.vector)
      }],
    c = [];
    for (; r.length > 0; ) {
      r.sort((e, t) => e.distance - t.distance);
      const t = r.shift();
      if (c.length >= n && t.distance > c[c.length - 1].distance) break;
      c.push(t);
      const l = t.node.neighbors[a] || [];
      for (const t of l) if (!i.has(t)) {
        i.add(t);
        const n = this.nodes.get(t);
        n && r.push({
          node: n,
          distance: this.distanceFunction(e, n.vector)
        })
      }
    }
    return c.slice(0, n).map(e => e.node)
  }
  _getRandomLayer() {
    let e = 0;
    for (; Math.random() < Math.exp(- e / HNSW_LAYER_DECAY); ) e++;
    for (; e >= this.graphs.length; ) this.graphs.push([]);
    return e
  }
}
class TextRankSummarizer {
  constructor(e = TEXTRANK_ITERATIONS, t = TEXTRANK_DAMPING, n = TEXTRANK_TOLERANCE) {
    this.iterations = e,
    this.damping = t,
    this.tolerance = n
  }
  _getSentences(e) {
    return e ? e.split(/(?<=[.?!])\s+/).filter(e => e.trim().length > 0) : []
  }
  _createTfVector(e) {
    const t = new Map;
    return e.forEach(e => {
      t.set(e, (t.get(e) || 0) + 1)
    }),
    t
  }
  _cosineSimilarity(e, t) {
    let n = 0,
    a = 0,
    i = 0;
    return new Set([...e.keys(),
      ...t.keys()]).forEach(r => {
      const c = e.get(r) || 0,
        l = t.get(r) || 0;
      n += c * l,
        a += c * c,
        i += l * l
    }),
    0 === a || 0 === i ? 0 : n / (Math.sqrt(a) * Math.sqrt(i))
  }
  summarize(e, t) {
    const n = this._getSentences(e);
    if (n.length <= t) return e;
    const a = n.map(e => this._createTfVector(preprocessText(e))),
    i = Array.from({
      length: n.length
    }, () => Array(n.length).fill(0));
    for (let e = 0; e < n.length; e++) for (let t = e; t < n.length; t++) {
      const n = this._cosineSimilarity(a[e], a[t]);
      i[e][t] = n,
      i[t][e] = n
    }
    let r = Array(n.length).fill(1);
    for (let e = 0; e < this.iterations; e++) {
      const e = Array(n.length).fill(0);
      let t = 0;
      for (let a = 0; a < n.length; a++) {
        let c = 1 - this.damping,
        l = 0;
        for (let e = 0; e < n.length; e++) {
          if (a === e) continue;
          let t = 0;
          for (let a = 0; a < n.length; a++) e !== a && (t += i[e][a]);
          t > 0 && (l += i[a][e] / t * r[e])
        }
        e[a] = c + this.damping * l,
        t = Math.max(t, Math.abs(e[a] - r[a]))
      }
      if (r = e, t < this.tolerance) break
    }
    const c = n.map((e, t) => ({
      sentence: e,
      score: r[t],
      index: t
    }));
    c.sort((e, t) => t.score - e.score);
    const l = c.slice(0, t);
    return l.sort((e, t) => e.index - t.index),
    l.map(e => e.sentence).join(" ")
  }
}
class GoapAction {
  constructor(e) {
    this.name = e,
    this.preconditions = {
    },
    this.effects = {
    },
    this.cost = 1
  }
  addPrecondition(e, t) {
    return this.preconditions[e] = t,
    this
  }
  addEffect(e, t) {
    return this.effects[e] = t,
    this
  }
  setCost(e) {
    return this.cost = e,
    this
  }
}
class GoapPlanner {
  plan(e, t, n) {
  }
  _goalAchieved(e, t) {
    for (const n in e) if (t[n] !== e[n]) return !1;
    return !0
  }
  _isActionUsable(e, t) {
    for (const n in e.preconditions) if (t[n] !== e.preconditions[n]) return !1;
    return !0
  }
  _applyState(e, t) {
    return {
      ...e,
      ...t
    }
  }
}
const createActionLibrary = () => {
  const e = [];
  return e.push(new GoapAction("Tìm Chìa Khóa").addPrecondition("cóChìaKhóa", !1).addEffect("cóChìaKhóa",
      !0).setCost(5)),
  e.push(new GoapAction("Mở Khóa Cửa").addPrecondition("cửaĐãKhóa", !0).addPrecondition("cóChìaKhóa",
      !0).addEffect("cửaĐãKhóa", !1).addEffect("cửaĐãMở", !0)),
  e.push(new GoapAction("Đi Đến Quán Rượu").addPrecondition("vịTrí", "làng").addEffect("vịTrí",
      "quán rượu")),
  e.push(new GoapAction("Thu Thập Thảo Dược").addPrecondition("vịTrí", "rừng").addEffect("cóThảoDược",
      !0)),
  e
},
goalDictionary = {
  "mở cửa":{
    "cửaĐãMở": !0
  },
  "tìm chìa khóa":{
    "cóChìaKhóa": !0
  },
  "thu thập thảo dược":{
    "cóThảoDược": !0
  }
},
translateGoal = e => {
  if (!e) return null;
  const t = e.toLowerCase();
  for (const e in goalDictionary) if (t.includes(e)) return goalDictionary[e];
  return null
};
function parseKeyValueString(e) {
  const t = {
  },
  n = /([\w\u00C0-\u017F\s]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([\w\u00C0-\u017F\s\d.:\/+\-_%À-ỹ]+?(?=\s*,\s*[\w\u00C0-\u017F\s]+\s*=|$)))/gu;
  let a;
  for (; null !== (a = n.exec(e)); ) {
    const e = a[1].trim();
    let n = a[2] || a[3] || a[4];
    if (void 0 !== n) {
      const a = n.trim();
      "true" === a.toLowerCase() ? t[e] = !0 : "false" === a.toLowerCase() ? t[e] = !1 : /^\d+(\.\d+)?$/.test(a) && !isNaN(parseFloat(a)) ? t[e] = parseFloat(a) : t[e] = a
    }
  }
  return t
}
const CharacterInfoModal = ({
  knowledge: e,
  show: t,
  onClose: n,
  characterName: a,
  onDeleteItem: r,
  onAddItem: c,
  onUpdateItem: l,
  onAutoUpdateNpc: s
}) => {
  const [o,
    h] = React.useState(null),
  [m,
    g] = React.useState({
    field1: "",
    field2: "",
    field3: "",
    field4: "",
    field5: "",
    field6: "",
    field7: "",
    field8: "",
    field9: "",
    field10: "",
    field11: ""
  }),
  [u,
    d] = React.useState(null),
  [p,
    N] = React.useState({
  });
  if (!t) return null;
  const y = (e, t) => {
    g(n => ({
      ...n,
      [e]: t
    }))
  },
  T = (e, t) => {
    g(n => ({
      ...n,
      [e]: t
    }))
  },
  C = e => o !== e ? null : React.createElement("div",
    {
    className: "bg-gray-900/80 p-3 rounded-md mt-2 border border-purple-500/50 mb-3 space-y-2"
  },
    "playerStatus" === e && React.createElement(React.Fragment, null,
      React.createElement("input",
        {
    type: "text",
    placeholder: "Tên trạng thái...",
    value: m.field1,
    onChange: e => y("field1", e.target.value),
    className: "w-full p-2 bg-gray-700 border border-gray-600 rounded text-sm text-white"
  }),
      React.createElement("input",
        {
    type: "text",
    placeholder: "Loại (buff / debuff / injury / neutral)...",
    value: m.field2,
    onChange: e => y("field2", e.target.value),
    className: "w-full p-2 bg-gray-700 border border-gray-600 rounded text-sm text-white"
  }),
      React.createElement("textarea",
        {
    placeholder: "Mô tả chi tiết...",
    value: m.field3,
    onChange: e => y("field3", e.target.value),
    rows: "2",
    className: "w-full p-2 bg-gray-700 border border-gray-600 rounded text-sm text-white"
  }),
      React.createElement("input",
        {
    type: "text",
    placeholder: "Thời gian (VD: 3 lượt, Vĩnh viễn)...",
    value: m.field4,
    onChange: e => y("field4", e.target.value),
    className: "w-full p-2 bg-gray-700 border border-gray-600 rounded text-sm text-white"
  }),
      React.createElement("input",
        {
    type: "text",
    placeholder: "Ảnh hưởng (VD: -10 HP/lượt)...",
    value: m.field5,
    onChange: e => y("field5", e.target.value),
    className: "w-full p-2 bg-gray-700 border border-gray-600 rounded text-sm text-white"
  }),
      React.createElement("input",
        {
    type: "text",
    placeholder: "Điều kiện gỡ bỏ (VD: Dùng thuốc giải)...",
    value: m.field6,
    onChange: e => y("field6", e.target.value),
    className: "w-full p-2 bg-gray-700 border border-gray-600 rounded text-sm text-white"
  }),
      React.createElement("input",
        {
    type: "text",
    placeholder: "Nguồn gốc...",
    value: m.field7,
    onChange: e => y("field7", e.target.value),
    className: "w-full p-2 bg-gray-700 border border-gray-600 rounded text-sm text-white"
  })),
    "inventory" === e && React.createElement(React.Fragment, null,
      React.createElement("input",
        {
    type: "text",
    placeholder: "Tên vật phẩm...",
    value: m.field1,
    onChange: e => y("field1", e.target.value),
    className: "w-full p-2 bg-gray-700 border border-gray-600 rounded text-sm text-white"
  }),
      React.createElement("input",
        {
    type: "text",
    placeholder: "Loại (Vũ khí, Đan dược, Bảo bối)...",
    value: m.field2,
    onChange: e => y("field2", e.target.value),
    className: "w-full p-2 bg-gray-700 border border-gray-600 rounded text-sm text-white"
  }),
      React.createElement("textarea",
        {
    placeholder: "Mô tả chi tiết...",
    value: m.field3,
    onChange: e => y("field3", e.target.value),
    rows: "2",
    className: "w-full p-2 bg-gray-700 border border-gray-600 rounded text-sm text-white"
  }),
      React.createElement("div", {
    className: "flex gap-4 text-sm text-gray-300"
  },
        React.createElement("label", null,
          React.createElement("input",
            {
    type: "checkbox",
    checked: m.field4 || !1,
    onChange: e => T("field4", e.target.checked),
    className: "mr-1"
  }), " Có thể trang bị"),
        React.createElement("label", null,
          React.createElement("input",
            {
    type: "checkbox",
    checked: void 0 === m.field5 || m.field5,
    onChange: e => T("field5", e.target.checked),
    className: "mr-1"
  }), " Có thể dùng"),
        React.createElement("label", null,
          React.createElement("input",
            {
    type: "checkbox",
    checked: m.field6 || !1,
    onChange: e => T("field6", e.target.checked),
    className: "mr-1"
  }), " Tiêu hao")),
      React.createElement("input",
        {
    type: "number",
    placeholder: "Số lần sử dụng (mặc định 1)...",
    value: m.field7 || "",
    onChange: e => y("field7", e.target.value),
    className: "w-full p-2 bg-gray-700 border border-gray-600 rounded text-sm text-white"
  })),
    "playerSkills" === e && React.createElement(React.Fragment, null,
      React.createElement("input",
        {
    type: "text",
    placeholder: "Tên kỹ năng...",
    value: m.field1,
    onChange: e => y("field1", e.target.value),
    className: "w-full p-2 bg-gray-700 border border-gray-600 rounded text-sm text-white"
  }),
      React.createElement("input",
        {
    type: "text",
    placeholder: "Loại (Chủ động, Nội tại, Chế tạo)...",
    value: m.field2,
    onChange: e => y("field2", e.target.value),
    className: "w-full p-2 bg-gray-700 border border-gray-600 rounded text-sm text-white"
  }),
      React.createElement("textarea",
        {
    placeholder: "Mô tả chi tiết...",
    value: m.field3,
    onChange: e => y("field3", e.target.value),
    rows: "2",
    className: "w-full p-2 bg-gray-700 border border-gray-600 rounded text-sm text-white"
  })),
    "npcs" === e && React.createElement(React.Fragment, null,
      React.createElement("input",
        {
    type: "text",
    placeholder: "Tên NPC...",
    value: m.field1,
    onChange: e => y("field1", e.target.value),
    className: "w-full p-2 bg-gray-700 border border-gray-600 rounded text-sm text-white"
  }),
      React.createElement("input",
        {
    type: "text",
    placeholder: "Tính cách (VD: Lạnh lùng, Đa nghi)...",
    value: m.field2,
    onChange: e => y("field2", e.target.value),
    className: "w-full p-2 bg-gray-700 border border-gray-600 rounded text-sm text-white"
  }),
      React.createElement("textarea",
        {
    placeholder: "Xuất thân/Nguồn gốc (Tĩnh - VD: Con trai trưởng làng)...",
    value: m.field10,
    onChange: e => y("field10", e.target.value),
    rows: "2",
    className: "w-full p-2 bg-indigo-900/50 border border-indigo-600 rounded text-sm text-white"
  }),
      React.createElement("textarea",
        {
    placeholder: "Dung mạo (Hình thể, khuôn mặt, đặc điểm nhận dạng)...",
    value: m.field11,
    onChange: e => y("field11", e.target.value),
    rows: "2",
    className: "w-full p-2 bg-teal-900/50 border border-teal-600 rounded text-sm text-white"
  }),
      React.createElement("textarea",
        {
    placeholder: "Trạng thái hiện tại (Động - Đang ở đâu, làm gì, tu vi gì)...",
    value: m.field3,
    onChange: e => y("field3", e.target.value),
    rows: "2",
    className: "w-full p-2 bg-gray-700 border border-gray-600 rounded text-sm text-white"
  }),
      React.createElement("input",
        {
    type: "text",
    placeholder: "Mục tiêu (Goal)...",
    value: m.field4,
    onChange: e => y("field4", e.target.value),
    className: "w-full p-2 bg-gray-700 border border-gray-600 rounded text-sm text-white"
  }),
      React.createElement("input",
        {
    type: "text",
    placeholder: "Kế hoạch (Plan - cách nhau bằng dấu chấm phẩy ;)...",
    value: m.field5,
    onChange: e => y("field5", e.target.value),
    className: "w-full p-2 bg-gray-700 border border-gray-600 rounded text-sm text-white"
  }),
      React.createElement("input",
        {
    type: "text",
    placeholder: "Niềm tin (Beliefs)...",
    value: m.field6,
    onChange: e => y("field6", e.target.value),
    className: "w-full p-2 bg-gray-700 border border-gray-600 rounded text-sm text-white"
  }),
      React.createElement("input",
        {
    type: "text",
    placeholder: "Kỹ năng (Skills - cách nhau bằng dấu chấm phẩy ;)...",
    value: m.field7,
    onChange: e => y("field7", e.target.value),
    className: "w-full p-2 bg-gray-700 border border-gray-600 rounded text-sm text-white"
  }),
      React.createElement("div", {
    className: "grid grid-cols-2 gap-2"
  },
        React.createElement("input",
          {
    type: "text",
    placeholder: "Ngươi gọi NPC là...",
    value: m.field8,
    onChange: e => y("field8", e.target.value),
    className: "w-full p-2 bg-gray-700 border border-gray-600 rounded text-sm text-white"
  }),
        React.createElement("input",
          {
    type: "text",
    placeholder: "NPC gọi ngươi là...",
    value: m.field9,
    onChange: e => y("field9", e.target.value),
    className: "w-full p-2 bg-gray-700 border border-gray-600 rounded text-sm text-white"
  }))),
    React.createElement("div", {
    className: "flex justify-end gap-2 mt-2"
  },
      React.createElement("button",
        {
    onClick: () => {
      h(null),
            g({
        field1: "",
        field2: "",
        field3: "",
        field4: "",
        field5: "",
        field6: "",
        field7: "",
        field8: "",
        field9: ""
      })
    },
    className: "px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-xs text-white"
  }, "Hủy"),
      React.createElement("button",
        {
    onClick: () => (e => {
      let t = {
      };
      if ("playerStatus" === e) {
        if (!m.field1) return;
        t = {
          name: m.field1,
          type: m.field2 || "neutral",
          description: m.field3,
          duration: m.field4 || "Chưa rõ",
          effects: m.field5 || "Chưa rõ",
          cureConditions: m.field6 || "Chưa rõ",
          source: m.field7 || "Chủ quản thế giới (Hệ thống)"
        }
      } else if ("inventory" === e) {
        if (!m.field1) return;
        t = {
          Name: m.field1,
          Type: m.field2 || "Vật phẩm",
          Description: m.field3,
          Equippable: m.field4 || !1,
          Usable: m.field5 || !0,
          Consumable: m.field6 || !1,
          Uses: parseInt(m.field7) || 1
        }
      } else if ("playerSkills" === e) {
        if (!m.field1) return;
        t = {
          Name: m.field1,
          Type: m.field2 || "Kỹ năng",
          Description: m.field3
        }
      } else if ("npcs" === e) {
        if (!m.field1) return;
        t = {
          Name: m.field1,
          Personality: m.field2 || "Bình thường",
          Origin: m.field10 || "Chưa rõ xuất thân",
          Appearance: m.field11 || "Chưa rõ dung mạo",
          Description: m.field3 || "Chưa có trạng thái hiện tại",
          Goal: m.field4 || "Sống sót",
          Plan: m.field5 ? m.field5.split(";").map(e => e.trim()) : [],
          Beliefs: m.field6 || "Chưa rõ",
          Skills: m.field7 || "Không có",
          PlayerToNpcCall: m.field8 || "Ngươi",
          NpcToPlayerCall: m.field9 || "Ta",
          lifeStatus: "alive",
          relationships: [],
          memory: [],
          skills: m.field7 ? m.field7.split(";").map(e => e.trim()) : [],
          plan: m.field5 ? m.field5.split(";").map(e => e.trim()) : [],
          statuses: []
        }
      }
      c && Object.keys(t).length > 0 && (c(e, t), h(null),
                g({
        field1: "",
        field2: "",
        field3: "",
        field4: "",
        field5: "",
        field6: "",
        field7: "",
        field8: "",
        field9: ""
      }))
    })(e),
    className: "px-3 py-1 bg-green-600 hover:bg-green-500 rounded text-xs text-white font-bold"
  }, "Lưu Vào Game"))),
  f = (e, t, n, a = "text-green-300", i, c = "Chưa có thông tin.", l) => {
    const s = ["playerStatus",
      "inventory",
      "playerSkills",
      "npcs"].includes(l);
    return React.createElement("div", {
      className: "mb-4"
    },
      React.createElement("div", {
      className: "flex justify-between items-center mb-2"
    },
        React.createElement("h4",
          {
      className: `text-lg font-semibold ${a} flex items-center`
    }, n, " ", e),
        s && React.createElement("button",
          {
      onClick: () => {
        h(l),
              g({
          field1: "",
          field2: "",
          field3: ""
        })
      },
      className: "bg-purple-700 hover:bg-purple-600 text-white text-xs px-2 py-1 rounded font-bold transition-colors"
    }, "+ Thêm")), C(l),
      t && 0 !== t.length ? React.createElement("ul", {
      className: "space-y-1.5 text-sm"
    },
        t.map((e, t) => React.createElement("li",
            {
      key: e.id || `item-${t}`,
      className: "group flex items-start justify-between gap-2 p-2 bg-gray-700/50 rounded-md"
    }, React.createElement("div", {
      className: "flex-grow"
    }, i(e, t, a)),
            r && e.id && l && React.createElement("button",
              {
      onClick: () => r(e.id, l),
      className: "opacity-0 group-hover:opacity-100 transition-opacity bg-red-700 hover:bg-red-600 text-white font-bold p-1 rounded-md text-xs flex-shrink-0",
      title: "Xóa mục này"
    }, "🗑️")))): React.createElement("p", {
      className: "text-gray-400 italic text-sm pl-2"
    }, c))
  };
  return React.createElement("div",
    {
    className: "fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50"
  },
    React.createElement("div",
      {
    className: "bg-gray-800 p-6 rounded-xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col border border-purple-600"
  },
      React.createElement("h3",
        {
    className: "text-2xl font-bold text-purple-400 mb-4 flex items-center"
  }, "📝 Thông Tin Nhân Vật & Thế Giới"),
      React.createElement("div",
        {
    className: "overflow-y-auto flex-grow pr-2 scrollbar-thin scrollbar-thumb-purple-500 scrollbar-track-gray-700"
  },
        React.createElement("div", {
    className: "mb-4"
  },
          React.createElement("h4",
            {
    className: "text-lg font-semibold text-amber-400 mb-1 flex items-center"
  }, "👤 Nhân Vật Chính"),
          a && React.createElement("p", {
    className: "text-gray-300 text-sm pl-2"
  }, "Tên: ", a)),
        f("Trạng Thái Hiện Tại", e.playerStatus, "ℹ️", "text-indigo-400",
          (e, t, n) => React.createElement(React.Fragment, null,
            React.createElement("strong", {
    className: n
  },
              (e => {
    switch (e?.toLowerCase()) {
      case "buff": return "✅";
      case "debuff": return "💔";
      case "injury": return "⚠️";
      default: return "ℹ️"
    }
  })(e.type), " ", e.name || "Trạng thái không tên"), ": ",
            e.description || "Không có mô tả.",
            React.createElement("div", {
    className: "text-xs text-gray-400 ml-3"
  },
              e.duration && React.createElement("span", null, "Thời gian: ", e.duration, ". "),
              e.effects && React.createElement("span", null, "Ảnh hưởng: ", e.effects, ". "),
              e.source && React.createElement("span", null, "Nguồn: ", e.source, "."))),
          "Không có trạng thái nào đang hoạt động.", "playerStatus"),
        f("Mối Quan Hệ", e.relationships, "❤️", "text-pink-400",
          (e, t) => React.createElement(React.Fragment, null,
            React.createElement("strong", {
    className: "text-pink-300"
  }, e.NPC), ": ", e.score, " điểm",
            React.createElement("div", {
    className: "text-xs text-gray-400 ml-3"
  }, "- Ngươi gọi họ: ",
              React.createElement("span", {
    className: "font-semibold text-gray-200"
  }, e.PlayerToNpcCall || "Chưa xác định"), React.createElement("br", null), "- Họ gọi ngươi: ",
              React.createElement("span", {
    className: "font-semibold text-gray-200"
  }, e.NpcToPlayerCall || "Chưa xác định"))), "Chưa có mối quan hệ nào được thiết lập.",
          "relationships"),
        f("Nhật Ký Nhiệm Vụ", e.quests, "📜", "text-yellow-400", (e, t) => {
    return React.createElement(React.Fragment, null,
              React.createElement("div", {
      className: "flex justify-between items-start"
    },
                React.createElement("strong",
                  {
      className: "font-semibold " + (n = e.status,
                      "completed" === n ? "text-green-400" : "failed" === n ? "text-red-400" : "text-yellow-400")
    }, e.title || "Nhiệm vụ không tên"),
                React.createElement("span",
                  {
      className: "text-xs px-1.5 py-0.5 rounded-full " + ("completed" === e.status ? "bg-green-600" : "failed" === e.status ? "bg-red-600" : "bg-yellow-600")
    },
                  "active" === e.status ? "Đang làm" : "completed" === e.status ? "Hoàn thành" : "Thất bại")),
              React.createElement("p", {
      className: "text-xs text-gray-300 mt-1"
    }, e.description || "Không có mô tả."),
              Array.isArray(e.objectives) && e.objectives.length > 0 && React.createElement("ul",
                {
      className: "list-disc list-inside text-xs text-gray-400 mt-1 pl-3"
    },
                e.objectives.map((e, t) => React.createElement("li",
                    {
      key: t,
      className: e.completed ? "line-through text-gray-500" : ""
    }, e.text))));
    var n
  }, "Chưa nhận nhiệm vụ nào."),
        f("Balo Đồ", e.inventory, "🎒", "text-orange-400",
          (e, t, n) => React.createElement(React.Fragment, null,
            React.createElement("strong", {
    className: n
  }, e.Name || "Vật phẩm không tên"), ": ", e.Description || "Không có mô tả.",
            React.createElement("span", {
    className: "text-xs text-gray-400 ml-1"
  }, "(", e.Type || "Chưa rõ loại", ")", e.Equippable ? " (Có thể trang bị)" : "",
              e.Usable ? " (Có thể sử dụng)" : "", e.Consumable ? " (Tiêu hao)" : "",
              "number" == typeof e.Uses ? ` (Còn ${e.Uses} lần)` : "")),
          "Trong balo không có gì.", "inventory"),
        f("Kỹ Năng", e.playerSkills, "⚡", "text-yellow-400",
          (e, t, n) => React.createElement(React.Fragment, null,
            React.createElement("strong", {
    className: n
  }, e.Name || "Kỹ năng không tên"), ": ", e.Description || "Không có mô tả.",
            e.Type && React.createElement("span", {
    className: "text-xs text-gray-400 ml-1"
  }, "(", e.Type, ")")), "Chưa học được kỹ năng nào.", "playerSkills"),
        f("Nhân Vật Đã Gặp", e.npcs, "👥", "text-sky-400",
          (e, t, n) => u === e.id ? React.createElement("div",
            {
    className: "flex flex-col gap-2 w-full mt-2 bg-gray-900/50 p-3 rounded-lg border border-sky-500/50"
  },
            React.createElement("input",
              {
    type: "text",
    value: p.Name || "",
    onChange: e => N({
      ...p,
      Name: e.target.value
    }),
    placeholder: "Tên NPC",
    className: "w-full p-2 bg-gray-700 border-gray-600 rounded text-sm text-white"
  }),
            React.createElement("input",
              {
    type: "text",
    value: p.Personality || "",
    onChange: e => N({
      ...p,
      Personality: e.target.value
    }),
    placeholder: "Tính cách",
    className: "w-full p-2 bg-gray-700 border-gray-600 rounded text-sm text-white"
  }),
            React.createElement("div", {
    className: "grid grid-cols-3 gap-2"
  },
              React.createElement("input",
                {
    type: "text",
    value: p.Age || "",
    onChange: e => N({
      ...p,
      Age: e.target.value
    }),
    placeholder: "Tuổi",
    className: "w-full p-2 bg-gray-700 border-gray-600 rounded text-xs text-white"
  }),
              React.createElement("input",
                {
    type: "text",
    value: p.Faction || "",
    onChange: e => N({
      ...p,
      Faction: e.target.value
    }),
    placeholder: "Phe phái",
    className: "w-full p-2 bg-gray-700 border-gray-600 rounded text-xs text-white"
  }),
              React.createElement("input",
                {
    type: "text",
    value: p.Wealth || "",
    onChange: e => N({
      ...p,
      Wealth: e.target.value
    }),
    placeholder: "Tài sản",
    className: "w-full p-2 bg-gray-700 border-gray-600 rounded text-xs text-white"
  })),
            React.createElement("textarea",
              {
    value: p.Origin || "",
    onChange: e => N({
      ...p,
      Origin: e.target.value
    }),
    placeholder: "Xuất thân/Nguồn gốc (Tĩnh)...",
    rows: "2",
    className: "w-full p-2 bg-indigo-900/50 border-indigo-600 rounded text-sm text-white"
  }),
            React.createElement("textarea",
              {
    value: p.Appearance || "",
    onChange: e => N({
      ...p,
      Appearance: e.target.value
    }),
    placeholder: "Dung mạo (Hình thể)...",
    rows: "2",
    className: "w-full p-2 bg-teal-900/50 border-teal-600 rounded text-sm text-white"
  }),
            React.createElement("textarea",
              {
    value: p.Description || "",
    onChange: e => N({
      ...p,
      Description: e.target.value
    }),
    placeholder: "Trạng thái hiện tại (Động)...",
    rows: "2",
    className: "w-full p-2 bg-gray-700 border-gray-600 rounded text-sm text-white"
  }),
            React.createElement("input",
              {
    type: "text",
    value: p.Goal || "",
    onChange: e => N({
      ...p,
      Goal: e.target.value
    }),
    placeholder: "Mục tiêu",
    className: "w-full p-2 bg-gray-700 border-gray-600 rounded text-sm text-white"
  }),
            React.createElement("input",
              {
    type: "text",
    value: p.Beliefs || "",
    onChange: e => N({
      ...p,
      Beliefs: e.target.value
    }),
    placeholder: "Niềm tin",
    className: "w-full p-2 bg-gray-700 border-gray-600 rounded text-sm text-white"
  }),
            React.createElement("div", {
    className: "grid grid-cols-2 gap-2"
  },
              React.createElement("input", {
    type: "text",
    value: p.TrueEgo || "",
    onChange: e => N({
      ...p,
      TrueEgo: e.target.value
    }),
    placeholder: "Bản ngã thật (TrueEgo)...",
    className: "w-full p-2 bg-pink-900/40 border border-pink-600 rounded text-xs text-white"
  }),
              React.createElement("input", {
    type: "text",
    value: p.Persona || "",
    onChange: e => N({
      ...p,
      Persona: e.target.value
    }),
    placeholder: "Vỏ bọc (Persona)...",
    className: "w-full p-2 bg-purple-900/40 border border-purple-600 rounded text-xs text-white"
  }),
              React.createElement("input", {
    type: "text",
    value: p.StateOfMind || "",
    onChange: e => N({
      ...p,
      StateOfMind: e.target.value
    }),
    placeholder: "Tâm trạng (StateOfMind)...",
    className: "w-full p-2 bg-gray-700 border-gray-600 rounded text-xs text-white"
  }),
              React.createElement("input", {
    type: "text",
    value: p.Boundaries || "",
    onChange: e => N({
      ...p,
      Boundaries: e.target.value
    }),
    placeholder: "Giới hạn đạo đức (Boundaries)...",
    className: "w-full p-2 bg-gray-700 border-gray-600 rounded text-xs text-white"
  }),
              React.createElement("input", {
    type: "text",
    value: p.CoreDesire || "",
    onChange: e => N({
      ...p,
      CoreDesire: e.target.value
    }),
    placeholder: "Khao khát thầm kín (CoreDesire)...",
    className: "w-full p-2 bg-gray-700 border-gray-600 rounded text-xs text-white"
  }),
              React.createElement("input", {
    type: "text",
    value: p.CoreFear || "",
    onChange: e => N({
      ...p,
      CoreFear: e.target.value
    }),
    placeholder: "Sợ hãi sâu xa (CoreFear)...",
    className: "w-full p-2 bg-gray-700 border-gray-600 rounded text-xs text-white"
  }),
              React.createElement("input", {
    type: "text",
    value: p.SpeakingStyle || "",
    onChange: e => N({
      ...p,
      SpeakingStyle: e.target.value
    }),
    placeholder: "Phong cách nói (SpeakingStyle)...",
    className: "w-full p-2 bg-gray-700 border-gray-600 rounded text-xs text-white"
  }),
              React.createElement("input", {
    type: "text",
    value: p.TypicalSchedule || "",
    onChange: e => N({
      ...p,
      TypicalSchedule: e.target.value
    }),
    placeholder: "Lịch thường nhật (TypicalSchedule)...",
    className: "w-full p-2 bg-gray-700 border-gray-600 rounded text-xs text-white"
  })),
            React.createElement("input",
              {
    type: "text",
    value: p.plan ? p.plan.join("; ") : "",
    onChange: e => N({
      ...p,
      plan: e.target.value.split(";").map(e => e.trim())
    }),
    placeholder: "Kế hoạch (cách nhau bởi ;)",
    className: "w-full p-2 bg-gray-700 border-gray-600 rounded text-sm text-white"
  }),
            React.createElement("input",
              {
    type: "text",
    value: p.skills ? p.skills.join("; ") : "",
    onChange: e => N({
      ...p,
      skills: e.target.value.split(";").map(e => e.trim())
    }),
    placeholder: "Kỹ năng (cách nhau bởi ;)",
    className: "w-full p-2 bg-gray-700 border-gray-600 rounded text-sm text-white"
  }),
            React.createElement("div", {
    className: "flex justify-end gap-2 mt-2"
  },
              React.createElement("button",
                {
    onClick: () => d(null),
    className: "px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded text-xs text-white"
  }, "Hủy"),
              React.createElement("button",
                {
    onClick: () => {
      l("npcs", e.id, p),
                    d(null)
    },
    className: "px-3 py-1.5 bg-sky-600 hover:bg-sky-500 rounded text-xs text-white font-bold"
  }, "Lưu Thay Đổi"))): React.createElement("div", {
    className: "w-full"
  },
            React.createElement("div", {
    className: "flex justify-between items-start"
  },
              React.createElement("div", null,
                React.createElement("strong", {
    className: n
  }, e.Name || "Không rõ tên"),
                e.Personality && React.createElement("span",
                  {
    className: "text-gray-400 text-xs"
  }, " (Tính cách: ", e.Personality, ")")),
              React.createElement("div",
                {
    className: "flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
  },
                React.createElement("button",
                  {
    onClick: () => s(e.id),
    className: "bg-purple-600 hover:bg-purple-500 text-white p-1 rounded-md text-xs flex items-center justify-center",
    title: "AI Tự Động Cập Nhật Hồ Sơ"
  }, "✨ AI"),
                React.createElement("button",
                  {
    onClick: () => {
      d(e.id),
                      N(e)
    },
    className: "bg-sky-700 hover:bg-sky-600 text-white p-1 rounded-md text-xs flex items-center justify-center",
    title: "Sửa thông tin"
  }, "✏️ Sửa"))),
            e.Origin && React.createElement("div", {
    className: "text-xs mt-1"
  }, React.createElement("strong", {
    className: "text-indigo-400"
  }, "Xuất thân:"), " ",
              React.createElement("span", {
    className: "text-indigo-200"
  }, e.Origin)),
            e.Appearance && React.createElement("div", {
    className: "text-xs mt-0.5"
  }, React.createElement("strong", {
    className: "text-teal-400"
  }, "Dung mạo:"), " ",
              React.createElement("span", {
    className: "text-teal-200"
  }, e.Appearance)),
            React.createElement("div", {
    className: "text-sm mt-1"
  },
              React.createElement("strong", {
    className: "text-gray-400 text-xs"
  }, "Hiện trạng: "),
              React.createElement("span", {
    className: "text-gray-200"
  }, e.Description || "Chưa có thông tin.")),
            e.Goal && React.createElement("div", {
    className: "mt-2 text-xs"
  }, React.createElement("strong", {
    className: "text-red-400"
  }, "Mục tiêu:"), " ",
              React.createElement("span", {
    className: "text-gray-300"
  }, e.Goal)),
            e.plan && e.plan.length > 0 && React.createElement("div",
              {
    className: "mt-2 text-xs"
  }, React.createElement("strong", {
    className: "text-yellow-400"
  }, "Kế hoạch:"),
              React.createElement("ul",
                {
    className: "list-decimal list-inside pl-2 text-gray-400"
  }, e.plan.map((e, t) => React.createElement("li", {
    key: t
  }, e)))),
            e.Beliefs && React.createElement("div", {
    className: "mt-2 text-xs"
  }, React.createElement("strong", {
    className: "text-purple-400"
  }, "Niềm tin:"), " ",
              React.createElement("span", {
    className: "text-gray-300 italic"
  }, '"', e.Beliefs, '"')),
            (e.TrueEgo || e.Persona || e.StateOfMind || e.Boundaries || e.CoreDesire || e.CoreFear || e.SpeakingStyle || e.TypicalSchedule) && React.createElement("div", {
    className: "mt-2 text-xs space-y-0.5 border-l-2 border-pink-500/40 pl-2"
  }, e.TrueEgo && React.createElement("div", null, React.createElement("strong", {
    className: "text-pink-400"
  }, "Bản ngã:"), " ", e.TrueEgo), e.Persona && React.createElement("div", null, React.createElement("strong", {
    className: "text-purple-300"
  }, "Vỏ bọc:"), " ", e.Persona), e.StateOfMind && React.createElement("div", null, React.createElement("strong", {
    className: "text-sky-300"
  }, "Tâm trạng:"), " ", e.StateOfMind), e.Boundaries && React.createElement("div", null, React.createElement("strong", {
    className: "text-amber-300"
  }, "Giới hạn:"), " ", e.Boundaries), e.CoreDesire && React.createElement("div", null, React.createElement("strong", {
    className: "text-rose-300"
  }, "Khao khát:"), " ", e.CoreDesire), e.CoreFear && React.createElement("div", null, React.createElement("strong", {
    className: "text-red-300"
  }, "Sợ hãi:"), " ", e.CoreFear), e.SpeakingStyle && React.createElement("div", null, React.createElement("strong", {
    className: "text-cyan-300"
  }, "Nói năng:"), " ", e.SpeakingStyle), e.TypicalSchedule && React.createElement("div", null, React.createElement("strong", {
    className: "text-lime-300"
  }, "Lịch thường nhật:"), " ", e.TypicalSchedule)),
            e.skills && e.skills.length > 0 && React.createElement("div",
              {
    className: "mt-2 text-xs"
  }, React.createElement("strong", {
    className: "text-green-400"
  }, "Kỹ năng:"), " ",
              React.createElement("span", {
    className: "text-gray-300"
  }, e.skills.join(", ")))), "Chưa gặp nhân vật nào.", "npcs"),
        f("Vật Phẩm Thế Giới", e.items, "✨", "text-yellow-400",
          (e, t, n) => React.createElement(React.Fragment, null,
            React.createElement("strong", {
    className: n
  }, e.Name || "Không rõ tên", ":"), " ", e.Description || "Chưa có mô tả.")),
        f("Địa Điểm Đã Khám Phá", e.locations, "🗺️", "text-blue-400",
          (e, t, n) => React.createElement(React.Fragment, null,
            React.createElement("strong", {
    className: n
  }, e.Name || "Không rõ tên", ":"), " ", e.Description || "Chưa có mô tả.")),
        f("Đồng Hành", e.companions, "👨‍👩‍👧‍", "text-lime-400",
          (e, t, n) => React.createElement(React.Fragment, null,
            React.createElement("strong", {
    className: n
  }, e.Name || "Không rõ tên"),
            e.Personality && React.createElement("span",
              {
    className: "text-gray-400 text-xs"
  }, " (Tính cách: ", e.Personality, ")"), ": ", e.Description || "Chưa có mô tả.",
            e.Stats && React.createElement("span", {
    className: "text-xs text-gray-400 ml-2"
  }, "(", e.Stats, ")"),
            e.statuses && e.statuses.length > 0 && React.createElement("div",
              {
    className: "text-xs text-gray-400 ml-3 mt-0.5"
  }, "Trạng thái Đồng Hành: ",
              e.statuses.map(e => `${e.name} (${e.type})`).join(", "))))),
      React.createElement("button",
        {
    onClick: n,
    className: "mt-6 w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg"
  }, "Đóng")))
},
QuickLoreModal = ({
  loreItem: e,
  show: t,
  onClose: n
}) => {
  if (!t || !e) return null;
  let a = "ℹ️";
  const i = e.category?.toLowerCase();
  if ("npcs" === i) a = "👥";
  else if ("items" === i || "inventory" === i) a = "✨";
  else if ("companions" === i) a = "👨‍👩‍👧‍👦";
  else if ("playerskills" === i) a = "⚡";
  else if ("relationships" === i) a = "❤️";
  else if ("playerstatus" === i) switch (e.type?.toLowerCase()) {
    case "buff": a = "✅";
    break;
    case "debuff": a = "?";
    break;
    case "injury": a = "⚠️";
    break;
    default: a = "ℹ️"
  }
  return React.createElement("div",
    {
    className: "fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-[80]",
    onClick: n
  },
    React.createElement("div",
      {
    className: "bg-gray-700 p-5 rounded-lg shadow-xl w-full max-w-sm border border-cyan-700",
    onClick: e => e.stopPropagation()
  },
      React.createElement("div", {
    className: "flex items-start mb-2"
  }, React.createElement("span", {
    className: "text-xl mr-2 mt-1"
  }, a),
        React.createElement("h4", {
    className: "text-lg font-semibold text-cyan-300"
  }, e.Name || e.NPC || e.name || e.title || "Không rõ tên")),
      React.createElement("p",
        {
    className: "text-sm text-gray-200 bg-gray-600 p-3 rounded max-h-40 overflow-y-auto whitespace-pre-line scrollbar-thin scrollbar-thumb-gray-500 scrollbar-track-gray-600"
  }, e.Description || e.Standing || e.description || "Không có mô tả chi tiết."),
      e.Personality && React.createElement("p", {
    className: "text-xs text-gray-300 mt-1"
  }, React.createElement("strong", null, "Tính cách:"), " ", e.Personality),
      e.duration && React.createElement("p", {
    className: "text-xs text-gray-300 mt-1"
  }, React.createElement("strong", null, "Thời gian:"), " ", e.duration),
      e.effects && React.createElement("p", {
    className: "text-xs text-gray-300 mt-1"
  }, React.createElement("strong", null, "Ảnh hưởng:"), " ", e.effects),
      "quests" === i && React.createElement(React.Fragment, null,
        e.status && React.createElement("p", {
    className: "text-xs text-gray-300 mt-1"
  }, React.createElement("strong", null, "Trạng thái NV:"), " ",
          "active" === e.status ? "Đang làm" : "completed" === e.status ? "Hoàn thành" : "Thất bại"),
        e.objectives && e.objectives.length > 0 && React.createElement("div",
          {
    className: "mt-1"
  },
          React.createElement("p", {
    className: "text-xs text-gray-300 font-semibold"
  }, "Mục tiêu:"),
          React.createElement("ul",
            {
    className: "list-disc list-inside text-xs text-gray-400 pl-3"
  },
            e.objectives.map((e, t) => React.createElement("li",
                {
    key: t,
    className: e.completed ? "line-through text-gray-500" : ""
  }, e.text))))),
      React.createElement("button",
        {
    onClick: n,
    className: "mt-4 w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-3 rounded-md text-sm"
  }, "Đóng")))
},
SuggestedActionsModal = ({
  show: e,
  suggestions: t,
  onSelect: n,
  onClose: a,
  isLoading: i
}) => e ? React.createElement("div",
  {
  className: "fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-[90]"
},
  React.createElement("div",
    {
  className: "bg-gray-700 p-6 rounded-xl shadow-2xl w-full max-w-md border border-purple-700"
},
    React.createElement("h3",
      {
  className: "text-xl font-semibold text-purple-400 mb-4 flex items-center"
}, "💡 Gợi Ý Hành Động"),
    i ? React.createElement("div", {
  className: "flex justify-center items-center h-24"
},
      React.createElement("div",
        {
  className: "w-8 h-8 border-4 border-t-transparent border-purple-400 rounded-full animate-spin"
}),
      React.createElement("p", {
  className: "ml-3 text-gray-300"
}, "AI đang nghĩ gợi ý...")): t.length > 0 ? React.createElement("ul",
      {
  className: "space-y-2 max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-purple-500 scrollbar-track-gray-700"
},
      t.map((e, t) => React.createElement("li", {
  key: t
},
          React.createElement("button",
            {
  onClick: () => {
    n(e),
                a()
  },
  className: "w-full text-left p-3 bg-gray-600 hover:bg-gray-500/80 rounded-md text-gray-200 transition-colors shadow hover:shadow-md"
}, e)))): React.createElement("p", {
  className: "text-gray-400 text-center py-4"
}, "Không có gợi ý nào được tạo ra lúc này."),
    React.createElement("button",
      {
  onClick: a,
  className: "mt-6 w-full bg-gray-500 hover:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg"
}, "Đóng"))): null,
StoryItem = React.memo(({
  item: e,
  formatStoryText: t
}) => React.createElement("div",
    {
  className: "story-item mb-3 p-3 rounded-lg shadow-sm\n            " + ("story" === e.type ? "bg-gray-700/80" : "user_choice" === e.type ? "bg-blue-900/70 text-blue-200 ring-1 ring-blue-700" : "user_custom_action" === e.type ? "bg-indigo-900/70 text-indigo-200 ring-1 ring-indigo-700" : "bg-yellow-800/70 text-yellow-200 ring-1 ring-yellow-700")
},
    "user_choice" === e.type && React.createElement("p",
      {
  className: "font-semibold text-blue-300"
}, "Ngươi đã chọn:"),
    "user_custom_action" === e.type && React.createElement("p",
      {
  className: "font-semibold text-indigo-300"
}, "Hành động của ngươi:"),
    "system" === e.type && React.createElement("p",
      {
  className: "font-semibold text-yellow-300"
}, "Thông báo hệ thống:"),
    e.analysis && React.createElement("div",
      {
  className: "mb-4 bg-gray-800 border-l-4 border-purple-500 p-3 rounded-r-md text-sm text-gray-400"
},
      React.createElement("div",
        {
  className: "font-bold text-purple-400 mb-1 flex items-center"
}, React.createElement("span", {
  className: "mr-2"
}, "🧠"), " AI Đang Suy Nghĩ (Phân Tích Bối Cảnh):"),
      React.createElement("div", {
  className: "whitespace-pre-line italic opacity-80"
}, e.analysis)),
    React.createElement("div",
      {
  className: "prose prose-sm prose-invert max-w-none text-gray-200"
}, t(e.content)))),
GameplayScreen = ({
  goHome: e,
  gameSettings: t,
  restartGame: n,
  storyHistory: a,
  isLoading: i,
  currentStory: r,
  formatStoryText: s,
  customActionInput: o,
  setCustomActionInput: h,
  handleCustomAction: m,
  knowledgeBase: g,
  setShowCharacterInfoModal: u,
  isSaving: d,
  setShowActivityLogModal: p,
  setShowWorldKnowledgeModal: N,
  handleSaveGameToFile: y,
  handleDeleteKnowledgeItem: C
}) => React.createElement("div",
  {
  className: "min-h-screen bg-gray-900 text-gray-100 flex flex-col p-2 md:p-4 font-['Arial',_sans-serif]"
},
  React.createElement("header",
    {
  className: "flex flex-col sm:flex-row justify-between items-center mb-3 gap-2 p-2 bg-gray-800/50 rounded-lg shadow-md"
},
    React.createElement("button",
      {
  onClick: e,
  className: "bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-3 rounded-lg shadow-md transition-colors flex items-center self-start sm:self-center text-sm"
}, "↩️ Về Trang Chủ"),
    React.createElement("div",
      {
  className: "text-center flex-1 mx-2 order-first sm:order-none max-w-md sm:max-w-full"
},
      React.createElement("h1",
        {
  className: "text-lg md:text-xl font-bold text-purple-300",
  title: t.theme || "Cuộc Phiêu Lưu"
}, t.theme || "Cuộc Phiêu Lưu"),
      t.useCharacterGoal && t.characterGoal && React.createElement("div",
        {
  className: "text-xs text-red-300 flex items-start justify-center text-center mt-0.5",
  title: `Mục tiêu: ${t.characterGoal}`
}, React.createElement("span", {
  className: "mr-1"
}, "🎯"),
        React.createElement("span", {
  className: "ml-1 leading-tight"
}, "Mục tiêu: ", t.characterGoal))),
    React.createElement("div",
      {
  className: "flex gap-1.5 self-end sm:self-center flex-wrap justify-end items-center"
},
      d && React.createElement("div",
        {
  className: "text-xs text-gray-400 italic mr-2 animate-pulse"
}, "Đang lưu..."),
      React.createElement("button",
        {
  onClick: y,
  disabled: i,
  className: "bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-2 px-2.5 rounded-lg shadow-md transition-colors flex items-center text-xs disabled:bg-gray-500"
}, "📥 Lưu Vào Tệp"),
      React.createElement("button",
        {
  onClick: () => N(!0),
  disabled: i,
  className: "bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-2.5 rounded-lg shadow-md transition-colors flex items-center text-xs disabled:bg-gray-500"
}, "🌍 Tri Thức"),
      React.createElement("button",
        {
  onClick: () => p(!0),
  disabled: i,
  className: "bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-2.5 rounded-lg shadow-md transition-colors flex items-center text-xs disabled:bg-gray-500"
}, "📖 Nhật Ký"),
      React.createElement("button",
        {
  onClick: () => u(!0),
  disabled: i,
  className: "bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2 px-2.5 rounded-lg shadow-md transition-colors flex items-center text-xs disabled:bg-gray-500"
}, "📝 Thông Tin"),
      React.createElement("button",
        {
  onClick: n,
  disabled: i,
  className: "bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-2.5 rounded-lg shadow-md transition-colors flex items-center text-xs disabled:bg-gray-500"
}, "🔄 Bắt Đầu Lại"))),
  React.createElement("div", {
  className: "grid grid-cols-1 md:grid-cols-3 gap-3 mb-3"
},
    React.createElement("div",
      {
  className: "bg-gray-750 p-3 rounded-xl shadow-lg border border-indigo-700/50 h-full flex flex-col"
},
      React.createElement("h4",
        {
  className: "text-md font-semibold text-indigo-400 mb-1.5 flex items-center"
}, "ℹ️ Trạng Thái Hiện Tại"),
      g.playerStatus && g.playerStatus.length > 0 ? React.createElement("div",
        {
  className: "flex flex-wrap gap-2 text-xs"
},
        g.playerStatus.map((e, t) => {
  let n,
            a = "text-gray-300";
  switch (e.type?.toLowerCase()) {
    case "buff": n = "✅",
              a = "text-green-300";
    break;
    case "debuff": n = "💔",
              a = "text-red-300";
    break;
    case "injury": n = "⚠️",
              a = "text-yellow-300";
    break;
    default: n = "ℹ️",
              a = "text-blue-300"
  }
  return React.createElement("div",
              {
    key: e.id || t,
    className: "group flex items-center bg-gray-700 p-1.5 rounded-md shadow",
    title: `${e.description}`
  },
              React.createElement("div", {
    className: `flex items-center ${a}`
  }, React.createElement("span", {
    className: "mr-1"
  }, n), e.name),
              C && e.id && React.createElement("button",
                {
    onClick: () => C(e.id, "playerStatus"),
    className: "ml-2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-700 hover:bg-red-600 text-white font-bold w-4 h-4 flex items-center justify-center rounded-sm text-[10px]",
    title: "Xóa trạng thái"
  }, "×"))
})): React.createElement("p", {
  className: "text-xs text-gray-400 italic mt-1"
}, "Không có trạng thái nào.")),
    React.createElement("div",
      {
  className: "bg-gray-750 p-3 rounded-xl shadow-lg border border-lime-700/50 h-full flex flex-col"
},
      React.createElement("h4",
        {
  className: "text-md font-semibold text-lime-400 mb-2 flex items-center"
}, "👨‍👩‍👧‍👦 Đồng Hành"),
      g.companions && g.companions.length > 0 ? React.createElement("ul",
        {
  className: "space-y-1 text-sm overflow-y-auto max-h-24 scrollbar-thin scrollbar-thumb-lime-500 scrollbar-track-gray-700"
},
        g.companions.map((e, t) => React.createElement("li",
            {
  key: t,
  className: "text-gray-300 bg-gray-700 p-2 rounded-md"
}, React.createElement("strong", {
  className: "text-lime-300"
}, e.Name)))): React.createElement("p", {
  className: "text-xs text-gray-400 italic mt-1"
}, "Chưa có đồng hành nào.")),
    React.createElement("div",
      {
  className: "bg-gray-750 p-3 rounded-xl shadow-lg border border-yellow-600/50 h-full flex flex-col"
},
      React.createElement("h4",
        {
  className: "text-md font-semibold text-yellow-400 mb-1.5 flex items-center"
}, "📜 Nhiệm Vụ Đang Làm"),
      g.quests && g.quests.filter(e => "active" === e.status).length > 0 ? React.createElement("div",
        {
  className: "flex flex-wrap gap-2 text-xs"
},
        g.quests.filter(e => "active" === e.status).map((e, t) => React.createElement("div",
            {
  key: t,
  className: "flex items-center bg-yellow-700/30 hover:bg-yellow-700/50 p-1.5 rounded-md shadow text-yellow-200 cursor-pointer",
  title: `${e.description}`,
  onClick: () => u(!0)
}, React.createElement("span", {
  className: "mr-1"
}, "📜"), " ", e.title))): React.createElement("p",
        {
  className: "text-xs text-gray-400 italic mt-1"
}, "Không có nhiệm vụ nào đang hoạt động."))),
  React.createElement("div",
    {
  className: "flex-grow bg-gray-800 p-3 md:p-5 rounded-xl shadow-2xl overflow-y-auto mb-3 scrollbar-thin scrollbar-thumb-purple-600 scrollbar-track-gray-700",
  style:{
    maxHeight: "60vh",
    minHeight: "300px"
  },
  id: "story-content-area"
},
    React.createElement("h2", {
  className: "text-lg font-semibold text-green-400 mb-2"
}, "Diễn biến câu chuyện:"),
    a.map(e => React.createElement(StoryItem, {
  key: e.id,
  item: e,
  formatStoryText: s
})),
    i && "" === r && React.createElement("div", {
  className: "text-center py-10"
},
      React.createElement("div",
        {
  className: "animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto"
}),
      React.createElement("p", {
  className: "mt-3 text-purple-300"
}, "AI đang viết tiếp câu chuyện..."))),
  !i && React.createElement("div",
    {
  className: "bg-gray-800 p-3 md:p-5 rounded-xl shadow-xl mt-auto"
},
    t.allowCustomActionInput && React.createElement("div", null,
      React.createElement("label",
        {
  htmlFor: "customActionInput",
  className: "block text-md font-medium text-gray-300 mb-1"
}, "Hoặc nhập hành động tùy ý:"),
      React.createElement("div", {
  className: "flex gap-2"
},
        React.createElement("input",
          {
  type: "text",
  id: "customActionInput",
  value: o,
  onChange: e => h(e.target.value),
  placeholder: "Ví dụ: Nhìn xung quanh, Hỏi về chiếc chìa khóa...",
  className: "flex-grow p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-purple-500 focus:border-purple-500",
  onKeyPress: e => "Enter" === e.key && m(o)
}),
        React.createElement("button",
          {
  onClick: () => m(o),
  disabled: i,
  className: "bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-5 rounded-lg shadow-md hover:shadow-lg transition-colors disabled:bg-gray-500"
}, "Gửi")))),
  i && "" !== r && React.createElement("div",
    {
  className: "text-center py-5"
},
    React.createElement("div",
      {
  className: "animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400 mx-auto"
}),
    React.createElement("p", {
  className: "mt-2 text-purple-300"
}, "Đang viết câu chuyện..."))),
LoadGameModal = ({
  savedGames: e,
  loadGame: t,
  setShowLoadGameModal: n,
  setConfirmationModal: a,
  userId: i,
  setModalMessage: r
}) => React.createElement("div",
  {
  className: "fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50"
},
  React.createElement("div",
    {
  className: "bg-gray-800 p-6 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-blue-600"
},
    React.createElement("h2", {
  className: "text-2xl font-semibold text-purple-400 mb-4"
}, "💾 Tải Game Đã Lưu"),
    0 === e.length ? React.createElement("p", {
  className: "text-gray-400 text-center py-6"
}, "Ngươi chưa có cuộc phiêu lưu nào được lưu lại."): React.createElement("div",
      {
  className: "overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-blue-500 scrollbar-track-gray-700"
},
      e.map(e => {
  return React.createElement("div",
            {
    key: e.id,
    className: "bg-gray-700 p-4 rounded-lg hover:bg-gray-600/80 transition-colors shadow-md hover:shadow-lg"
  },
            React.createElement("h3",
              {
    className: "text-lg font-semibold text-green-400 truncate",
    title: e.settings?.theme
  }, e.settings?.theme || "Game Chưa Có Tên"),
            React.createElement("p", {
    className: "text-sm text-gray-300"
  }, "Nhân vật: ", e.settings?.characterName || "N/A"),
            e.settings?.useCharacterGoal && e.settings?.characterGoal && React.createElement("p",
              {
    className: "text-xs text-red-300 truncate",
    title: `Mục tiêu: ${e.settings.characterGoal}`
  }, "Mục tiêu: ", e.settings.characterGoal.substring(0, 70),
              e.settings.characterGoal.length > 70 ? "..." : ""),
            React.createElement("p", {
    className: "text-xs text-gray-400"
  }, "Lần cập nhật cuối: ",
              e.updatedAt && "function" == typeof e.updatedAt.toDate ? new Date(e.updatedAt.toDate()).toLocaleString("vi-VN") : "Đang xử lý..."),
            React.createElement("p", {
    className: "text-xs text-gray-400"
  }, "Độ khó: ", e.settings?.difficulty || "Không rõ"),
            React.createElement("div", {
    className: "mt-3 flex space-x-2"
  },
              React.createElement("button",
                {
    onClick: () => t(e),
    className: "flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-3 rounded-md text-sm shadow hover:shadow-md transition-all"
  }, "Tải Game Này"),
              React.createElement("button",
                {
    onClick: () => {
      a({
        show: !0,
        title: "Xác Nhận Xóa Game",
        content: `Bạn có chắc chắn muốn xóa game "${e.settings?.theme||e.id}" không? Hành động này không thể hoàn tác.`,
        onConfirm: async() => {
          try {
            await fbDeleteGame(i, e.id),
                            r({
              show: !0,
              title: "Đã Xóa",
              content: `Game "${e.settings?.theme||e.id}" đã được xóa.`,
              type: "success"
            })
          } catch (e) {
            r({
              show: !0,
              title: "Lỗi Xóa Game",
              content: `Không thể xóa game: ${e.message}`,
              type: "error"
            })
          }
        },
        confirmText: "Xóa Game",
        cancelText: "Hủy Bỏ"
      })
    },
    className: "bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-3 rounded-md text-sm shadow hover:shadow-md transition-all"
  }, "🗑️ Xóa")))
})),
    React.createElement("button",
      {
  onClick: () => n(!1),
  className: "mt-6 w-full bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition-colors"
}, "Đóng"))),
MessageModal = ({
  show: e,
  title: t,
  content: n,
  type: a,
  onClose: i
}) => {
  if (!e) return null;
  let r = "text-blue-400",
  c = "ℹ️";
  return "error" === a ?(r = "text-red-400", c = "⚠️"): "success" === a && (r = "text-green-400",
    c = "✅"),
  React.createElement("div",
    {
    className: "fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-[120]"
  },
    React.createElement("div",
      {
    className: "bg-gray-800 p-6 rounded-xl shadow-2xl w-full max-w-md border border-gray-700"
  },
      React.createElement("div", {
    className: "flex items-center mb-4"
  }, React.createElement("span", {
    className: "text-2xl mr-3"
  }, c), React.createElement("h3", {
    className: `text-xl font-semibold ${r}`
  }, t)),
      React.createElement("p", {
    className: "text-gray-300 mb-6 whitespace-pre-line"
  }, n),
      React.createElement("button",
        {
    onClick: i,
    className: "w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2.5 px-4 rounded-lg shadow hover:shadow-md transition-all"
  }, "Đã hiểu")))
},
ConfirmationModal = ({
  show: e,
  title: t,
  content: n,
  onConfirm: a,
  onCancel: i,
  confirmText: r = "Xác nhận",
  cancelText: c = "Hủy",
  setConfirmationModal: l
}) => e ? React.createElement("div",
  {
  className: "fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-[100]"
},
  React.createElement("div",
    {
  className: "bg-gray-800 p-6 rounded-xl shadow-2xl w-full max-w-md border border-yellow-700"
},
    React.createElement("div", {
  className: "flex items-center mb-4"
}, React.createElement("span", {
  className: "text-2xl mr-3"
}, "⚠️"),
      React.createElement("h3", {
  className: "text-xl font-semibold text-yellow-400"
}, t)),
    React.createElement("p", {
  className: "text-gray-300 mb-6 whitespace-pre-line"
}, n),
    React.createElement("div",
      {
  className: "flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3"
},
      React.createElement("button",
        {
  onClick: () => {
    a(),
            l(e => ({
      ...e,
      show: !1
    }))
  },
  className: "flex-1 text-white font-semibold py-2.5 px-4 rounded-lg shadow hover:shadow-md transition-all " + (r.toLowerCase().includes("xóa") ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700")
}, r),
      React.createElement("button",
        {
  onClick: () => {
    i && i(),
            l(e => ({
      ...e,
      show: !1
    }))
  },
  className: "flex-1 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2.5 px-4 rounded-lg shadow hover:shadow-md transition-all"
}, c)))): null,
SuggestionsModal = ({
  show: e,
  title: t,
  suggestions: n,
  onSelect: a,
  onClose: i,
  isLoading: r
}) => e ? React.createElement("div",
  {
  className: "fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-[70]"
},
  React.createElement("div",
    {
  className: "bg-gray-800 p-6 rounded-xl shadow-2xl w-full max-w-md border border-pink-700"
},
    React.createElement("h3",
      {
  className: "text-xl font-semibold text-pink-400 mb-4 flex items-center"
}, "💡 ", t),
    r ? React.createElement("div", {
  className: "flex justify-center items-center h-24"
},
      React.createElement("div",
        {
  className: "w-8 h-8 border-4 border-t-transparent border-pink-400 rounded-full animate-spin"
}), React.createElement("p", {
  className: "ml-3 text-gray-300"
}, "Đang tải gợi ý...")): n.length > 0 ? React.createElement("ul",
      {
  className: "space-y-2 max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-pink-500 scrollbar-track-gray-700"
},
      n.map((e, t) => React.createElement("li", {
  key: t
},
          React.createElement("button",
            {
  onClick: () => {
    a(e),
                i()
  },
  className: "w-full text-left p-3 bg-gray-700 hover:bg-gray-600/80 rounded-md text-gray-200 transition-colors shadow hover:shadow-md"
}, e)))): React.createElement("p", {
  className: "text-gray-400 text-center py-4"
}, "Không có gợi ý nào được tạo ra."),
    React.createElement("button",
      {
  onClick: i,
  className: "mt-6 w-full bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg"
}, "Đóng"))): null,
ActivityLogModal = ({
  show: e,
  onClose: t,
  activityLog: n,
  deleteEntry: a
}) => e ? React.createElement("div",
  {
  className: "fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-[100]"
},
  React.createElement("div",
    {
  className: "bg-gray-800 p-6 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-blue-600"
},
    React.createElement("div", {
  className: "flex justify-between items-center mb-4"
},
      React.createElement("h2", {
  className: "text-2xl font-semibold text-blue-400"
}, "📖 Nhật Ký Hoạt Động")),
    React.createElement("div",
      {
  className: "overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-blue-500 scrollbar-track-gray-700"
},
      0 === n.length ? React.createElement("p",
        {
  className: "text-gray-400 text-center py-6"
}, "Chưa có hoạt động nào được ghi lại."): [...n].reverse().map(e => React.createElement("div",
          {
  key: e.id,
  className: "group p-3 bg-gray-700 rounded-lg shadow-md flex justify-between items-start gap-2"
},
          React.createElement("p",
            {
  className: "text-sm text-gray-200 whitespace-pre-line flex-grow"
}, e.content),
          React.createElement("button",
            {
  onClick: () => a(e.id),
  className: "bg-red-700 hover:bg-red-600 text-white font-bold py-1 px-2 rounded-md opacity-0 group-hover:opacity-100 transition-opacity text-xs",
  title: "Xóa mục này"
}, "🗑️")))),
    React.createElement("button",
      {
  onClick: t,
  className: "mt-6 w-full bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition-colors"
}, "Đóng"))): null,
WorldKnowledgeModal = ({
  show: e,
  onClose: t,
  worldKnowledge: n,
  addRule: a,
  updateRule: i,
  toggleRule: r,
  deleteRule: c,
  exportRules: l,
  importRules: s
}) => {
  if (!e) return null;
  const o = React.useRef(null);
  return React.createElement("div",
    {
    className: "fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-[100]"
  },
    React.createElement("div",
      {
    className: "bg-gray-800 p-6 rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col border border-green-600"
  },
      React.createElement("div",
        {
    className: "flex flex-col sm:flex-row justify-between items-center mb-4 gap-2"
  },
        React.createElement("h2", {
    className: "text-2xl font-semibold text-green-400"
  }, "🌍 Tri Thức Thế Giới"),
        React.createElement("div", {
    className: "flex gap-2"
  },
          React.createElement("button",
            {
    onClick: () => {
      o.current.click()
    },
    className: "bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2 px-3 rounded-lg text-sm"
  }, "📥 Nhập từ JSON"),
          React.createElement("input",
            {
    type: "file",
    ref: o,
    onChange: s,
    accept: ".json",
    className: "hidden"
  }),
          React.createElement("button",
            {
    onClick: l,
    className: "bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2 px-3 rounded-lg text-sm"
  }, "📤 Xuất ra JSON"))),
      React.createElement("div",
        {
    className: "overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-green-500 scrollbar-track-gray-700 flex-grow"
  },
        0 === n.length ? React.createElement("p",
          {
    className: "text-gray-400 text-center py-6"
  }, "Chưa có luật lệ hay tri thức nào được thêm vào."): n.map(e => React.createElement("div",
            {
    key: e.id,
    className: "p-3 bg-gray-700/80 rounded-lg flex flex-col sm:flex-row items-start gap-3"
  },
            React.createElement("div", {
    className: "flex-grow w-full"
  },
              React.createElement("div", {
    className: "flex items-center gap-2"
  },
                React.createElement("span", {
    className: "text-xs font-bold text-gray-400"
  }, "LOẠI:"),
                React.createElement("select",
                  {
    value: e.type,
    onChange: t => i(e.id, "type", t.target.value),
    className: "bg-gray-500 p-1 rounded-md text-xs"
  }, React.createElement("option", {
    value: "FACT"
  }, "Sự Thật"), React.createElement("option", {
    value: "CONDITIONAL"
  }, "Điều Kiện"), React.createElement("option", {
    value: "RELATIONSHIP"
  }, "Quan Hệ"), React.createElement("option", {
    value: "CUSTOM"
  }, "Tùy Chỉnh"))),
              (e => {
    switch (e.type) {
      case "FACT": return React.createElement("div",
                      {
        className: "grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2"
      },
                      React.createElement("input",
                        {
        type: "text",
        value: e.subject,
        onChange: t => i(e.id, "subject", t.target.value),
        placeholder: "Chủ thể (VD: Rồng)",
        className: "bg-gray-600 p-2 rounded-md text-sm"
      }),
                      React.createElement("input",
                        {
        type: "text",
        value: e.verb,
        onChange: t => i(e.id, "verb", t.target.value),
        placeholder: "Động từ (VD: sợ, có)",
        className: "bg-gray-600 p-2 rounded-md text-sm"
      }),
                      React.createElement("input",
                        {
        type: "text",
        value: e.object,
        onChange: t => i(e.id, "object", t.target.value),
        placeholder: "Đối tượng (VD: nước, vảy đỏ)",
        className: "bg-gray-600 p-2 rounded-md text-sm"
      }));
      case "CONDITIONAL": return React.createElement("div",
                      {
        className: "flex flex-col gap-2 mt-2"
      },
                      React.createElement("textarea",
                        {
        value: e.condition,
        onChange: t => i(e.id, "condition", t.target.value),
        placeholder: "Điều kiện NẾU... (VD: người chơi ở trong rừng vào ban đêm)",
        className: "bg-gray-600 p-2 rounded-md text-sm w-full",
        rows: "2"
      }),
                      React.createElement("textarea",
                        {
        value: e.effect,
        onChange: t => i(e.id, "effect", t.target.value),
        placeholder: "Kết quả THÌ... (VD: sói sẽ xuất hiện nhiều hơn)",
        className: "bg-gray-600 p-2 rounded-md text-sm w-full",
        rows: "2"
      }));
      case "RELATIONSHIP": return React.createElement("div",
                      {
        className: "grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2"
      },
                      React.createElement("input",
                        {
        type: "text",
        value: e.subject,
        onChange: t => i(e.id, "subject", t.target.value),
        placeholder: "Chủ thể 1 (VD: Tiên Tộc)",
        className: "bg-gray-600 p-2 rounded-md text-sm"
      }),
                      React.createElement("input",
                        {
        type: "text",
        value: e.verb,
        onChange: t => i(e.id, "verb", t.target.value),
        placeholder: "Mối quan hệ (VD: căm ghét, đồng minh)",
        className: "bg-gray-600 p-2 rounded-md text-sm"
      }),
                      React.createElement("input",
                        {
        type: "text",
        value: e.object,
        onChange: t => i(e.id, "object", t.target.value),
        placeholder: "Chủ thể 2 (VD: Ma Tộc)",
        className: "bg-gray-600 p-2 rounded-md text-sm"
      }));
      case "CUSTOM": return React.createElement("div",
                      {
        className: "flex flex-col gap-2 mt-2"
      },
                      React.createElement("textarea",
                        {
        value: e.content || "",
        onChange: t => i(e.id, "content", t.target.value),
        placeholder: "Nhập luật lệ tùy chỉnh của bạn ở đây...",
        className: "bg-gray-600 p-2 rounded-md text-sm w-full",
        rows: "3"
      }));
      default: return null
    }
  })(e)),
            React.createElement("div",
              {
    className: "flex flex-row sm:flex-col gap-2 self-start sm:self-center mt-2 sm:mt-0"
  },
              React.createElement("button",
                {
    onClick: () => r(e.id),
    className: "py-1 px-2 text-xs rounded-md font-semibold " + (e.enabled ? "bg-green-500 hover:bg-green-600" : "bg-gray-500 hover:bg-gray-400")
  }, e.enabled ? "✅ Bật" : "⚫ Tắt"),
              React.createElement("button",
                {
    onClick: () => c(e.id),
    className: "bg-red-700 hover:bg-red-800 text-white font-semibold py-1 px-2 rounded-md text-xs"
  }, "🗑️"))))),
      React.createElement("button",
        {
    onClick: a,
    className: "mt-4 w-full bg-green-700 hover:bg-green-800 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition-colors"
  }, "➕ Thêm Luật Mới"),
      React.createElement("button",
        {
    onClick: t,
    className: "mt-2 w-full bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition-colors"
  }, "Đóng")))
},
CANONICAL_MEMORY_SCHEMA_VERSION = 2,
CRITICAL_STORY_PATTERN = /(chết|thiệt mạng|tử vong|bị giết|hồi sinh|phục sinh|tái sinh|lời hứa|thề|bí mật|thân phận thật|phản bội|cứu mạng|cha ruột|mẹ ruột|kết hôn|đính hôn|mất tích|bị phong ấn|phong ấn|di vật|huyết thống|chân tướng)/i,
CANONICAL_STATE_TAGS = new Set(["ACTIVITY_LOG",
  "TIME_PASS",
  "FACTION_UPDATE",
  "FACTION_RELATIONSHIP",
  "HIDDEN_TAG",
  "LORE_ITEM",
  "LORE_LOCATION",
  "COMPANION",
  "ITEM_AQUIRED",
  "SKILL_LEARNED",
  "ITEM_CONSUMED",
  "ITEM_UPDATED",
  "STATUS_APPLIED_SELF",
  "STATUS_CURED_SELF",
  "STATUS_EXPIRED_SELF",
  "STATUS_APPLIED_NPC",
  "STATUS_CURED_NPC",
  "STATUS_EXPIRED_NPC",
  "QUEST_ASSIGNED",
  "QUEST_UPDATED",
  "QUEST_OBJECTIVE_COMPLETED",
  "NPC_UPDATE",
  "RELATIONSHIP_POINTS_CHANGE",
  "RELATIONSHIP_UPDATE",
  "NPC_RELATIONSHIP_UPDATE",
  "SCENE_END"]);
function cloneMemoryData(e) {
  if (null == e) return e;
  try {
    return JSON.parse(JSON.stringify(e))
  } catch (t) {
    return e
  }
}
function extractCanonicalEventsBlock(e) {
  const t = String(e || ""),
  n = t.match(/<CANONICAL_EVENTS_JSON>([\s\S]*?)<\/CANONICAL_EVENTS_JSON>/i);
  if (!n) return {
    events: [],
    textWithoutBlock: t,
    found: !1,
    valid: !1
  };
  let a = null,
  i = !1;
  try {
    const e = n[1].trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    a = JSON.parse(e),
    i = Array.isArray(a) || Array.isArray(a?.events)
  } catch (e) {
    console.warn("Không phân tích được CANONICAL_EVENTS_JSON:", e)
  }
  return {
    events: (Array.isArray(a) ? a : Array.isArray(a?.events) ? a.events : []).filter(e => e && "object" == typeof e).slice(0,
      100).map(e => ({
      type: String(e.type || (e.subject && e.predicate ? "fact" : "event")).toLowerCase(),
      subject: null == e.subject ? "" : String(e.subject).trim(),
      predicate: null == e.predicate ? "" : String(e.predicate).trim(),
      value: void 0 === e.value ? "" : e.value,
      description: null == e.description ? "" : String(e.description).trim(),
      entities: Array.isArray(e.entities) ? e.entities.map(String).slice(0, 20): [],
      importance: ["critical",
        "high",
        "normal",
        "low"].includes(String(e.importance || "").toLowerCase()) ? String(e.importance).toLowerCase() : "normal",
      action: String(e.action || "set").toLowerCase()
    })).filter(e => "fact" === e.type || "state_change" === e.type || "relationship" === e.type ? Boolean(e.subject && e.predicate) : Boolean(e.description || e.subject)),
    textWithoutBlock: t.replace(n[0], "").trim(),
    found: !0,
    valid: i
  }
}
function extractMemoryAnchorsBlock(e) {
  const t = String(e || ""),
  n = t.match(/<MEMORY_ANCHORS_JSON>([\s\S]*?)<\/MEMORY_ANCHORS_JSON>/i);
  if (!n) return {
    anchors: [],
    textWithoutBlock: t,
    found: !1,
    valid: !1
  };
  let a = null,
  i = !1;
  try {
    const e = n[1].trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    a = JSON.parse(e),
    i = Array.isArray(a) || Array.isArray(a?.anchors)
  } catch (e) {
    console.warn("Không phân tích được MEMORY_ANCHORS_JSON:", e)
  }
  return {
    anchors: (Array.isArray(a) ? a : Array.isArray(a?.anchors) ? a.anchors : []).filter(e => e && "object" == typeof e).slice(0,
      80).map((e, t) => ({
      id: String(e.id || `anchor-${t+1}`),
      kind: String(e.kind || e.type || "detail").toLowerCase(),
      text: String(e.text || e.detail || e.description || "").trim().slice(0, 1600),
      exactQuote: String(e.exactQuote || e.quote || "").trim().slice(0, 600),
      entities: Array.isArray(e.entities) ? e.entities.map(String).map(e => e.trim()).filter(Boolean).slice(0,
            20): [],
      importance: ["critical",
        "high",
        "normal",
        "low"].includes(String(e.importance || "").toLowerCase()) ? String(e.importance).toLowerCase() : "normal"
    })).filter(e => e.text || e.exactQuote),
    textWithoutBlock: t.replace(n[0], "").trim(),
    found: !0,
    valid: i
  }
}

function extractMemoryVerificationReport(e) {
  const t = String(e || "").match(/<MEMORY_VERIFICATION_JSON>([\s\S]*?)<\/MEMORY_VERIFICATION_JSON>/i);
  if (!t) return {
    found: !1,
    valid: !1,
    status: "invalid",
    issues: [],
    checkedCategories: [],
    error: "Thiếu MEMORY_VERIFICATION_JSON."
  };
  let n;
  try {
    const e = t[1].trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    n = JSON.parse(e)
  } catch (e) {
    return {
      found: !0,
      valid: !1,
      status: "invalid",
      issues: [],
      checkedCategories: [],
      error: "JSON kiểm chứng không hợp lệ."
    }
  }
  const a = n && !Array.isArray(n) && "object" == typeof n ? n.report || n : null;
  if (!a || "object" != typeof a) return {
    found: !0,
    valid: !1,
    status: "invalid",
    issues: [],
    checkedCategories: [],
    error: "Báo cáo kiểm chứng không phải object."
  };
  const i = String(a.status || a.verdict || "").trim().toLowerCase(),
  r = Array.isArray(a.checkedCategories) ? a.checkedCategories.map(e => String(e).trim().toLowerCase()) : [],
  c = (Array.isArray(a.issues) ? a.issues : []).slice(0, 50).filter(e => e && "object" == typeof e).map(e => {
    const t = e.evidence && "object" == typeof e.evidence ? e.evidence :{
    };
    return {
      severity: ["critical",
        "high",
        "medium",
        "low"].includes(String(e.severity || "").toLowerCase()) ? String(e.severity).toLowerCase() : "medium",
      category: String(e.category || "continuity"),
      claim: String(e.claim || e.statement || "").slice(0, 1000),
      reason: String(e.reason || e.explanation || "").slice(0, 1500),
      evidence:{
        sourceType: String(t.sourceType || e.sourceType || "").toLowerCase(),
        turnNumber: Number(t.turnNumber ?? e.evidenceTurn ?? 0) || 0,
        quote: String(t.quote || e.evidenceQuote || "").slice(0, 500),
        subject: String(t.subject || e.evidenceSubject || "").slice(0, 300),
        predicate: String(t.predicate || e.evidencePredicate || "").slice(0, 300),
        value: t.value ?? e.evidenceValue ?? null
      }
    }
  }),
  l = ["pass",
    "fail",
    "revise"].includes(i) && Array.isArray(a.issues) && a.issues.every(e => e && "object" == typeof e) && MEMORY_AUDIT_REQUIRED_CHECKS.every(e => r.includes(e));
  return {
    found: !0,
    valid: l,
    status: i,
    issues: c,
    checkedCategories: r,
    summary: String(a.summary || "").slice(0, 1500),
    error: l ? "" : "Báo cáo thiếu status/issues hoặc chưa kiểm tra đủ nhóm bắt buộc."
  }
}
function extractNarrativeForMemoryVerification(e) {
  let t = String(e || "");
  return t = extractCanonicalEventsBlock(t).textWithoutBlock,
  t = extractMemoryAnchorsBlock(t).textWithoutBlock,
  t = t.replace(/<MEMORY_VERIFICATION_JSON>[\s\S]*?<\/MEMORY_VERIFICATION_JSON>/gi, ""),
  t = t.replace(/<PHAN_TICH>[\s\S]*?<\/PHAN_TICH>/gi, ""),
  t = t.replace(/\[SCENE_END:\s*"[^"]*"\]/gi, ""),
  t = t.replace(/\[(?:ACTIVITY_LOG|TIME_PASS|FACTION_UPDATE|FACTION_RELATIONSHIP|HIDDEN_TAG|LORE_ITEM|LORE_LOCATION|COMPANION|ITEM_AQUIRED|SKILL_LEARNED|ITEM_CONSUMED|ITEM_UPDATED|STATUS_APPLIED_SELF|STATUS_CURED_SELF|STATUS_EXPIRED_SELF|STATUS_APPLIED_NPC|STATUS_CURED_NPC|STATUS_EXPIRED_NPC|QUEST_ASSIGNED|QUEST_UPDATED|QUEST_OBJECTIVE_COMPLETED|NPC_UPDATE|RELATIONSHIP_POINTS_CHANGE|RELATIONSHIP_UPDATE|NPC_RELATIONSHIP_UPDATE):[\s\S]*?\]/gi,
    ""),
  t.trim().slice(0, 22000)
}
function validateMemoryVerificationEvidence(e, t, n = [], a = "", i = "", r = "") {
  const c = [];
  if (!e || !e.valid) return ["Báo cáo kiểm chứng không hợp lệ."];
  const l = Array.isArray(t) ? t : [],
  s = Array.isArray(n) ? n : [];
  for (const t of e.issues.filter(e => ["critical", "high"].includes(e.severity))) {
    const e = t.evidence || {
    };
    if ("ledger" === e.sourceType) {
      const n = l.find(t => Number(t?.turnNumber) === Number(e.turnNumber));
      if (!n || !e.quote.trim()) {
        c.push(`Thiếu lượt nguồn/trích dẫn nguyên văn cho: ${t.claim||t.category}.`);
        continue
      }
      normalizeRecallText([n.playerAction,
        n.narrative,
        n.rawAiResponse,
        ...Array.isArray(n.memoryAnchors) ? n.memoryAnchors.flatMap(e => [e.text,
          e.exactQuote]): []].filter(Boolean).join("\n")).includes(normalizeRecallText(e.quote)) || c.push(`Trích dẫn ở lượt ${e.turnNumber} không khớp bản gốc: ${t.claim||t.category}.`)
    } else if ("canonical_fact" === e.sourceType) {
      s.some(t => {
        if (!t || "inactive" === t.status || normalizeRecallText(t.subject) !== normalizeRecallText(e.subject) || normalizeRecallText(t.predicate) !== normalizeRecallText(e.predicate)) return !1;
        if (null === e.value) return !0;
        const n = normalizeRecallText(JSON.stringify(e.value));
        return normalizeRecallText(JSON.stringify(t.value)) === n || Array.isArray(t.history) && t.history.some(e => normalizeRecallText(JSON.stringify(e?.value)) === n)
      }) || c.push(`Cảnh báo trỏ tới canonical fact không tồn tại: ${t.claim||t.category}.`)
    } else "world_state" === e.sourceType ? e.subject && normalizeRecallText(a).includes(normalizeRecallText(e.subject)) || c.push(`Cảnh báo không trỏ được tới thực thể trong trạng thái chuẩn: ${t.claim||t.category}.`) : "candidate_story" === e.sourceType ? e.quote.trim() && normalizeRecallText(i).includes(normalizeRecallText(e.quote)) || c.push(`Trích dẫn kiểm định không có trong lời kể đang xét: ${t.claim||t.category}.`) : "candidate_metadata" === e.sourceType ? e.quote.trim() && normalizeRecallText(r).includes(normalizeRecallText(e.quote)) || c.push(`Trích dẫn không khớp block sự kiện/anchor cần kiểm tra: ${t.claim||t.category}.`) : c.push(`Cảnh báo nghiêm trọng thiếu nguồn kiểm chứng hợp lệ: ${t.claim||t.category}.`)
  }
  return c
}
function summarizeMemoryGateFailure(e, t, n = []) {
  const a = [];
  return (Array.isArray(e) ? e : []).forEach(e => a.push(e.reason || "Mâu thuẫn dữ kiện chuẩn.")),
  t && t.valid ? "pass" !== t.status && a.push(t.summary || "Bộ kiểm chứng yêu cầu sửa lại diễn biến.") : a.push(t?.error || "Không nhận được báo cáo kiểm chứng trí nhớ hợp lệ."),
  (Array.isArray(t?.issues) ? t.issues : []).filter(e => ["critical",
    "high"].includes(e.severity)).forEach(e => a.push(`[${e.severity.toUpperCase()} / ${e.category}] ${e.reason||e.claim||"Mâu thuẫn ký ức."}`)),
  n.forEach(e => a.push(e)),
  [...new Set(a.filter(Boolean))].slice(0, 12)
}
function normalizeRecallText(e) {
  return String(e || "").toLocaleLowerCase("vi-VN").normalize("NFD").replace(/[\u0300-\u036f]/g,
    "").replace(/đ/g, "d").replace(/[^a-z0-9\s'-]/g, " ").replace(/\s+/g, " ").trim()
}

function getRecallTokens(e) {
  return normalizeRecallText(e).split(/\s+/).filter(e => e.length > 1 && !RECALL_STOP_WORDS.has(e))
}
function splitStoryTextIntoChunks(e, t = STORY_CHUNK_SIZE) {
  const n = String(e || "");
  if (!n.trim()) return [];
  const a = /[^.!?。！？\n]+[.!?。！？]?|\n+/g,
  i = [];
  let r;
  for (; null !== (r = a.exec(n)); ) {
    const e = r[0];
    e.trim() && i.push({
      text: e.trim(),
      start: r.index,
      end: r.index + e.length
    })
  }
  if (!i.length) return [{
      text: n,
      start: 0,
      end: n.length
    }];
  const c = [];
  let l = [],
  s = i[0].start,
  o = 0;
  const h = () => {
    if (!l.length) return;
    const e = l[l.length - 1].end;
    c.push({
      text: n.slice(s, e).trim(),
      start: s,
      end: e
    }),
    l = [],
    o = 0
  };
  for (const e of i) {
    const n = o + e.text.length + 1;
    if (l.length && n > t) {
      const e = l[l.length - 1];
      h(),
      l = [e],
      s = e.start,
      o = e.text.length
    }
    l.length || (s = e.start),
    l.push(e),
    o += e.text.length + 1
  }
  return h(),
  c.filter(e => e.text)
}

function expandRecallTokens(e) {
  const t = new Map;
  (e || []).forEach(e => t.set(e, 1));
  const n = ` ${(e||[]).join(" ")} `;
  return RECALL_SYNONYM_GROUPS.forEach(a => {
    const i = a.map(normalizeRecallText);
    i.some(t => t && (n.includes(` ${t} `) || (e || []).includes(t))) && i.forEach(e => getRecallTokens(e).forEach(e => {
      t.has(e) || t.set(e, .42)
    }))
  }),
  t
}
function buildStoryRecallRecords(e) {
  const t = [];
  return (Array.isArray(e) ? e : []).forEach((e, n) => {
    if (!e) return;
    const a = Number(e.turnNumber) || n + 1,
      i = String(e.id || `turn-${a}`),
      r = String(e.narrative || e.rawAiResponse || ""),
      c = String(e.playerAction || ""),
      l = [...Array.isArray(e.canonicalEvents) ? e.canonicalEvents.map(e => `${e.type||""} ${e.subject||""} ${e.predicate||""} ${JSON.stringify(e.value??"")} ${e.description||""} ${(e.entities||[]).join(" ")}`) : [],
      ...Array.isArray(e.systemEvents) ? e.systemEvents.map(e => `${e.tag||""} ${e.payload||""}`) : []].join("\n");
    splitStoryTextIntoChunks(r).forEach((n, r) => {
      t.push({
        id: `${i}:chunk:${r}`,
        kind: "story_chunk",
        turnId: i,
        turnNumber: a,
        chunkIndex: r,
        start: n.start,
        end: n.end,
        text: n.text,
        action: 0 === r ? c : "",
        evidence: [n.text,
          0 === r ? c : "",
          l].filter(Boolean).join("\n"),
        importance: CRITICAL_STORY_PATTERN.test(`${c}\n${n.text}\n${l}`) ? "high" : "normal",
        entities: Array.isArray(e.memoryAnchors) ?[...new Set(e.memoryAnchors.flatMap(e => e.entities || []))] : []
      })
    }),
      (Array.isArray(e.memoryAnchors) ? e.memoryAnchors : []).forEach((e, n) => {
      const r = `${e.text||""} ${e.exactQuote||""}`.trim();
      r && t.push({
        id: `${i}:anchor:${e.id||n}`,
        kind: "memory_anchor",
        turnId: i,
        turnNumber: a,
        chunkIndex: n,
        start: null,
        end: null,
        text: r,
        evidence: `${e.kind||"detail"} ${r} ${(e.entities||[]).join(" ")}`,
        importance: e.importance || "normal",
        entities: e.entities || [],
        exactQuote: e.exactQuote || ""
      })
    })
  }),
  t
}
function buildFactRecallRecords(e) {
  const t = [];
  return (Array.isArray(e) ? e : []).forEach((e, n) => {
    e && "inactive" !== e.status && (t.push({
      id: `fact:${e.id||n}:current`,
      kind: "current_fact",
      turnNumber: Number(e.updatedAtTurn || e.validFromTurn) || 0,
      text: `${e.subject||""} ${e.predicate||""} ${JSON.stringify(e.value??"")}`,
      evidence: `${e.subject||""} ${e.predicate||""} ${JSON.stringify(e.value??"")} ${e.importance||""}`,
      subject: e.subject,
      predicate: e.predicate,
      value: e.value,
      sourceTurnId: e.sourceTurnId || null,
      importance: e.importance || "normal"
    }),
        (Array.isArray(e.history) ? e.history : []).forEach((a, i) => {
      t.push({
        id: `fact:${e.id||n}:history:${i}`,
        kind: "historical_fact",
        turnNumber: Number(a.validFromTurn || 0),
        validToTurn: Number(a.validToTurn || 0),
        text: `${e.subject||""} ${e.predicate||""} ${JSON.stringify(a.value??"")}`,
        evidence: `${e.subject||""} ${e.predicate||""} ${JSON.stringify(a.value??"")} historical value`,
        subject: e.subject,
        predicate: e.predicate,
        value: a.value,
        sourceTurnId: a.sourceTurnId || e.sourceTurnId || null,
        importance: e.importance || "normal"
      })
    }))
  }),
  t
}
function retrieveHybridStoryMemories(e, t, n = [], a = {
}) {
  const i = buildStoryRecallRecords(t),
  r = buildFactRecallRecords(n),
  c = [...i,
    ...r];
  if (!c.length) return {
    chunks: [],
    facts: [],
    trace:{
      recordsSearched: 0,
      queryTokens: []
    }
  };
  const l = getRecallTokens(e),
  s = [...expandRecallTokens(l).entries()],
  o = c.map(e => {
    const t = getRecallTokens(e.evidence || e.text || ""),
      n = new Map;
    return t.forEach(e => n.set(e, (n.get(e) || 0) + 1)),
      {
      record: e,
      tokens: t,
      frequencies: n,
      length: t.length
    }
  }),
  h = new Map;
  o.forEach(e => new Set(e.tokens).forEach(e => h.set(e, (h.get(e) || 0) + 1)));
  const m = o.reduce((e, t) => e + t.length, 0) / Math.max(1, o.length),
  g = normalizeRecallText(e),
  u = (Array.isArray(a.knownEntities) ? a.knownEntities : []).filter(Boolean).map(e => ({
    raw: String(e),
    normalized: normalizeRecallText(e)
  })).filter(e => e.normalized.length > 2).filter(e => g.includes(e.normalized)),
  d = Math.max(0,
    ...Array.isArray(t) ? t.map(e => Number(e?.turnNumber) || 0) : []),
  p = o.map(e => {
    let t = 0;
    for (const [n, a] of s) {
      const i = e.frequencies.get(n) || 0;
      if (!i) continue;
      const r = h.get(n) || 0,
        c = Math.log(1 + (o.length - r + .5) / (r + .5)),
        l = i + 1.2 * (.25 + e.length / Math.max(1, m) * .75);
      t += a * c * (2.2 * i / Math.max(.01, l))
    }
    const n = normalizeRecallText(e.record.evidence || e.record.text || ""),
      a = normalizeRecallText(l.join(" "));
    a.length > 7 && n.includes(a) && (t += 4.5);
    let i = 0;
    u.forEach(e => {
      n.includes(e.normalized) && (i += 1)
    }),
      t += 1.8 * i;
    t += .8 * (e.record.entities || []).filter(e => g.includes(normalizeRecallText(e))).length,
      "critical" === e.record.importance ? t += .9 : "high" === e.record.importance && (t += .45);
    return t += .12 / (1 + Math.max(0, d - (Number(e.record.turnNumber) || 0)) / 35),
      "current_fact" === e.record.kind && (t += .3),
      "memory_anchor" === e.record.kind && (t += .25),
      {
      ...e,
      score: t,
      queryCoverage: s.length ? s.filter(([t]) => e.frequencies.has(t)).length / s.length : 0
    }
  }),
  N = p.filter(e => e.score > RECALL_MIN_SCORE);
  N.sort((e, t) => t.score - e.score || (Number(t.record.turnNumber) || 0) - (Number(e.record.turnNumber) || 0));
  const y = Number(a.maxChunks) || RECALL_LIMITS.maxChunks,
  T = Number(a.maxPerTurn) || RECALL_LIMITS.maxPerTurn,
  C = [],
  f = new Set,
  b = new Map;
  for (const e of N) {
    if (!["story_chunk",
      "memory_anchor"].includes(e.record.kind)) continue;
    if (f.has(e.record.id)) continue;
    const t = String(e.record.turnNumber),
    n = b.get(t) || 0;
    if (!(n >= T && "memory_anchor" !== e.record.kind) && (C.push({
      ...e.record,
      score: Number(e.score.toFixed(3)),
      queryCoverage: Number(e.queryCoverage.toFixed(3))
    }), f.add(e.record.id), b.set(t, n + 1), C.length >= y)) break
  }
  const v = N.filter(e => ["current_fact",
    "historical_fact"].includes(e.record.kind)).slice(0, Number(a.maxFacts) || RECALL_LIMITS.maxFacts).map(e => ({
    ...e.record,
    score: Number(e.score.toFixed(3))
  })),
  E = new Set(u.map(e => e.normalized));
  C.slice(0, 5).forEach(e => (e.entities || []).forEach(e => E.add(normalizeRecallText(e))));
  const x = new Set(C.map(e => e.turnNumber));
  for (const e of N) {
    if (C.length >= y + 3) break;
    if (!["story_chunk",
      "memory_anchor"].includes(e.record.kind) || f.has(e.record.id)) continue;
    const t = normalizeRecallText(e.record.evidence || e.record.text || "");
    [...E].some(e => e.length > 2 && t.includes(e)) && e.score > RECALL_EXPAND_MIN_SCORE && (C.push({
      ...e.record,
      score: Number((e.score + RECALL_EXPAND_BOOST).toFixed(3)),
      queryCoverage: Number(e.queryCoverage.toFixed(3)),
      relatedExpansion: !0
    }), f.add(e.record.id), x.add(e.record.turnNumber))
  }
  C.sort((e, t) => (Number(e.turnNumber) || 0) - (Number(t.turnNumber) || 0) || (e.start ?? - 1) - (t.start ?? - 1));
  return {
    chunks: C,
    facts: v,
    candidates: p.filter(e => ["story_chunk",
      "memory_anchor"].includes(e.record.kind)).map(e => ({
      ...e.record,
      score: Number(e.score.toFixed(4)),
      queryCoverage: Number(e.queryCoverage.toFixed(4))
    })),
    trace:{
      recordsSearched: c.length,
      storyChunksSearched: i.length,
      factRecordsSearched: r.length,
      queryTokens: l,
      expandedTerms: s.map(([e,
        t]) => ({
        term: e,
        weight: t
      }))
    }
  }
}
function formatHybridStoryRecallForPrompt(e) {
  if (!e || !(e.chunks || []).length && !(e.facts || []).length) return "Không tìm thấy đoạn ký ức cũ đủ liên quan trong chỉ mục hiện có; không được tự bịa rằng sự kiện đã xảy ra.";
  const t = [];
  return (e.facts || []).length && t.push("DỮ KIỆN/BIẾN ĐỔI ĐÃ GHI NHẬN (fact hiện hành hoặc giá trị lịch sử, xem lượt nguồn):\n" + e.facts.map(e => `- [${e.kind}; lượt ${e.turnNumber||"?"}; nguồn ${e.sourceTurnId||"?"}; điểm ${e.score}] ${e.subject}: ${e.predicate} = ${JSON.stringify(e.value)}`).join("\n")),
  (e.chunks || []).length && t.push("ĐOẠN LỊCH SỬ GỐC/CHI TIẾT ĐƯỢC TRUY HỒI (mỗi đoạn trỏ về lượt gốc; không phải bản tóm tắt):\n" + e.chunks.map(e => {
    const t = "memory_anchor" === e.kind ? `CHỈ MỤC CHI TIẾT: ${e.text}${e.exactQuote?`\nTrích dẫn nguyên văn đã lưu: “${e.exactQuote}”`:""}` : e.text;
    return `[Lượt ${e.turnNumber}; ${e.kind}; đoạn ${e.chunkIndex}; điểm ${e.score}; ID ${e.id}]${e.relatedExpansion?" [liên kết qua thực thể]":""}\nHành động liên quan: ${e.action||"(xem văn bản gốc)"}\n${t}`
  }).join("\n\n")),
  t.join("\n\n")
}
function extractStructuredSystemEvents(e) {
  const t = [],
  n = /\[([A-Z][A-Z0-9_]*):\s*([\s\S]*?)\]/g;
  let a;
  for (; null !== (a = n.exec(String(e || ""))); ) CANONICAL_STATE_TAGS.has(a[1]) && t.push({
    tag: a[1],
    payload: a[2].trim()
  });
  return t
}
function buildCanonicalWorldState(e, t, n, a = [], i = 0) {
  const r = e && "object" == typeof e ? e :{
  },
  c = t && "object" == typeof t ? t :{
  },
  l = e => Array.isArray(r[e]) ? cloneMemoryData(r[e]) : [];
  return {
    schemaVersion: 2,
    turnNumber: Number(i) || 0,
    updatedAt: (new Date).toISOString(),
    player:{
      name: c.characterName || "",
      backstory: c.characterBackstory || "",
      statuses: l("playerStatus"),
      inventory: l("inventory"),
      skills: l("playerSkills")
    },
    worldTime: cloneMemoryData(r.worldTime || {
      day: 1,
      month: 1,
      year: 1
    }),
    npcs: l("npcs"),
    items: l("items"),
    locations: l("locations"),
    companions: l("companions"),
    inventory: l("inventory"),
    playerSkills: l("playerSkills"),
    playerStatus: l("playerStatus"),
    relationships: l("relationships"),
    quests: l("quests"),
    factions: l("factions"),
    factionRelationships: l("factionRelationships"),
    hiddenTags: l("hiddenTags"),
    rules: (Array.isArray(n) ? n : []).filter(e => e && e.enabled).map(e => cloneMemoryData(e)),
    canonicalFacts: (Array.isArray(a) ? a : []).filter(Boolean).map(e => cloneMemoryData(e))
  }
}
function formatCanonicalWorldStateForPrompt(e) {
  if (!e) return "Chưa có bản chụp trạng thái chuẩn.";
  const t = (e, t, n = []) => (e || []).map(e => {
    const a = {
      name: t(e)
    };
    return n.forEach(t => {
      e && void 0 !== e[t] && "" !== e[t] && (a[t] = e[t])
    }),
      a
  }),
  n = {
    turnNumber: e.turnNumber || 0,
    player: e.player || {
    },
    worldTime: e.worldTime || null,
    npcs: t(e.npcs, e => e.Name || e.name,
      ["lifeStatus",
      "location",
      "Description",
      "Status",
      "Origin",
      "Goal",
      "inventory",
      "statuses",
      "memory",
      "Personality",
      "TrueEgo",
      "Persona",
      "StateOfMind",
      "Boundaries",
      "CoreDesire",
      "CoreFear",
      "SpeakingStyle",
      "TypicalSchedule",
      "Beliefs"]),
    items: t(e.items, e => e.Name || e.name || e.title,
      ["owner",
      "holder",
      "location",
      "status",
      "Description",
      "isLocked",
      "isOpen"]),
    locations: t(e.locations, e => e.Name || e.name, ["Description",
      "status"]),
    inventory: e.inventory || [],
    playerSkills: e.playerSkills || [],
    playerStatus: e.playerStatus || [],
    relationships: e.relationships || [],
    quests: e.quests || [],
    factions: e.factions || [],
    factionRelationships: e.factionRelationships || [],
    rules: e.rules || [],
    canonicalFacts: (e.canonicalFacts || []).filter(e => e && "inactive" !== e.status)
  };
  return JSON.stringify(n, null, 2)
}
function selectRelevantStoryLedgerEntries(e, t, n = {
}) {
  const a = Array.isArray(t) ? t : [];
  if (!a.length) return [];
  const i = Number(n.maxRelevant) || 8,
  r = Number(n.maxRecent) || 4,
  c = Number(n.maxCritical) || 4,
  l = new Set(preprocessText(String(e || "")).filter(e => e.length > 1)),
  s = Math.max(...a.map(e => Number(e.turnNumber) || 0), 0),
  o = a.map(e => {
    const t = [e.playerAction,
      e.narrative,
      e.rawAiResponse,
      ...(e.canonicalEvents || []).map(e => `${e.subject||""} ${e.predicate||""} ${e.value||""} ${e.description||""}`),
      ...(e.systemEvents || []).map(e => `${e.tag||""} ${e.payload||""}`)].join("\n"),
      n = new Set(preprocessText(t).filter(e => e.length > 1));
    let a = 0;
    l.forEach(e => {
      n.has(e) && (a += 1)
    });
    const i = l.size ? a / Math.sqrt(l.size) : 0,
      r = Number(e.turnNumber) || 0,
      c = r > 0?.15 / (1 + Math.max(0, s - r) / 20): 0,
      o = `${e.playerAction||""}\n${e.narrative||""}\n${JSON.stringify(e.canonicalEvents||[])}`,
      h = CRITICAL_STORY_PATTERN.test(o) || (e.canonicalEvents || []).some(e => "critical" === e.importance);
    return {
      entry: e,
      score: i + c + (h?.25: 0),
      critical: h
    }
  }),
  h = new Map,
  m = e => {
    e && e.id && h.set(e.id, e)
  };
  return a.slice(- r).forEach(m),
  o.filter(e => e.critical).sort((e, t) => t.score - e.score || t.entry.turnNumber - e.entry.turnNumber).slice(0,
    c).forEach(e => m(e.entry)),
  o.filter(e => e.score > 0).sort((e, t) => t.score - e.score || t.entry.turnNumber - e.entry.turnNumber).slice(0,
    i).forEach(e => m(e.entry)),
  [...h.values()].sort((e, t) => (Number(e.turnNumber) || 0) - (Number(t.turnNumber) || 0))
}
function collectCanonicalValidationFacts(e, t = [], n = "") {
  const a = [],
  i = new Set,
  r = (e, t, n, r = "worldState") => {
    if (null == e || !t || null == n || "" === n) return;
    const c = String(e).trim(),
    l = String(t).trim();
    if (!c || !l) return;
    const s = `${c.toLowerCase()}|${l.toLowerCase()}`;
    i.has(s) || (i.add(s),
      a.push({
      subject: c,
      predicate: l,
      value: cloneMemoryData(n),
      status: "active",
      source: r
    }))
  };
  (Array.isArray(t) ? t : []).forEach(e => {
    e && "inactive" !== e.status && r(e.subject, e.predicate, e.value, "canonicalLedger")
  });
  const c = e && "object" == typeof e ? e :{
  };
  return (Array.isArray(c.npcs) ? c.npcs : []).forEach(e => {
    if (!e) return;
    const t = e.Name || e.name;
    t && (r(t, "lifeStatus", e.lifeStatus ?? e.LifeStatus),
        r(t, "location", e.location ?? e.Location),
        r(t, "trueIdentity", e.trueIdentity ?? e.realIdentity ?? e.TrueIdentity))
  }),
  (Array.isArray(c.items) ? c.items : []).forEach(e => {
    if (!e) return;
    const t = e.Name || e.name || e.title;
    t && (r(t, "holder", e.holder ?? e.owner ?? e.heldBy),
        r(t, "location", e.location ?? e.Location),
        r(t, "status", e.status ?? e.Status))
  }),
  (Array.isArray(c.quests) ? c.quests : []).forEach(e => {
    if (!e) return;
    const t = e.title || e.Name || e.name;
    t && r(t, "questStatus", e.status ?? e.Status)
  }),
  n && Array.isArray(c.inventory) && c.inventory.forEach(e => {
    if (!e) return;
    const t = "string" == typeof e ? e : e.Name || e.name || e.title;
    t && r(t, "holder", n)
  }),
  a
}
function validateCanonicalEventsAgainstFacts(e, t, n) {
  const a = Array.isArray(e) ? e : [],
  i = Array.isArray(t) ? t : [],
  r = String(n || "").toLowerCase(),
  c = [];
  return i.forEach((e, t) => {
    if (!e || !e.subject || !e.predicate || void 0 === e.value) return;
    const n = `${e.subject.trim().toLowerCase()}|${e.predicate.trim().toLowerCase()}`,
      i = a.find(e => e && "inactive" !== e.status && `${String(e.subject||"").trim().toLowerCase()}|${String(e.predicate||"").trim().toLowerCase()}` === n);
    if (!i || JSON.stringify(i.value) === JSON.stringify(e.value)) return;
    const l = String(e.predicate).toLowerCase();
    let s = "";
    if (/(life.?status|alive|dead|sinh.?mệnh|tình.?trạng.?sống)/i.test(l)) {
      const t = /dead|chết|tử vong|thiệt mạng/i.test(String(i.value)),
        n = /alive|sống|còn sống/i.test(String(e.value)),
        a = /dead|chết|tử vong|thiệt mạng/i.test(String(e.value));
      t && n && !/(hồi sinh|phục sinh|tái sinh|sống lại|hồi sinh|được cứu sống|hồi quy)/i.test(r) ? s = `${e.subject} đã được ghi nhận là chết, nhưng sự kiện mới đổi thành còn sống mà chưa nêu nguyên nhân hồi sinh.` : t || !a || /(chết|tử vong|thiệt mạng|bị giết|ngã xuống|đoạt mạng|tắt thở)/i.test(r) || (s = `${e.subject} bị đánh dấu đã chết nhưng phần truyện chưa mô tả sự kiện dẫn đến cái chết.`)
    } else /(real.?identity|true.?identity|thân.?phận.?thật|huyết.?thống|parentage|birth.?origin)/i.test(l) && (/(lộ diện|tiết lộ|phơi bày|chân tướng|sự thật|thân phận|huyết thống|thực chất|hóa ra|hoá ra)/i.test(r) || (s = `Dữ kiện cốt lõi về ${e.subject} (${e.predicate}) bị thay đổi mà chưa có tình tiết tiết lộ hoặc giải thích.`));
    s && c.push({
      eventIndex: t,
      reason: s,
      subject: e.subject,
      predicate: e.predicate
    })
  }),
  c
}
function applyCanonicalEventsToFacts(e, t, n, a, i = []) {
  let r = Array.isArray(e) ? e.map(e => ({
    ...e,
    history: Array.isArray(e.history) ?[...e.history] : []
  })): [];
  const c = new Set(i);
  return (Array.isArray(t) ? t : []).forEach((e, t) => {
    if (c.has(t) || !e || !e.subject || !e.predicate || void 0 === e.value) return;
    if (!["fact",
      "state_change",
      "relationship"].includes(e.type)) return;
    const i = String(e.subject).trim(),
      l = String(e.predicate).trim();
    if (!i || !l) return;
    const s = `${i.toLowerCase()}|${l.toLowerCase()}`,
      o = r.findIndex(e => `${String(e.subject||"").toLowerCase()}|${String(e.predicate||"").toLowerCase()}` === s && "inactive" !== e.status),
      h = String(e.action || "set").toLowerCase();
    if ("remove" === h || "delete" === h || "forget" === h) return void(o >= 0 && (r[o] = {
      ...r[o],
      status: "inactive",
      validToTurn: n,
      updatedAtTurn: n,
      sourceTurnId: a
    }));
    const m = o >= 0 ? r[o] : null;
    if (m && JSON.stringify(m.value) === JSON.stringify(e.value)) return void(r[o] = {
      ...m,
      updatedAtTurn: n,
      lastConfirmedTurn: n,
      sourceTurnId: a
    });
    const g = m ?[...m.history,
      {
        value: cloneMemoryData(m.value),
        validFromTurn: m.validFromTurn,
        validToTurn: n - 1,
        sourceTurnId: m.sourceTurnId || null
      }]: [],
      u = {
      id: m?.id || `${i.toLowerCase().replace(/\s+/g,"_")}__${l.toLowerCase().replace(/\s+/g,"_")}`,
      subject: i,
      predicate: l,
      value: cloneMemoryData(e.value),
      status: "active",
      importance: e.importance || m?.importance || "normal",
      validFromTurn: n,
      validToTurn: null,
      updatedAtTurn: n,
      sourceTurnId: a,
      history: g
    };
    o >= 0 ? r[o] = u : r.push(u)
  }),
  r
}
function migrateLegacyStoryHistory(e) {
  const t = [];
  let n = null;
  return (Array.isArray(e) ? e : []).forEach(e => {
    if (e && "object" == typeof e) if (e.type && "story" !== e.type) n = e;
    else if ("story" === e.type) {
      const a = String(e.content || ""),
        i = t.length + 1;
      t.push({
        schemaVersion: 2,
        id: `migrated-${e.id||i}`,
        turnNumber: i,
        timestamp: (new Date).toISOString(),
        actionType: n?.type || (1 === i ? "initial" : "legacy"),
        playerAction: n?.content || (1 === i ? "Bắt đầu game (lịch sử cũ)" : "Hành động không có trong bản lưu cũ"),
        narrative: a,
        rawAiResponse: a,
        analysis: e.analysis || "",
        canonicalEvents: [],
        systemEvents: [],
        migratedFromLegacyHistory: !0
      }),
        n = null
    }
  }),
  t
}
function ledgerToStoryHistory(e) {
  const t = [];
  return (Array.isArray(e) ? e : []).forEach(e => {
    e && (e.actionType && "initial" !== e.actionType && e.playerAction && t.push({
      type: e.actionType,
      content: e.playerAction,
      id: `${e.id}-action`
    }),
        void 0 !== e.narrative && null !== e.narrative && t.push({
      type: "story",
      content: String(e.narrative),
      id: `${e.id}-story`,
      analysis: e.analysis || ""
    }))
  }),
  t
}
const App = () => {
  const [e,
    t] = useState("initial"),
  [n,
    a] = useState({
    theme: "",
    setting: "",
    languageDictionary: LANGUAGE_DICTIONARIES[0],
    characterName: "",
    characterGender: "Không xác định",
    characterBackstory: "",
    preferredInitialSkill: "",
    difficulty: "Thường",
    difficultyDescription: "",
    initialWorldElements: [],
    useCharacterGoal: !1,
    characterGoal: "",
    allowCustomActionInput: !0,
    writingStyle: WRITING_STYLES[0],
    pronounContext: PRONOUN_CONTEXTS[0],
    dramaLevel: DRAMA_LEVELS[0]
  }),
  [i,
    r] = useState([]),
  [c,
    l] = useState(""),
  [,
    h] = useState(0),
  [m,
    g] = useState(!1),
  [u,
    d] = useState(!1),
  [p,
    N] = useState(null),
  [y,
    T] = useState(!1),
  [C,
    f] = useState(!1),
  [b,
    v] = useState([]),
  [E,
    x] = useState(null),
  [S,
    R] = useState([]),
  [I,
    k] = useState(!1),
  [A,
    H] = useState({
    show: !1,
    title: "",
    content: "",
    type: "info"
  }),
  [w,
    P] = useState({
    show: !1,
    title: "",
    content: "",
    onConfirm: null,
    onCancel: null,
    confirmText: "Xác nhận",
    cancelText: "Hủy"
  }),
  [L,
    U] = useState(""),
  [_,
    M] = useState({
    npcs: [],
    items: [],
    locations: [],
    companions: [],
    inventory: [],
    playerSkills: [],
    relationships: [],
    playerStatus: [],
    quests: []
  }),
  [G,
    D] = useState(!1),
  [O,
    $] = useState(!1),
  [B,
    K] = useState({
    show: !1,
    fieldType: null,
    suggestions: [],
    isLoading: !0,
    title: ""
  }),
  [V,
    F] = useState(!1),
  [j,
    q] = useState(!1),
  [Y,
    Q] = useState({
  }),
  [W,
    J] = useState(!1),
  [X,
    z] = useState(!1),
  [Z,
    ee] = useState(!1),
  [te,
    ne] = useState(!1),
  [ae,
    ie] = useState(null),
  [re,
    ce] = useState([]),
  [le,
    se] = useState(!1),
  [oe,
    he] = useState([]),
  [me,
    ge] = useState(!1),
  [ue,
    de] = useState({
    lastPlayerAction: "",
    lastAiResponse: ""
  }),
  [pe,
    Ne] = useState({
    sceneId: null,
    summary: "",
    objective: ""
  }),
  [ye,
    Te] = useState([]),
  Ce = useRef([]),
  [fe,
    be] = useState([]),
  ve = useRef([]),
  [Ee,
    xe] = useState(null),
  Se = useRef(null);
  null === Se.current && (Se.current = new KnowledgeGraph);
  const Re = useRef(null);
  null === Re.current && (Re.current = new VectorMemory);
  const Ie = useRef(null);
  null === Ie.current && (Ie.current = new VectorMemory);
  // world-builder.js: ngữ cảnh AI 0 (World Director) — gợi ý thế giới, KHÔNG phải sự thật chuẩn
  const WbRef = useRef(null);
  const Ae = e => {
    if (null === e || "object" != typeof e) return e;
    if (Array.isArray(e)) return e.map(e => Ae(e));
    const t = {
    };
    for (const n in e) if (Object.prototype.hasOwnProperty.call(e, n)) {
      const a = e[n];
      void 0 !== a && (t[n] = Ae(a))
    }
    return t
  };
  useEffect(() => {
    Ce.current = ye
  }, [ye]),
  useEffect(() => {
    ve.current = fe
  }, [fe]),
  useEffect(() => {
    xe(buildCanonicalWorldState(_, n, oe, fe, ye.length))
  }, [_,
    n,
    oe,
    fe,
    ye.length]);
  const He = useCallback(async(e, t = null) => {
    const a = Ce.current || [],
      i = a.reduce((e, t) => Math.max(e, Number(t.turnNumber) || 0), 0) + 1,
      r = e.id || crypto.randomUUID(),
      c = {
      schemaVersion: 2,
      id: r,
      turnNumber: i,
      timestamp: e.timestamp || (new Date).toISOString(),
      actionType: e.actionType || "user_custom_action",
      playerAction: String(e.playerAction || ""),
      narrative: String(e.narrative || ""),
      rawAiResponse: String(e.rawAiResponse || e.narrative || ""),
      analysis: String(e.analysis || ""),
      canonicalEvents: Array.isArray(e.canonicalEvents) ? e.canonicalEvents : [],
      memoryAnchors: Array.isArray(e.memoryAnchors) ? e.memoryAnchors.slice(0, 80): [],
      systemEvents: Array.isArray(e.systemEvents) ? e.systemEvents : extractStructuredSystemEvents(e.rawAiResponse || e.narrative || ""),
      validationWarnings: Array.isArray(e.validationWarnings) ? e.validationWarnings : [],
      memoryVerification: e.memoryVerification && "object" == typeof e.memoryVerification ? cloneMemoryData(e.memoryVerification) : null,
      sceneId: e.sceneId || pe.sceneId || null
    },
      l = [...a,
      c];
    Ce.current = l,
      Te(l);
    const s = c.validationWarnings.map(e => e.eventIndex).filter(e => Number.isInteger(e)),
      o = applyCanonicalEventsToFacts(ve.current, c.canonicalEvents, i, r, s);
    ve.current = o,
      be(o),
      xe(buildCanonicalWorldState(_, n, oe, o, i));
    const h = `Lượt truyện ${i}\nHành động người chơi: ${c.playerAction}\nDiễn biến: ${c.narrative}\nSự kiện chuẩn: ${JSON.stringify(c.canonicalEvents)}\nChi tiết được lập chỉ mục: ${JSON.stringify(c.memoryAnchors)}`;
    Re.current && (c.playerAction || c.narrative) && await Re.current.addMemory(h);
    const m = t || E;
    if (p && m && y) try {
      await fbSaveLedgerTurn(p, m, c)
    } catch (e) {
      console.error("Không thể lưu một lượt vào Canonical Story Ledger:", e)
    }
    return c
  }, [pe.sceneId,
    _,
    n,
    oe,
    E,
    p,
    y,
    db,
    appId]),
  we = useCallback((e, t) => {
    e ?(ie({
      ...e,
      category: t.toLowerCase()
    }), ne(!0)): (console.error("openQuickLoreModal was called with an invalid item."),
        H({
      show: !0,
      title: "Lỗi Hiển Thị",
      content: "Không thể hiển thị thông tin chi tiết.",
      type: "error"
    }))
  }, []),
  Pe = useCallback(async e => {
    const t = {
      contents: [{
          role: "user",
          parts: [{
              text: e
            }]
        }],
      generationConfig: buildFastGenerationConfig(),
      safetySettings: BLOCK_NONE_SAFETY
    };
    try {
      const e = await geminiFetch(GEMINI_MODEL_ID, t),
        n = await e.json();
      if (n.candidates && n.candidates[0]?.content?.parts?.[0]?.text) return n.candidates[0].content.parts[0].text.trim();
      {
        const e = n.error?.message || "Không thể lấy dữ liệu từ AI.";
        return H({
          show: !0,
          title: "Lỗi AI",
          content: e,
          type: "error"
        }),
        null
      }
    } catch (e) {
      return H({
        show: !0,
        title: "Lỗi Mạng",
        content: `Lỗi kết nối khi gọi AI: ${e.message}`,
        type: "error"
      }),
        null
    }
  }, []),
  Le = useCallback(async(e = null) => {
    const t = e || pe;
    if (!t.summary) return;
    console.log("--- Consolidating Episodic Memory using TextRank ---");
    const n = (new TextRankSummarizer).summarize(t.summary, TEXTRANK_SUMMARY_SENTENCES);
    n && "" !== n.trim() && (await Re.current.addMemory(`(Ký ức đã củng cố từ cảnh ${t.sceneId}) ${n}`),
        console.log("✅ Episodic memory consolidated and saved to long-term memory via TextRank.")),
      Ne({
      sceneId: crypto.randomUUID(),
      summary: "",
      objective: ""
    }),
      H({
      show: !0,
      title: "Ký Ức Được Củng Cố",
      content: "Bản tóm tắt cảnh đã được đưa vào bộ nhớ tìm kiếm; nhật ký gốc vẫn được giữ riêng.",
      type: "info"
    })
  }, [pe,
    Re]),
  Ue = useCallback(async e => {
    $(!0),
      K({
      show: !0,
      fieldType: e,
      suggestions: [],
      isLoading: !0,
      title: "theme" === e ? "✨ Gợi Ý Chủ Đề" : "✨ Gợi Ý Bối Cảnh"
    });
    let t = "";
    if ("theme" === e) t = buildThemeSuggestionPrompt();
    else if ("setting" === e) {
      t = buildSettingSuggestionPrompt(n)
    }
    const a = await Pe(t);
    if (a) {
      const e = a.split("\n").map(e => e.trim()).filter(e => e);
      K(t => ({
        ...t,
        suggestions: e,
        isLoading: !1
      }))
    } else K(e => ({
      ...e,
      suggestions: [],
      isLoading: !1
    }));
    $(!1)
  }, [n.theme,
    Pe]),
  _e = useCallback(async() => {
    F(!0);
    const {
      characterName: e,
      characterGender: t,
      theme: i,
      setting: r
    } = n,
      c = buildCharacterBackstoryPrompt(n),
      l = await Pe(c);
    l && a(e => ({
      ...e,
      characterBackstory: l
    })),
      F(!1)
  }, [n,
    Pe]),
  Me = useCallback(async() => {
    q(!0);
    const {
      theme: e,
      setting: t
    } = n,
      i = buildDifficultyDescriptionPrompt(n),
      r = await Pe(i);
    r && a(e => ({
      ...e,
      difficultyDescription: r
    })),
      q(!1)
  }, [n.theme,
    n.setting,
    Pe]),
  Ge = useCallback(async() => {
    J(!0);
    const {
      theme: e,
      setting: t,
      characterBackstory: a
    } = n,
      i = buildCharacterGoalSuggestionPrompt(n),
      r = await Pe(i);
    if (r) {
      const e = r.split("\n").map(e => e.trim()).filter(e => e);
      K({
        show: !0,
        fieldType: "characterGoal",
        suggestions: e,
        isLoading: !1,
        title: "✨ Gợi Ý Mục Tiêu/Động Lực"
      })
    }
    J(!1)
  }, [n,
    Pe]),
  De = useCallback(async() => {
    z(!0);
    const {
      theme: e,
      characterGender: t
    } = n,
      i = buildCharacterNameSuggestionPrompt(n),
      r = await Pe(i);
    r && a(e => ({
      ...e,
      characterName: r.split("\n")[0].trim()
    })),
      z(!1)
  }, [n.theme,
    n.characterGender,
    Pe]),
  Oe = useCallback(async() => {
    ee(!0);
    const {
      theme: e,
      characterBackstory: t
    } = n,
      i = buildInitialSkillSuggestionPrompt(n),
      r = await Pe(i);
    r && a(e => ({
      ...e,
      preferredInitialSkill: r.split("\n")[0].trim()
    })),
      ee(!1)
  }, [n.theme,
    n.characterBackstory,
    Pe]),
  $e = (e, t) => {
    e && t && P({
      show: !0,
      title: "Xác Nhận Xóa",
      content: "Bạn có chắc chắn muốn xóa mục này vĩnh viễn khỏi nhận thức của AI? Hành động này không thể hoàn tác.",
      onConfirm: () => {
        M(n => {
          if (!n || !n[t]) return n;
          const a = n[t].find(t => t.id === e);
          if (a) {
            const e = a.Name || a.name || a.NPC || "một thực thể";
            Fe(`(Hệ thống): Chủ quản thế giới đã xóa sổ [${e}] khỏi thực tại.`)
          }
          const i = n[t].filter(t => t.id !== e);
          return {
            ...n,
            [t]: i
          }
        }),
          H({
          show: !0,
          title: "Đã Xóa Sổ",
          content: "Mục đã được xóa. AI sẽ không còn nhớ về nó ở lượt tiếp theo.",
          type: "success"
        })
      },
      confirmText: "Xóa Sổ",
      cancelText: "Hủy"
    })
  },
  Be = useCallback((e, t, n) => {
    M(a => {
      const i = a[e] || [],
          r = i.findIndex(e => e.id === t);
      if (- 1 === r) return a;
      const c = [...i];
      return c[r] = {
        ...c[r],
        ...n
      },
          {
        ...a,
        [e]: c
      }
    }),
      H({
      show: !0,
      title: "Thành Công",
      content: "Đã cập nhật thông tin NPC.",
      type: "success"
    })
  }, []),
  Ke = useCallback(async e => {
    const t = _.npcs.find(t => t.id === e);
    if (!t) return;
    F(!0),
      H({
      show: !0,
      title: "AI Đang Quét Lịch Sử",
      content: `Đang phân tích dữ liệu để cập nhật hồ sơ cho [${t.Name}]... Vui lòng đợi.`,
      type: "info"
    });
    const n = buildNpcProfileUpdatePrompt({ events: re, npcName: t.Name });
    try {
      const a = await Pe(n);
      if (a) {
        let n = a.replace(/```json/gi, "").replace(/```/gi, "").trim();
        const i = JSON.parse(n),
          r = {
          ...i,
          plan: Array.isArray(i.Plan) ? i.Plan : [],
          skills: Array.isArray(i.Skills) ? i.Skills : []
        };
        delete r.Plan,
          delete r.Skills,
          Be("npcs", e, r),
          H({
          show: !0,
          title: "✨ AI Đã Cập Nhật",
          content: `Hồ sơ của [${t.Name}] đã được cập nhật dựa trên dòng thời gian!`,
          type: "success"
        })
      }
    } catch (e) {
      console.error("Auto update NPC failed:", e),
        H({
        show: !0,
        title: "Lỗi AI",
        content: "AI không thể tạo JSON hợp lệ hoặc xảy ra lỗi mạng. Hãy thử lại.",
        type: "error"
      })
    }
    F(!1)
  }, [_.npcs,
    re,
    Pe,
    Be]);
  useEffect(() => {
    const e = onAuthStateChanged(auth, async e => {
      if (e) N(e.uid);
      else try {
        "undefined" != typeof __initial_auth_token && __initial_auth_token ? await signInWithCustomToken(auth,
              __initial_auth_token): await signInAnonymously(auth)
      } catch (e) {
        console.error("Error during sign-in:", e)
      }
      T(!0)
    });
    return () => e()
  }, []),
  useEffect(() => {
    if (y && p) {
      const t = fbSubscribeGames(p, t => {
        const n = t.sort((e, t) => {
          const n = e.updatedAt?.toDate?.()?.getTime() || 0;
          return (t.updatedAt?.toDate?.()?.getTime() || 0) - n
        });
        R(n)
      }, e => {
        console.error("Error fetching saved games:", e),
            H({
          show: !0,
          title: "Lỗi Tải Game",
          content: `Không thể tải danh sách game đã lưu: ${e.message}`,
          type: "error"
        })
      });
      return () => t()
    }
  }, [y,
    p,
    db,
    appId]);
  const Ve = useCallback(e => {
    const {
      name: t,
      value: n,
      type: i,
      checked: r
    } = e.target;
    a(e => ({
      ...e,
      [t]: "checkbox" === i ? r : n
    })),
      "difficulty" === t && "Tuỳ Chỉnh AI" !== n && a(e => ({
      ...e,
      difficultyDescription: ""
    })),
      "useCharacterGoal" !== t || r || a(e => ({
      ...e,
      characterGoal: ""
    }))
  }, []),
  Fe = e => {
    if (!e || "" === e.trim()) return;
    const t = {
      id: crypto.randomUUID(),
      content: e,
      timestamp: Date.now()
    };
    ce(e => [t,
      ...e]),
    Ie.current && Ie.current.addMemory(e)
  },
  je = async e => {
    let t = e,
    a = null;
    const i = extractCanonicalEventsBlock(t);
    t = i.textWithoutBlock;
    const r = i.events,
    c = extractMemoryAnchorsBlock(t);
    t = c.textWithoutBlock;
    const l = c.anchors,
    s = /<PHAN_TICH>([\s\S]*?)<\/PHAN_TICH>/gi,
    o = s.exec(t);
    o && (a = o[1].trim(), t = t.replace(s, "").trim());
    let g = !1;
    t = t.replace(/\[SCENE_END:\s*"([^"]+)"\]/g,
      (e, t) => (g = !0, console.log(`SCENE END DETECTED. Reason: ${t}`), "")),
    e.includes("--- CẮT CẢNH ---") && h(0);
    let u = !1,
    d = !1,
    p = !1;
    const N = {
      npcs: [],
      items: [],
      locations: [],
      companions: [],
      inventory: [],
      playerSkills: [],
      relationships: [],
      playerStatus: [],
      quests: [],
      hiddenTags: [],
      factions: [],
      factionRelationships: [],
      _removePlayerStatusByName: [],
      _updateNpcStatus: [],
      _updateQuest: [],
      _updateQuestObjective: [],
      _npcFullUpdate: [],
      _relationshipPointsUpdate: [],
      _relationshipUpdate: [],
      _npcRelationshipUpdate: [],
      _timePass: 0
    },
    y = {
      ACTIVITY_LOG: /\[ACTIVITY_LOG:\s*([^\]]+)\]/gs,
      TIME_PASS: /\[TIME_PASS:\s*([^\]]+)\]/gs,
      FACTION_UPDATE: /\[FACTION_UPDATE:\s*([^\]]+)\]/gs,
      FACTION_RELATIONSHIP: /\[FACTION_RELATIONSHIP:\s*([^\]]+)\]/gs,
      HIDDEN_TAG: /\[HIDDEN_TAG:\s*([^\]]+)\]/gs,
      LORE_ITEM: /\[LORE_ITEM:\s*([^\]]+)\]/gs,
      LORE_LOCATION: /\[LORE_LOCATION:\s*([^\]]+)\]/gs,
      COMPANION: /\[COMPANION:\s*([^\]]+)\]/gs,
      ITEM_AQUIRED: /\[ITEM_AQUIRED:\s*([^\]]+)\]/gs,
      SKILL_LEARNED: /\[SKILL_LEARNED:\s*([^\]]+)\]/gs,
      ITEM_CONSUMED: /\[ITEM_CONSUMED:\s*([^\]]+)\]/gs,
      ITEM_UPDATED: /\[ITEM_UPDATED:\s*([^\]]+)\]/gs,
      STATUS_APPLIED_SELF: /\[STATUS_APPLIED_SELF:\s*([^\]]+)\]/gs,
      STATUS_CURED_SELF: /\[STATUS_CURED_SELF:\s*Name="([^"]+)"\]/gs,
      STATUS_EXPIRED_SELF: /\[STATUS_EXPIRED_SELF:\s*Name="([^"]+)"\]/gs,
      STATUS_APPLIED_NPC: /\[STATUS_APPLIED_NPC:\s*([^\]]+)\]/gs,
      STATUS_CURED_NPC: /\[STATUS_CURED_NPC:\s*NPCName="([^"]+)",\s*StatusName="([^"]+)"\]/gs,
      STATUS_EXPIRED_NPC: /\[STATUS_EXPIRED_NPC:\s*NPCName="([^"]+)",\s*StatusName="([^"]+)"\]/gs,
      QUEST_ASSIGNED: /\[QUEST_ASSIGNED:\s*([^\]]+)\]/gs,
      QUEST_UPDATED: /\[QUEST_UPDATED:\s*([^\]]+)\]/gs,
      QUEST_OBJECTIVE_COMPLETED: /\[QUEST_OBJECTIVE_COMPLETED:\s*([^\]]+)\]/gs,
      NPC_UPDATE: /\[NPC_UPDATE:\s*([^\]]+)\]/gs,
      RELATIONSHIP_POINTS_CHANGE: /\[RELATIONSHIP_POINTS_CHANGE:\s*([^\]]+)\]/gs,
      RELATIONSHIP_UPDATE: /\[RELATIONSHIP_UPDATE:\s*([^\]]+)\]/gs,
      NPC_RELATIONSHIP_UPDATE: /\[NPC_RELATIONSHIP_UPDATE:\s*([^\]]+)\]/gs
    },
    T = {
      LORE_ITEM: "items",
      LORE_LOCATION: "locations",
      COMPANION: "companions",
      ITEM_AQUIRED: "inventory",
      SKILL_LEARNED: "playerSkills",
      ITEM_CONSUMED: "inventory",
      ITEM_UPDATED: "inventory",
      STATUS_APPLIED_SELF: "playerStatus",
      QUEST_ASSIGNED: "quests",
      HIDDEN_TAG: "hiddenTags",
      FACTION_UPDATE: "factions"
    };
    for (const e in y) {
      const a = y[e];
      let i;
      const r = [];
      for (; null !== (i = a.exec(t)); ) {
        r.push(i[0]);
        try {
          const t = parseKeyValueString(i[1] || i[2] || ""),
          a = n?.characterName?.trim().toLowerCase();
          if ("TIME_PASS" === e) t.Days && (N._timePass = parseInt(t.Days, 10));
          else if ("FACTION_RELATIONSHIP" === e) t.Faction1 && t.Faction2 && N.factionRelationships.push(t);
          else if ("NPC_UPDATE" === e) "dead" === t.lifeStatus && (d = !0),
          t.NPCName && (t.NPCName.trim().toLowerCase() !== a ? N._npcFullUpdate.push(t) : console.warn("Đã chặn AI dùng [NPC_UPDATE] lên Nhân vật chính."));
          else if ("QUEST_UPDATED" === e) "completed" === t.status && (u = !0),
          t.title?.trim() && N._updateQuest.push(t);
          else if ("LORE_LOCATION" === e) {
            _.locations.find(e => e.Name === t.Name) || (p = !0);
            const n = T[e];
            n && N[n].push({
              id: crypto.randomUUID(),
              ...t,
              name: t.Name
            })
          } else if ("RELATIONSHIP_POINTS_CHANGE" === e) t.NPC && t.NPC.trim().toLowerCase() !== a && N._relationshipPointsUpdate.push(t);
          else if ("RELATIONSHIP_UPDATE" === e) t.NPC && t.NPC.trim().toLowerCase() !== a && N._relationshipUpdate.push(t);
          else if ("NPC_RELATIONSHIP_UPDATE" === e) {
            if (t.NPC1 && t.NPC2) {
              const e = t.NPC1.trim().toLowerCase(),
              n = t.NPC2.trim().toLowerCase();
              e === a ?(N._relationshipPointsUpdate.push({
                NPC: t.NPC2,
                Value: t.Value,
                Reason: t.Standing || "Tương tác tự động"
              }),
                t.Standing && N._relationshipUpdate.push({
                NPC: t.NPC2,
                NpcToPlayerCall: t.Standing
              })): n === a ?(N._relationshipPointsUpdate.push({
                NPC: t.NPC1,
                Value: t.Value,
                Reason: t.Standing || "Tương tác tự động"
              }),
                t.Standing && N._relationshipUpdate.push({
                NPC: t.NPC1,
                PlayerToNpcCall: t.Standing
              })): N._npcRelationshipUpdate.push(t)
            }
          } else if ("ACTIVITY_LOG" === e) Fe(i[1].trim().replace(/^"|"$/g, ""));
          else if (e.includes("STATUS_CURED_SELF") || e.includes("STATUS_EXPIRED_SELF")) i[1] && "" !== i[1].trim() && N._removePlayerStatusByName.push(i[1].trim());
          else if (e.includes("STATUS_APPLIED_NPC")) t.NPCName?.trim() && t.Name?.trim() && (t.NPCName.trim().toLowerCase() !== a ? N._updateNpcStatus.push({
            npcName: t.NPCName,
            status:{
              id: crypto.randomUUID(),
              ...t,
              NPCName: void 0
            }
          }): N.playerStatus.push({
            id: crypto.randomUUID(),
            ...t,
            name: t.Name,
            type: t.type || "neutral"
          }));
          else if (e.includes("STATUS_CURED_NPC") || e.includes("STATUS_EXPIRED_NPC")) i[1]?.trim() && i[2]?.trim() && i[1].trim().toLowerCase() !== a && N._updateNpcStatus.push({
            npcName: i[1],
            removeStatusName: i[2]
          });
          else if ("QUEST_OBJECTIVE_COMPLETED" === e) t.questTitle?.trim() && t.objectiveDescription?.trim() && N._updateQuestObjective.push(t);
          else {
            const n = T[e],
            a = t.Name || t.name || t.title || t.Title || t["Tên"] || t["Tên Kỹ Năng"] || t["Tên Vật Phẩm"] || t["Tên Công Pháp"];
            if (n && a && "" !== a.trim()) {
              let i = {
                ...t
              };
              i.Name = a,
              i.Description = t.Description || t.description || t["Mô tả"] || t["Mô Tả"] || t["Mô tả chi tiết"] || "Không có mô tả.",
              i.Type = t.Type || t.type || t["Loại"] || "Chưa phân loại";
              let r = {
                id: crypto.randomUUID(),
                ...i,
                name: a
              };
              "quests" === n && (r.objectives = t.objectives ? t.objectives.split(";").map(e => ({
                text: e.trim(),
                completed: !1
              })): [], r.status = t.status || "active"),
              "ITEM_CONSUMED" === e ?(N._toRemove || (N._toRemove = []),
                N._toRemove.push({
                category: n,
                name: r.Name
              })): "ITEM_UPDATED" === e ?(N._toUpdate || (N._toUpdate = []),
                N._toUpdate.push({
                category: n,
                data: r
              })): (N[n] || (N[n] = []), N[n].push(r))
            }
          }
        } catch (t) {
          console.error(`Error parsing ${e}:`, i[1], t)
        }
      }
      r.forEach(e => t = t.replace(e, "").trim())
    }(u || d || p) && (g = !0,
      console.log(`SCENE END DETECTED (auto): QuestCompleted=${u}, NpcDefeated=${d}, NewLocation=${p}`));
    M(e => {
      let t = JSON.parse(JSON.stringify(e));
      if (N._timePass > 0) {
        t.worldTime || (t.worldTime = {
          day: 1,
          month: 1,
          year: 1
        });
        let e = t.worldTime.day + N._timePass,
          n = t.worldTime.month,
          a = t.worldTime.year;
        for (; e > 30; ) e -= 30,
          n += 1;
        for (; n > 12; ) n -= 12,
          a += 1;
        t.worldTime = {
          ...t.worldTime,
          day: e,
          month: n,
          year: a
        }
      }
      N.factions.length > 0 && (t.factions || (t.factions = []),
          N.factions.forEach(e => {
        const n = t.factions.findIndex(t => t.Name === e.Name);
        n > - 1 ? t.factions[n] = {
          ...t.factions[n],
          ...e
        }: t.factions.push(e)
      })),
        N.factionRelationships.length > 0 && (t.factionRelationships || (t.factionRelationships = []),
          N.factionRelationships.forEach(e => {
        const n = t.factionRelationships.findIndex(t => t.Faction1 === e.Faction1 && t.Faction2 === e.Faction2 || t.Faction1 === e.Faction2 && t.Faction2 === e.Faction1);
        n > - 1 ? t.factionRelationships[n] = e : t.factionRelationships.push(e)
      })),
        N._npcFullUpdate.length > 0 && N._npcFullUpdate.forEach(e => {
        const n = e.NPCName,
            a = e.RenameFrom;
        let i = - 1;
        i = a ? t.npcs.findIndex(e => e.Name === a) : t.npcs.findIndex(e => e.Name === n),
            - 1 === i && (t.npcs.push({
          id: crypto.randomUUID(),
          Name: n,
          memory: [],
          skills: [],
          plan: [],
          relationships: [],
          lifeStatus: "alive"
        }),
              t.relationships.push({
          id: crypto.randomUUID(),
          NPC: n,
          score: 0,
          history: [],
          PlayerToNpcCall: e.PlayerToNpcCall || "Chưa xác định",
          NpcToPlayerCall: e.NpcToPlayerCall || "Chưa xác định"
        }), i = t.npcs.length - 1);
        const r = t.npcs[i];
        if (a) {
          r.Name = n;
          let e = t.relationships.findIndex(e => e.NPC === a);
          - 1 !== e && (t.relationships[e].NPC = n)
        }
        if (!e.Origin || r.Origin && "Chưa rõ xuất thân" !== r.Origin || (r.Origin = e.Origin),
              !e.Appearance || r.Appearance && "Chưa rõ dung mạo" !== r.Appearance || (r.Appearance = e.Appearance),
              e.Description && (r.Description = e.Description),
              e.Personality && (r.Personality = e.Personality),
              e.TrueEgo && (r.TrueEgo = e.TrueEgo),
              e.Persona && (r.Persona = e.Persona),
              e.StateOfMind && (r.StateOfMind = e.StateOfMind),
              e.Boundaries && (r.Boundaries = e.Boundaries),
              e.CoreDesire && (r.CoreDesire = e.CoreDesire),
              e.CoreFear && (r.CoreFear = e.CoreFear),
              e.SpeakingStyle && (r.SpeakingStyle = e.SpeakingStyle),
              e.TypicalSchedule && (r.TypicalSchedule = e.TypicalSchedule),
              e.Goal && (r.Goal = e.Goal), e.Beliefs && (r.Beliefs = e.Beliefs),
              e.lifeStatus && (r.lifeStatus = e.lifeStatus), e.Age && (r.Age = e.Age),
              e.Faction && (r.Faction = e.Faction), e.Wealth && (r.Wealth = e.Wealth),
              e.Status && (r.Status = e.Status),
              e.Plan && (r.plan = e.Plan.split(";").map(e => e.trim()).filter(Boolean)),
              e.MemoryAdd && (r.memory || (r.memory = []), r.memory.push(e.MemoryAdd)),
              e.Skills && (r.skills = e.Skills.split(";").map(e => e.trim()).filter(Boolean)),
              e.SkillAdd && (r.skills || (r.skills = []),
                e.SkillAdd.split(";").forEach(e => {
          const t = e.trim();
          t && !r.skills.includes(t) && r.skills.push(t)
        })), e.PlayerToNpcCall || e.NpcToPlayerCall) {
          let a = t.relationships.findIndex(e => e.NPC === n);
          - 1 !== a && (e.PlayerToNpcCall && (t.relationships[a].PlayerToNpcCall = e.PlayerToNpcCall),
                e.NpcToPlayerCall && (t.relationships[a].NpcToPlayerCall = e.NpcToPlayerCall))
        }
        t.npcs[i] = r
      }),
        N._relationshipPointsUpdate.length > 0 && N._relationshipPointsUpdate.forEach(e => {
        const n = e.NPC;
        let a = t.relationships.findIndex(e => e.NPC === n);
        - 1 === a && (t.relationships.push({
          id: crypto.randomUUID(),
          NPC: n,
          score: 0,
          history: [],
          PlayerToNpcCall: "Chưa xác định",
          NpcToPlayerCall: "Chưa xác định"
        }), a = t.relationships.length - 1);
        const i = t.relationships[a],
            r = parseInt(e.Value, 10);
        isNaN(r) || (i.score = (i.score || 0) + r, i.score > 100 && (i.score = 100),
              i.score < - 100 && (i.score = - 100)),
            e.Reason && (i.history || (i.history = []),
              i.history.push(`${r>0?"+":""}${r}: ${e.Reason}`)),
            t.relationships[a] = i
      }),
        N._relationshipUpdate.length > 0 && N._relationshipUpdate.forEach(e => {
        const n = e.NPC;
        let a = t.relationships.findIndex(e => e.NPC === n);
        - 1 === a ? t.relationships.push({
          id: crypto.randomUUID(),
          NPC: n,
          score: 0,
          history: [],
          PlayerToNpcCall: e.PlayerToNpcCall || "Chưa xác định",
          NpcToPlayerCall: e.NpcToPlayerCall || "Chưa xác định"
        }): (e.PlayerToNpcCall && (t.relationships[a].PlayerToNpcCall = e.PlayerToNpcCall),
              e.NpcToPlayerCall && (t.relationships[a].NpcToPlayerCall = e.NpcToPlayerCall))
      }),
        N._npcRelationshipUpdate.length > 0 && N._npcRelationshipUpdate.forEach(e => {
        const {
          NPC1: n,
          NPC2: a,
          Value: i,
          Standing: r
        } = e,
            c = parseInt(i, 10) || 0,
            l = (e, n) => {
          let a = t.npcs.findIndex(t => t.Name === e);
          - 1 === a && (t.npcs.push({
            id: crypto.randomUUID(),
            Name: e,
            Description: "Chưa có thông tin chi tiết.",
            memory: [],
            skills: [],
            plan: [],
            relationships: [],
            lifeStatus: "alive"
          }), a = t.npcs.length - 1),
              t.npcs[a].relationships || (t.npcs[a].relationships = []);
          const i = t.npcs[a].relationships.findIndex(e => e.targetNPC === n);
          i > - 1 ?(t.npcs[a].relationships[i].score = (t.npcs[a].relationships[i].score || 0) + c,
                r && (t.npcs[a].relationships[i].standing = r)): t.npcs[a].relationships.push({
            targetNPC: n,
            score: c,
            standing: r || "Chưa rõ"
          })
        };
        l(n, a),
            l(a, n)
      });
      const a = (e, n) => {
        const a = n.Name || n.title || n.name;
        if (!a) return;
        t[e] || (t[e] = []);
        const i = a.trim().toLowerCase(),
          r = t[e].findIndex(e => {
          const t = e.Name || e.title || e.name;
          return t && t.trim().toLowerCase() === i
        });
        r > - 1 ? t[e][r] = {
          ...t[e][r],
          ...n
        }: t[e].push(n)
      };
      for (const e in N) e.startsWith("_") || N[e] && N[e].length > 0 && N[e].forEach(t => a(e,
            t));
      var i;
      return N._toUpdate && N._toUpdate.forEach(e => {
        const {
          category: n,
          data: a
        } = e;
        if (t[n]) {
          const e = t[n].findIndex(e => e.Name === a.Name);
          e > - 1 && (t[n][e] = {
            ...t[n][e],
            ...a
          })
        }
      }),
        N._toRemove && N._toRemove.forEach(e => {
        const {
          category: n,
          name: a
        } = e;
        t[n] && (t[n] = t[n].filter(e => e.Name !== a))
      }),
        N._removePlayerStatusByName.length > 0 && (t.playerStatus = t.playerStatus.filter(e => !N._removePlayerStatusByName.includes(e.name))),
        N._updateNpcStatus.length > 0 && N._updateNpcStatus.forEach(e => {
        const n = t.npcs.findIndex(t => t.Name === e.npcName);
        if (n > - 1) if (t.npcs[n].statuses || (t.npcs[n].statuses = []), e.status) {
          const a = t.npcs[n].statuses.findIndex(t => t.name === e.status.name);
          a > - 1 ? t.npcs[n].statuses[a] = {
            ...t.npcs[n].statuses[a],
            ...e.status
          }: t.npcs[n].statuses.push(e.status)
        } else e.removeStatusName && (t.npcs[n].statuses = t.npcs[n].statuses.filter(t => t.name !== e.removeStatusName))
      }),
        N._updateQuest.length > 0 && N._updateQuest.forEach(e => {
        const n = t.quests.findIndex(t => t.title === e.title);
        n > - 1 && (t.quests[n] = {
          ...t.quests[n],
          ...e
        })
      }),
        N._updateQuestObjective.length > 0 && N._updateQuestObjective.forEach(e => {
        const n = t.quests.findIndex(t => t.title === e.questTitle);
        if (n > - 1 && Array.isArray(t.quests[n].objectives)) {
          const a = t.quests[n].objectives.findIndex(t => t.text === e.objectiveDescription);
          a > - 1 && (t.quests[n].objectives[a].completed = !0)
        }
      }),
        i = t,
        n.characterName && (i.npcs?.forEach(e => Se.current.addOrUpdateNode(e.Name, "NPC",
              {
        personality: e.Personality,
        origin: e.Origin,
        appearance: e.Appearance,
        description: e.Description,
        goal: e.Goal,
        lifeStatus: e.lifeStatus
      })),
          i.items?.forEach(e => Se.current.addOrUpdateNode(e.Name, "ITEM",
              {
        description: e.Description
      })),
          i.locations?.forEach(e => Se.current.addOrUpdateNode(e.Name, "LOCATION",
              {
        description: e.Description
      })),
          i.inventory?.forEach(e => {
        Se.current.addOrUpdateNode(e.Name, "INVENTORY_ITEM", {
          description: e.Description
        }),
              Se.current.addOrUpdateEdge(n.characterName, e.Name, "SỞ HỮU")
      }),
          i.playerSkills?.forEach(e => {
        Se.current.addOrUpdateNode(e.Name, "SKILL",
                {
          description: e.Description,
          type: e.Type
        }),
              Se.current.addOrUpdateEdge(n.characterName, e.Name, "ĐÃ HỌC CÔNG PHÁP")
      }),
          i.relationships?.forEach(e => {
        Se.current.addOrUpdateEdge(n.characterName, e.NPC, "QUAN HỆ",
                {
          score: e.score,
          playerToNpcCall: e.PlayerToNpcCall,
          npcToPlayerCall: e.NpcToPlayerCall
        })
      }),
          i.quests?.forEach(e => {
        Se.current.addOrUpdateNode(e.title, "QUEST",
                {
          status: e.status,
          description: e.description
        }),
              e.giver && (Se.current.addOrUpdateEdge(e.giver, e.title, "GIAO NHIỆM VỤ"),
                Se.current.addOrUpdateEdge(e.title, n.characterName, "GIAO CHO"))
      })),
        t
    });
    return {
      story: t,
      sceneEnded: g,
      analysis: a,
      canonicalEvents: r,
      memoryAnchors: l
    }
  },
  qe = async(e, t = !1, a = !1, i = "", c = null) => {
    let l;
    if (a || g(!0), t) l = [{
        role: "user",
        parts: [{
            text: e
          }]
      }];
    else {
      const t = b[0];
      const n = CONVERSATION_WINDOW_TURNS;
      let a = b.slice(1);
      a.length > n && (a = a.slice(- n)),
      a.length > 0 && "user" === a[0].role && (a = a.slice(1)),
      l = [],
      t && l.push(t),
      l.push(...a);
      const i = {
        role: "user",
        parts: [{
            text: e
          }]
      };
      l.push(i)
    }
    const s = t ? buildCanonicalWorldState({
    }, n, [], [], 0): buildCanonicalWorldState(_, n, oe, fe, ye.length),
    o = [...(_.npcs || []).map(e => e?.Name || e?.name),
      ...(_.items || []).map(e => e?.Name || e?.name || e?.title),
      ...(_.locations || []).map(e => e?.Name || e?.name),
      ...(_.quests || []).map(e => e?.title || e?.Name || e?.name),
      n.characterName].filter(Boolean),
    h = t ?{
      chunks: [],
      facts: [],
      candidates: [],
      trace:{
        recordsSearched: 0
      }
    }: retrieveHybridStoryMemories(i || e, ye, fe,
      {
      knownEntities: o,
      ...RECALL_LIMITS
    }),
    m = c || h,
    u = formatHybridStoryRecallForPrompt(m),
    d = t ?[] : [...re].reverse().slice(- SUB_LOG_LIMIT),
    p = d.length ? d.map(e => `[Nhật ký phụ ${new Date(e.timestamp||Date.now()).toISOString()}]: ${e.content}`).join("\n") : "Chưa có nhật ký phụ.",
    N = {
      systemInstruction:{
        parts: [{
            text: buildWriterMemoryInstructionPrompt({ worldStateText: formatCanonicalWorldStateForPrompt(s), recallText: u, trace: m.trace, subLog: p })
          }]
      },
      contents: l,
      generationConfig: buildWriterGenerationConfig(),
      safetySettings: BLOCK_NONE_SAFETY
    };
    try {
      const n = await geminiFetch(GEMINI_MODEL_ID, N);
      if (!n.ok) {
        let e = `Mã lỗi: ${n.status}.`;
        if (401 === n.status || 403 === n.status) e = "API Key không hợp lệ hoặc không có quyền truy cập. Vui lòng kiểm tra lại trong phần Thiết Lập API.";
        else try {
          const t = await n.json();
          t.error && t.error.message && (e += ` ${t.error.message}`)
        } catch (e) {
        }
        throw new Error(`Lỗi API: ${e}`)
      }
      const i = await n.text();
      if (!i) throw new Error("API đã trả về một phản hồi trống. Điều này có thể do bộ lọc an toàn của AI đã chặn nội dung. Hãy thử một hành động khác.");
      const r = JSON.parse(i);
      if (r.candidates && r.candidates.length > 0) {
        const n = r.candidates[0];
        if (n.content && n.content.parts && n.content.parts.length > 0 && n.content.parts[0].text) {
          const i = n.content.parts[0].text;
          return a || v(t ?[...l,
            {
              role: "model",
              parts: [{
                  text: i
                }]
            }]: t => {
            let n = [...t],
              a = e;
            if (e.includes("[Ý ĐỊNH MỚI NHẤT CỦA NGƯỜI CHƠI]:")) {
              a = `(Lịch sử hành động): Người chơi đã chọn ${e.split("[Ý ĐỊNH MỚI NHẤT CỦA NGƯỜI CHƠI]:")[1].split("\n")[0].trim()}`
            }
            return n.push({
              role: "user",
              parts: [{
                  text: a
                }]
            }),
              n.push({
              role: "model",
              parts: [{
                  text: i
                }]
            }),
              n
          }),
          i
        }
        if (n.finishReason) {
          let e = n.finishReason;
          throw "SAFETY" === e ? e = "Nội dung bị chặn bởi bộ lọc an toàn" : "MAX_TOKENS" === e ? e = "Đã vượt quá giới hạn độ dài" : "RECITATION" === e && (e = "Nội dung bị chặn do vi phạm bản quyền"),
          new Error(`AI ngừng phản hồi: ${e}. Xin hãy thử một hành động khác (Có thể nội dung tạo ra vi phạm chính sách an toàn của AI).`)
        }
        throw new Error("Phản hồi từ AI không hợp lệ hoặc không chứa nội dung.")
      }
      throw r.promptFeedback && r.promptFeedback.blockReason ? new Error(`Nội dung đã bị chặn bởi bộ lọc an toàn của AI. Lý do: ${r.promptFeedback.blockReason}. Hãy thử một hành động khác.`) : new Error("Phản hồi từ AI không hợp lệ hoặc không chứa nội dung.")
    } catch (e) {
      console.error("Error in callGeminiAPI:", e);
      const t = e.message || "Đã xảy ra lỗi không xác định.";
      return r(e => [...e,
        {
          type: "system",
          content: t,
          id: crypto.randomUUID()
        }]),
      H({
        show: !0,
        title: "Lỗi",
        content: t,
        type: "error"
      }),
      null
    } finally {
      a || g(!1)
    }
  },
  Je = async({
    rawText: e,
    actionText: t,
    recallResult: a = null,
    ledger: i = [],
    facts: r = [],
    knowledgeBaseSnapshot: c = _,
    gameSettingsSnapshot: l = n,
    worldKnowledgeSnapshot: s = oe,
    isInitialCall: o = !1
  }) => {
    const h = Array.isArray(i) ? i : [],
    m = Array.isArray(r) ? r : [],
    g = buildCanonicalWorldState(c || {
    }, l || {
    }, s || [], m, h.length),
    u = extractNarrativeForMemoryVerification(e),
    d = extractMemoryAnchorsBlock(e),
    p = extractCanonicalEventsBlock(e),
    N = JSON.stringify({
      canonicalEvents: p.events,
      memoryAnchors: d.anchors
    }, null, 2).slice(0, VERIFIER_CANDIDATE_JSON_MAX),
    y = formatHybridStoryRecallForPrompt(a || {
      chunks: [],
      facts: [],
      trace:{
        recordsSearched: 0
      }
    }),
    T = JSON.stringify({
      canonicalFacts: m,
      worldState: g
    }, null, 2).slice(0, VERIFIER_BASE_JSON_MAX),
    C = buildMemoryVerifierPrompt({ action: t, baseSettingsText: T, worldMapContext: WbRef.current?"\nBẢN ĐỒ THẾ GIỚI (AI 0 - CHỈ LÀ GỢI Ý THAM KHẢO, KHÔNG PHẢI SỰ THẬT CHUẨN ĐỂ ĐỐI CHIẾU GẮT):\n"+WB.buildWorldContextForConsumer("verifier",WbRef.current)+"\n":"", evidenceText: y, storyText: u, machineDeclarationText: N });
    let f = null;
    try {
      f = await qe(C, o, !0, t || C, a)
    } catch (e) {
      console.warn("Không gọi được cổng kiểm chứng trí nhớ:", e)
    }
    const b = extractMemoryVerificationReport(f || ""),
    v = validateMemoryVerificationEvidence(b, h, m, JSON.stringify(g), u, N),
    E = b.issues.filter(e => ["critical",
      "high"].includes(e.severity));
    return {
      passed: b.valid && "pass" === b.status && 0 === E.length && 0 === v.length,
      report: b,
      evidenceProblems: v,
      checkedAt: (new Date).toISOString(),
      model: GEMINI_MODEL_ID,
      issueCount: b.issues.length,
      seriousIssueCount: E.length,
      auditError: b.valid ? "" : b.error || "Báo cáo kiểm chứng không hợp lệ."
    }
  },
  Xe = useCallback(async(e, t) => {
    g(!0);
    const a = c,
      h = {
      type: t,
      content: e,
      id: crypto.randomUUID()
    };
    r(e => [...e,
      h]);
    let m = "--- DÒNG SUY NGHĨ CỦA TÁC TỬ ---\n";
    m += `1. Phân tích Ý ĐỊNH: "${e}".\n`,
      m += "2. Đọc TOÀN BỘ hành trình từ Nhật ký.\n";
    m += `   -> Đã nạp ${[...re].reverse().length} sự kiện lịch sử.\n`,
      m += "2. Truy xuất ký ức dài hạn và Canonical Story Ledger.\n";
    const u = String(e || "").toLocaleLowerCase(),
      d = [...(_.npcs || []).map(e => e?.Name || e?.name),
      ...(_.items || []).map(e => e?.Name || e?.name || e?.title),
      ...(_.locations || []).map(e => e?.Name || e?.name),
      ...(_.quests || []).map(e => e?.title || e?.Name || e?.name)].filter(Boolean).filter(e => u.includes(String(e).toLocaleLowerCase())).slice(0,
        20),
      p = (_.quests || []).filter(e => /active|đang thực hiện|in progress|ongoing|chưa hoàn thành/i.test(String(e?.status || e?.Status || "active"))).map(e => e?.title || e?.Name || e?.name).filter(Boolean).slice(0,
        5),
      N = [e,
      pe.objective || "",
      String(pe.summary || "").slice(- 500),
      n.characterName || "",
      d.join(" "),
      p.join(" ")].filter(Boolean).join("\n"),
      y = await Re.current.retrieveRelevantMemories(N, 12),
      T = [...(_.npcs || []).map(e => e?.Name || e?.name),
      ...(_.items || []).map(e => e?.Name || e?.name || e?.title),
      ...(_.locations || []).map(e => e?.Name || e?.name),
      ...(_.quests || []).map(e => e?.title || e?.Name || e?.name),
      n.characterName].filter(Boolean),
      C = retrieveHybridStoryMemories(N, Ce.current, ve.current,
        {
      knownEntities: T,
      ...RECALL_LIMITS
    }),
      f = y.length > 0 ? "---KÝ ỨC BỔ TRỢ TỪ VECTOR/TF-IDF---\nChỉ coi đây là gợi ý; xác nhận qua đoạn lịch sử gốc hoặc dữ kiện chuẩn.\n" + y.map(e => `- ${e.text}`).join("\n") : "Chưa tìm thấy ký ức bổ trợ TF-IDF phù hợp.",
      b = `---HYBRID RECALL: TRUY XUẤT CHI TIẾT TOÀN LỊCH SỬ---\n${formatHybridStoryRecallForPrompt(C)}`,
      E = `---TRẠNG THÁI CHUẨN HIỆN TẠI (NGUỒN SỰ THẬT)---\n${formatCanonicalWorldStateForPrompt(buildCanonicalWorldState(_,n,oe,ve.current,Ce.current.length))}`;
    m += `   -> TF-IDF: ${y.length}; hybrid recall: ${C.chunks.length} đoạn, ${C.facts.length} dữ kiện; đã tìm ${C.trace.recordsSearched} bản ghi.\n`;
    const x = `---BỐI CẢNH NGẮN HẠN (LỚP 2)---\nMục tiêu của Cảnh hiện tại: ${pe.objective||"Chưa xác định"}\nTóm tắt diễn biến Cảnh: ${pe.summary||"Cảnh vừa bắt đầu."}`,
      S = `---LƯỢT ĐI NGAY TRƯỚC ĐÓ (LỚP 1)---\nAI vừa kể rằng: "${ue.lastAiResponse}"\n\n[Ý ĐỊNH MỚI NHẤT CỦA NGƯỜI CHƠI]: "${e}"\n(AI LƯU Ý: Phải viết tiếp nối MẠCH LẠC trực tiếp từ diễn biến của lượt đi trước, tuyệt đối không nhảy cóc không gian/thời gian!)`,
      R = Se.current.getContextSummary(n.characterName),
      I = oe.filter(e => e.enabled).map(e => {
      switch (e.type) {
        case "FACT": return `- [SỰ THẬT]: (${e.subject||"?"}) -[${e.verb||"?"}]-> (${e.object||"?"}).`;
        case "CONDITIONAL": return `- [ĐIỀU KIỆN]: NẾU (${e.condition||"?"}) THÌ (${e.effect||"?"}).`;
        case "RELATIONSHIP": return `- [QUAN HỆ]: (${e.subject||"?"}) -[${e.verb||"?"}]-> (${e.object||"?"}).`;
        case "CUSTOM": return `- [LUẬT TÙY CHỈNH]: ${e.content||"(trống)"}`;
        default: return ""
      }
    }).join("\n"),
      k = I ? "---LUẬT LỆ & TRI THỨC THẾ GIỚI (BẮT BUỘC TUÂN THỦ)---\n" + I : "";
    m += "3. Tổng hợp thông tin từ tất cả các lớp trí nhớ để tạo prompt.\n",
      console.log(m);
    const A = buildWriterPrompt({
      playerName: n.characterName,
      playerBackstory: n.characterBackstory,
      lastTurnBlock: S,
      sceneBlock: x,
      memoryBlock: f,
      hybridBlock: b,
      canonicalBlock: E,
      stateReportBlock: buildStatusReportBlock(_, n.characterName),
      graphReportBlock: R,
      customRulesBlock: oe.length > 0 ? k : "",
      worldMapBlock: WbRef.current?"---BẢN ĐỒ THẾ GIỚI (AI 0 - GỢI Ý THAM KHẢO, KHÔNG PHẢI SỰ THẬT CHUẨN)---\n"+WB.buildWorldContextForConsumer("writer",WbRef.current)+"\n---HẾT BẢN ĐỒ THẾ GIỚI---":"",
      systemRules: buildSystemRulesPrompt(n),
      playerAction: e,
      pronounContext: n.pronounContext
    });
    console.log("%c--- FINAL PROMPT SENT TO AI ---",
        "background: #222; color: #bada55; font-size: 14px; padding: 4px;"),
      console.log(A);
    let w = await qe(A, !1, !1, N, C);
    if (!w) return r(e => e.filter(e => e.id !== h.id)),
      l(a),
      "user_custom_action" === t && U(e),
      void g(!1);
    const P = async e => {
      const t = extractCanonicalEventsBlock(e),
        a = extractMemoryAnchorsBlock(e),
        i = validateCanonicalEventsAgainstFacts(collectCanonicalValidationFacts(_, ve.current,
            n.characterName), t.events, e);
      t.found && t.valid || i.push({
        eventIndex: - 1,
        reason: t.found ? "CANONICAL_EVENTS_JSON không phải JSON hợp lệ." : "Phản hồi thiếu khối CANONICAL_EVENTS_JSON."
      }),
        a.found && a.valid || i.push({
        eventIndex: - 1,
        reason: a.found ? "MEMORY_ANCHORS_JSON không phải JSON hợp lệ." : "Phản hồi thiếu khối MEMORY_ANCHORS_JSON."
      });
      const r = extractNarrativeForMemoryVerification(e),
        c = JSON.stringify({
        events: t.events,
        anchors: a.anchors
      }),
        l = `${N}\n${r.slice(0,7000)}\n${c.slice(0,2500)}`.slice(0, 11000),
        s = [...T,
        ...a.anchors.flatMap(e => e.entities || []),
        ...t.events.flatMap(e => e.entities || []),
        ...t.events.map(e => e.subject)].filter(Boolean),
        o = retrieveHybridStoryMemories(l, Ce.current, ve.current,
          {
        knownEntities: [...new Set(s)],
        ...RECALL_LIMITS_DEEP
      }),
        h = await Je({
        rawText: e,
        actionText: N,
        recallResult: o,
        ledger: Ce.current,
        facts: ve.current,
        knowledgeBaseSnapshot: _,
        gameSettingsSnapshot: n,
        worldKnowledgeSnapshot: oe,
        isInitialCall: !1
      });
      return {
        passed: 0 === i.length && h.passed,
        canonicalConflicts: i,
        audit: h,
        recallResult: o
      }
    };
    let L = await P(w),
      M = !1;
    if (!L.passed) {
      const e = buildMemoryGateFixPrompt({ writerPrompt: A, failureSummary: summarizeMemoryGateFailure(L.canonicalConflicts,L.audit.report,L.audit.evidenceProblems).join(" | "), recallText: formatHybridStoryRecallForPrompt(L.recallResult) }),
        t = await qe(e, !1, !0, N, L.recallResult || C);
      t && (w = t, M = !0, L = await P(w))
    }
    if (!L.passed) {
      const n = summarizeMemoryGateFailure(L.canonicalConflicts, L.audit.report,
          L.audit.evidenceProblems);
      return r(e => e.filter(e => e.id !== h.id)),
        v(e => {
        const t = [...e];
        return "model" === t[t.length - 1]?.role && t.pop(),
            "user" === t[t.length - 1]?.role && t.pop(),
            t
      }),
        l(a),
        "user_custom_action" === t && U(e),
        g(!1),
        void H({
        show: !0,
        title: "Lượt kể chưa vượt qua kiểm chứng trí nhớ",
        type: "warning",
        content: "AI đã được yêu cầu sửa một lần nhưng lượt kể vẫn chưa được xác minh đủ. Lượt này chưa được chấp nhận, không ghi vào Story Ledger và không cập nhật sổ sự thật chuẩn. Bạn có thể thử lại cùng hành động hoặc diễn đạt lại.\n\n" + n.join("\n")
      })
    }
    const G = L.canonicalConflicts,
      D = {
      ...L.audit,
      status: "passed",
      checkedCategories: L.audit.report.checkedCategories,
      summary: L.audit.report.summary,
      issues: L.audit.report.issues
    };
    M && v(e => {
      const t = [...e];
      return "model" === t[t.length - 1]?.role && (t[t.length - 1] = {
        ...t[t.length - 1],
        parts: [{
            text: w
          }]
      }),
          t
    }),
      l(""),
      de(t => ({
      ...t,
      lastPlayerAction: e
    })),
      await Re.current.addMemory(`Ý định đã được chấp nhận: Người chơi muốn thử thực hiện hành động "${e}".`);
    const {
      story: O,
      sceneEnded: B,
      analysis: K,
      canonicalEvents: V = [],
      memoryAnchors: F = []
    } = await je(w);
    de(e => ({
      ...e,
      lastAiResponse: O.slice(- 1500)
    })),
      Ne(t => ({
      ...t,
      summary: `${t.summary||""}\n[Lượt ${Ce.current.length+1}] Hành động: ${e}\nDiễn biến: ${O.slice(0,1000)}`.trim()
    }));
    const j = {
      type: "story",
      content: O,
      id: crypto.randomUUID(),
      analysis: K
    };
    if (r(e => [...e,
      j]),
        await He({
      actionType: t,
      playerAction: e,
      narrative: O,
      rawAiResponse: w,
      analysis: K,
      canonicalEvents: V,
      memoryAnchors: F,
      systemEvents: extractStructuredSystemEvents(w),
      validationWarnings: G.map(e => ({
        ...e
      })),
      memoryVerification: D,
      sceneId: pe.sceneId
    }),
        G.length > 0 && H({
      show: !0,
      title: "Cảnh Báo Nhất Quán",
      type: "warning",
      content: `Bước kiểm định ký ức sau khi AI viết lại vẫn còn ${G.length} cảnh báo. Những dữ kiện bị đánh dấu không được cập nhật vào sổ sự thật chuẩn; hãy kiểm tra đoạn truyện này.\n\n${G.map(e=>e.reason).join("\n")}`
    }), g(!1), B) {
      const t = {
        ...pe,
        summary: `${pe.summary||""}\n[Lượt ${Ce.current.length}] Hành động: ${e}\nDiễn biến: ${O.slice(0,1000)}`.trim()
      };
      await Le(t)
    }
  }, [_,
    oe,
    re,
    n,
    qe,
    Je,
    je,
    Se,
    Re,
    ue,
    pe,
    Le,
    He,
    ye,
    fe,
    c]),
  Ze = useCallback(e => {
    e.trim() && (U(""), Xe(e, "user_custom_action"))
  }, [Xe]),
  et = useCallback(async() => {
    if (p && E && y && 0 !== i.length) {
      d(!0);
      try {
        const t = i.slice(- 40).filter(e => !e.transient);
        let a = b;
        if (b.length > 8001) {
          const e = b[0];
          a = [e,
            ...b.slice(- 8000)]
        }
        const r = {
          currentStory: c,
          storyHistory: t,
          chatHistoryForGemini: a,
          knowledgeBase: _,
          settings: n,
          activityLog: re,
          worldKnowledge: oe,
          workingMemory: ue,
          episodicMemory: pe,
          canonicalMemorySchemaVersion: 2,
          canonicalStoryLedgerCount: Ce.current.length,
          canonicalFactCount: ve.current.length,
          worldDirector: WbRef.current ? Ae(WbRef.current) : null,
          updatedAt: serverTimestamp()
        },
          {
          updatedAt: l,
          ...o
        } = r;
        await fbSaveGame(p, E, {
          ...Ae(o),
          updatedAt: l
        });
        const m = buildCanonicalWorldState(_, n, oe, ve.current, Ce.current.length);
        await fbSaveWorldState(p, E, Ae(m))
      } catch (e) {
        console.error("Error saving game progress:", e)
      } finally {
        setTimeout(() => d(!1), 1000)
      }
    }
  }, [p,
    E,
    y,
    i,
    c,
    b,
    _,
    n,
    re,
    oe,
    ue,
    pe,
    Ee,
    fe,
    ye,
    db,
    appId]);
  useEffect(() => {
    "gameplay" === e && i.length > 0 && E && et()
  }, [i,
    et,
    e,
    E]);
  const tt = async e => {
    if (!e) return;
    Se.current = new KnowledgeGraph,
    Re.current = new VectorMemory;
    let n = Array.isArray(e.canonicalStoryLedger) ? e.canonicalStoryLedger : [],
    i = e.canonicalWorldState || null,
    c = Array.isArray(e.canonicalFacts) ? e.canonicalFacts : [],
    s = !1;
    if (e.id && p && y) {
      try {
        const a = await fbLoadLedger(p, e.id);
        s = !0,
        a.length && (n = a.sort((e, t) => (Number(e.turnNumber) || 0) - (Number(t.turnNumber) || 0)))
      } catch (e) {
        console.warn("Không tải được subcollection storyLedger; sẽ dùng dữ liệu trong file/game document:",
          e)
      }
      try {
        const n = await fbLoadWorldState(p, e.id);
        n && (i = n,
          Array.isArray(i.canonicalFacts) && (c = i.canonicalFacts))
      } catch (e) {
        console.warn("Không tải được bản chụp trạng thái thế giới:", e)
      }
    }
    if (n.length || (n = migrateLegacyStoryHistory(e.storyHistory || [])),
      n = n.map((e, t) => ({
      schemaVersion: 2,
      ...e,
      id: e.id || `loaded-turn-${t+1}`,
      turnNumber: Number(e.turnNumber) || t + 1,
      canonicalEvents: Array.isArray(e.canonicalEvents) ? e.canonicalEvents : [],
      memoryAnchors: Array.isArray(e.memoryAnchors) ? e.memoryAnchors : [],
      systemEvents: Array.isArray(e.systemEvents) ? e.systemEvents : []
    })).sort((e, t) => e.turnNumber - t.turnNumber),
      !c.length && n.length && (c = n.reduce((e, t) => {
      const n = (t.validationWarnings || []).map(e => e.eventIndex).filter(e => Number.isInteger(e));
      return applyCanonicalEventsToFacts(e, t.canonicalEvents, t.turnNumber, t.id, n)
    }, [])), e.id && p && y && s && n.some(e => e.migratedFromLegacyHistory)) try {
      for (const t of n) t.migratedFromLegacyHistory && await fbSaveLedgerTurn(p, e.id, t, !0)
    } catch (e) {
      console.warn("Không thể lưu toàn bộ lịch sử cũ vào storyLedger; lịch sử vẫn còn trong phiên hiện tại:",
        e)
    }
    const h = {
      npcs: [],
      items: [],
      locations: [],
      companions: [],
      inventory: [],
      playerSkills: [],
      relationships: [],
      playerStatus: [],
      quests: []
    },
    m = {
      ...{
        theme: "",
        setting: "",
        characterName: "",
        characterGender: "Không xác định",
        characterBackstory: "",
        preferredInitialSkill: "",
        difficulty: "Thường",
        difficultyDescription: "",
        initialWorldElements: [],
        useCharacterGoal: !1,
        characterGoal: "",
        allowCustomActionInput: !0,
        writingStyle: WRITING_STYLES[0],
        pronounContext: PRONOUN_CONTEXTS[0],
        languageDictionary: LANGUAGE_DICTIONARIES[0]
      },
      ...e.settings || {
      }
    };
    let g = {
      ...h,
      ...e.knowledgeBase || {
      }
    };
    for (const e in h) Array.isArray(g[e]) || (g[e] = []);
    g.npcs && Array.isArray(g.npcs) && g.npcs.forEach(e => {
      e.relationships || (e.relationships = []),
        e.lifeStatus || (e.lifeStatus = "alive")
    }),
    g.quests && Array.isArray(g.quests) && g.quests.forEach(e => {
      Array.isArray(e.objectives) || (e.objectives = [])
    });
    const u = (e.storyHistory || []).filter(e => e && "object" == typeof e && e.id),
    d = n.length > 0 ? ledgerToStoryHistory(n) : u;
    Ce.current = n,
    Te(n),
    ve.current = c,
    be(c),
    a(m),
    M(g),
    ce(e.activityLog || []),
    he(e.worldKnowledge || []),
    l(e.currentStory || ""),
    r(d),
    v(e.chatHistoryForGemini || []),
    x(e.id || null),
    de(e.workingMemory || {
      lastPlayerAction: "Tải game",
      lastAiResponse: e.currentStory || ""
    }),
    Ne(e.episodicMemory || {
      sceneId: crypto.randomUUID(),
      summary: `Tiếp tục từ: ${e.currentStory||"..."}`,
      objective: ""
    }),
    xe(i || buildCanonicalWorldState(g, m, e.worldKnowledge || [], c, n.length));
    WbRef.current = e.worldDirector && "object" == typeof e.worldDirector ? e.worldDirector : null;
    var N,
    T;
    if (N = g,
      (T = m).characterName && (N.npcs?.forEach(e => Se.current.addOrUpdateNode(e.Name, "NPC",
            {
      personality: e.Personality,
      description: e.Description,
      goal: e.Goal,
      lifeStatus: e.lifeStatus
    })),
        N.items?.forEach(e => Se.current.addOrUpdateNode(e.Name, "ITEM",
            {
      description: e.Description
    })),
        N.locations?.forEach(e => Se.current.addOrUpdateNode(e.Name, "LOCATION",
            {
      description: e.Description
    })),
        N.inventory?.forEach(e => {
      Se.current.addOrUpdateNode(e.Name, "INVENTORY_ITEM", {
        description: e.Description
      }),
            Se.current.addOrUpdateEdge(T.characterName, e.Name, "SỞ HỮU")
    }),
        N.relationships?.forEach(e => {
      Se.current.addOrUpdateEdge(T.characterName, e.NPC, "QUAN HỆ",
              {
        score: e.score,
        playerToNpcCall: e.PlayerToNpcCall,
        npcToPlayerCall: e.NpcToPlayerCall
      })
    }),
        N.quests?.forEach(e => {
      Se.current.addOrUpdateNode(e.title, "QUEST",
              {
        status: e.status,
        description: e.description
      }),
            e.giver && (Se.current.addOrUpdateEdge(e.giver, e.title, "GIAO NHIỆM VỤ"),
              Se.current.addOrUpdateEdge(e.title, T.characterName, "GIAO CHO"))
    })),
      await (async(e, t, n) => {
      if (Array.isArray(n) && n.length > 0) for (const e of n) await Re.current.addMemory(`Lượt ${e.turnNumber}: ${e.playerAction||""}\n${e.narrative||e.rawAiResponse||""}\n${JSON.stringify(e.canonicalEvents||[])}\nChi tiết: ${JSON.stringify(e.memoryAnchors||[])}`);
      else for (const t of e) await Re.current.addMemory(`${t.type}: ${t.content}`);
      for (const e of t) await Re.current.addMemory(`Nhật ký: ${e.content}`)
    })(d, e.activityLog || [], n), console.log("Rehydrating Activity Log memory..."),
      Ie.current = new VectorMemory, e.activityLog && e.activityLog.length > 0) for (const t of e.activityLog) await Ie.current.addMemory(t.content);
    console.log(`Activity Log memory rehydrated with ${e.activityLog?.length||0} entries.`),
    t("gameplay"),
    k(!1)
  },
  nt = () => {
    x(null),
    a({
      theme: "",
      setting: "",
      characterName: "",
      characterGender: "Không xác định",
      characterBackstory: "",
      preferredInitialSkill: "",
      difficulty: "Thường",
      difficultyDescription: "",
      initialWorldElements: [],
      useCharacterGoal: !1,
      characterGoal: "",
      allowCustomActionInput: !0,
      writingStyle: WRITING_STYLES[0],
      pronounContext: PRONOUN_CONTEXTS[0],
      languageDictionary: LANGUAGE_DICTIONARIES[0]
    }),
    l(""),
    r([]),
    v([]),
    M({
      npcs: [],
      items: [],
      locations: [],
      companions: [],
      inventory: [],
      playerSkills: [],
      relationships: [],
      playerStatus: [],
      quests: [],
      hiddenTags: [],
      factions: [],
      factionRelationships: [],
      worldTime:{
        day: 1,
        month: 1,
        year: 1
      }
    }),
    ce([]),
    he([]),
    Ce.current = [],
    Te([]),
    ve.current = [],
    be([]),
    xe(buildCanonicalWorldState({
    }, {
    }, [], [], 0)),
    U(""),
    de({
      lastPlayerAction: "",
      lastAiResponse: ""
    }),
    Ne({
      sceneId: null,
      summary: "",
      objective: ""
    }),
    t("setup")
  },
  at = () => {
    "gameplay" === e && i.length > 0 ? P({
      show: !0,
      title: "Về Trang Chủ?",
      content: "Lưu tiến trình game trước khi về trang chủ?",
      onConfirm: async() => {
        E && await et(),
          t("initial")
      },
      onCancel: () => t("initial"),
      confirmText: "Lưu và Về Home",
      cancelText: "Về Home (Không lưu)"
    }): t("initial")
  },
  it = useCallback(e => {
    if (!e) return null;
    const SPAN_REGEX = /(?<!\*)\*[^*\n]+\*(?!\*)|(?<!\w)_[^_\n]+_(?!\w)|"[^"\n]+"/g,
      SPEAKER_WITH_PROSE = /^(.*[.!?…]["'”’]?)\s+([\p{L}\p{N}_]+(?:\s+[\p{L}\p{N}_]+){0,3}:)\s*$/u,
      SPEAKER_ONLY = /^([\p{L}\p{N}_]+(?:\s+[\p{L}\p{N}_]+){0,3}:)\s*$/u,
      splitSpeaker = s => {
        let m = s.match(SPEAKER_WITH_PROSE);
        if (m) return [m[1], m[2] + " "];
        if ((m = s.match(SPEAKER_ONLY))) return ["", m[1] + " "];
        return [s, ""];
      },
      // Xuống dòng trước và sau mỗi đoạn thoại ("...") và mỗi đoạn suy nghĩ nội tâm (*...*, _..._).
      // Nhãn người nói (Tên:) được kéo xuống nằm cùng dòng với câu thoại của mình.
      breakDialogueLines = text => text.split("\n").map(line => {
        const out = [];
        let buf = "",
          last = 0,
          m;
        SPAN_REGEX.lastIndex = 0;
        while ((m = SPAN_REGEX.exec(line))) {
          const narration = buf + line.slice(last, m.index),
            span = m[0];
          buf = "",
            last = SPAN_REGEX.lastIndex;
          const [prose, label] = splitSpeaker(narration.trim());
          "" !== prose && out.push(prose),
            out.push(label + span);
        }
        const rest = (buf + line.slice(last)).trim();
        return "" !== rest && out.push(rest),
          out.join("\n");
      }).join("\n");
    const t = e => {
      let t = [{
          type: "text",
          content: e
        }];
      const n = [];
      if (_) {
        ["companions",
          "npcs",
          "items",
          "locations",
          "inventory",
          "playerSkills",
          "relationships",
          "playerStatus",
          "quests"].forEach(e => {
          (_[e] || []).forEach(t => {
            const a = t.Name || t.NPC || t.name || t.title;
            a && "" !== a.trim() && n.push({
              name: a.trim(),
              category: e,
              originalItem: t
            })
          })
        })
      }
      return n.sort((e, t) => t.name.length - e.name.length),
        n.forEach(e => {
        const {
          name: n,
          category: a,
          originalItem: i
        } = e,
            r = [];
        t.forEach(e => {
          if ("text" === e.type) {
            const t = new RegExp(`(\\b${n.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\b)`, "gi"),
                  c = e.content.split(t);
            for (let e = 0; e < c.length; e++) c[e].toLowerCase() === n.toLowerCase() ? r.push({
              type: "lore",
              text: c[e],
              category: a,
              originalItem: i
            }): "" !== c[e] && r.push({
              type: "text",
              content: c[e]
            })
          } else r.push(e)
        }),
            t = r
      }),
        t.map((e, t) => {
        if ("text" === e.type) {
          let n = breakDialogueLines(e.content);
          return n = n.replace(/\*\*(.*?)\*\*/g,
                '<strong class="text-xl block my-2 text-green-400">$1</strong>'),
              n = n.replace(/^(\p{L}[\p{L}\p{N}_ .'\u2019\-]{0,39}?):[ \t]*"([^"\n]*?)"/gmu,
                '<strong class="text-blue-400">$1:</strong> "$2"'),
              n = n.replace(/(?<![\w*])\*(?!\*)([^*\n]+?)\*(?!\*)/g,
                '<em class="text-purple-400 italic">"$1"</em>'),
              n = n.replace(/(?<!\w)_([^_\n]+?)_(?!\w)/g,
                '<em class="text-purple-400 italic">"$1"</em>'),
              n = n.replace(/\[(?!PLAYER_PERSONALITY|LORE_|COMPANION|ITEM_AQUIRED|SKILL_LEARNED|RELATIONSHIP_CHANGED|ITEM_CONSUMED|ITEM_UPDATED|STATUS_APPLIED_SELF|STATUS_CURED_SELF|STATUS_EXPIRED_SELF|STATUS_APPLIED_NPC|STATUS_CURED_NPC|STATUS_EXPIRED_NPC|QUEST_ASSIGNED|QUEST_UPDATED|QUEST_OBJECTIVE_COMPLETED|ACTIVITY_LOG)(.*?)\]/g,
                '<span class="text-yellow-400 font-semibold">[$1]</span>'),
              React.createElement("span",
                {
            key: `segment-${t}`,
            dangerouslySetInnerHTML:{
              __html: n
            }
          })
        }
        return "lore" === e.type ? React.createElement("span",
              {
          key: `lore-${e.originalItem.id}-${t}`,
          className: "text-cyan-400 hover:text-cyan-300 underline cursor-pointer font-semibold",
          onClick: t => {
            t.stopPropagation(),
                  we(e.originalItem, e.category)
          }
        }, e.text): null
      })
    };
    return e.split(/(--- CẮT CẢNH ---(?:.|\n)*?--- KẾT THÚC CẮT CẢNH ---)/g).map((e, n) => {
      if (e.startsWith("--- CẮT CẢNH ---")) {
        const a = e.replace(/--- CẮT CẢNH ---|--- KẾT THÚC CẮT CẢNH ---/g, "").trim();
        return React.createElement("div",
              {
          key: `cutscene-${n}`,
          className: "my-4 p-4 border-2 border-dashed border-gray-500 rounded-lg bg-gray-800/50"
        },
              React.createElement("h4",
                {
          className: "font-bold text-center text-teal-400 mb-2"
        }, "🎬 CẮT CẢNH 🎬"),
              a.split("\n").map((e, n) => React.createElement("p",
                  {
          key: `cs-line-${n}`,
          className: "text-gray-300 italic leading-relaxed"
        }, t(e))))
      }
      return "" !== e.trim() ? e.split(/\n\s*\n/).map((e, a) => React.createElement("p",
              {
        key: `p-${n}-${a}`,
        className: "mb-3 leading-relaxed"
      },
              e.split("\n").map((n, a) => React.createElement(React.Fragment,
                  {
        key: `line-${a}`
      }, t(n), a < e.split("\n").length - 1 && React.createElement("br", null))))): null
    })
  }, [_,
    we]);
  return y ? React.createElement("div", {
    className: "font-['Arial',_sans-serif] text-white"
  },
    "initial" === e && React.createElement(InitialScreen,
      {
    setCurrentScreen: t,
    setShowLoadGameModal: k,
    savedGames: S,
    userId: p,
    setShowUpdateLogModal: f,
    handleLoadGameFromFile: e => {
      const t = e.target.files[0];
      if (!t) return;
      const n = new FileReader;
      n.onload = async n => {
        try {
          const e = String(n.target.result || ""),
              a = JSON.parse(e);
          if (!a.settings || !a.storyHistory) throw new Error("Tệp lưu không hợp lệ hoặc bị hỏng.");
          await tt({
            ...a,
            id: null
          }),
              H({
            show: !0,
            title: "Tải Thành Công",
            content: `Đã tải game từ tệp "${t.name}".`,
            type: "success"
          })
        } catch (e) {
          console.error("Error loading game from file:", e),
              H({
            show: !0,
            title: "Lỗi Tải Game",
            content: `Không thể tải game từ tệp: ${e.message}`,
            type: "error"
          })
        } finally {
          e.target.value = null
        }
      },
          n.onerror = () => H({
        show: !0,
        title: "Lỗi Đọc Tệp",
        content: "Không thể đọc tệp đã chọn.",
        type: "error"
      }),
          n.readAsText(t)
    }
  }),
    "setup" === e && React.createElement(GameSetupScreen,
      {
    goHome: at,
    gameSettings: n,
    handleInputChange: Ve,
    initializeGame: async() => {
      if (!(n.theme && n.setting && n.characterName && n.characterBackstory)) return void H({
        show: !0,
        title: "Thiếu Thông Tin",
        content: "Vui lòng điền đủ Chủ đề, Bối cảnh, Tên và Tiểu sử.",
        type: "error"
      });
      g(!0);
      Se.current = new KnowledgeGraph,
          Re.current = new VectorMemory,
          l(""),
          r([]),
          v([]);
      // === WORLD-BUILDER: seed thực thể người chơi tạo vào kho TRƯỚC khi gọi AI ===
      // (v196 ghi thẳng vào kho; bản cũ chỉ chép thành chữ trong prompt → AI dễ bỏ sót vĩnh viễn)
      const wbSeed = WB.seedInitialEntities(n.initialWorldElements),
          wbTime = WB.randomizeWorldTime({
        day: 1,
        month: 1,
        year: 1
      }, n.setting),
          seededKb = {
        npcs: wbSeed.npcs,
        items: wbSeed.items,
        locations: wbSeed.locations,
        companions: [],
        inventory: [],
        playerSkills: [],
        relationships: [],
        playerStatus: [],
        quests: [],
        hiddenTags: [],
        factions: [],
        factionRelationships: [],
        worldTime: wbTime
      };
      M(seededKb),
          ce([]),
          he([]),
          Ce.current = [],
          Te([]),
          ve.current = [],
          be([]),
          xe(buildCanonicalWorldState(seededKb, n, [], [], 0)),
          de({
        lastPlayerAction: "",
        lastAiResponse: ""
      }),
          Ne({
        sceneId: crypto.randomUUID(),
        summary: "",
        objective: ""
      });
      // Đồ thị tri thức + bộ nhớ truy hồi
      for (const wbEl of wbSeed.npcs) Se.current.addOrUpdateNode(wbEl.Name, "NPC", {
        description: wbEl.Description,
        personality: wbEl.Personality || null
      }),
          await Re.current.addMemory(`Thực thể khởi đầu (NPC): ${wbEl.Name} — ${wbEl.Description}${wbEl.Personality?` — Tính cách: ${wbEl.Personality}`:""}`);
      for (const wbEl of wbSeed.items) Se.current.addOrUpdateNode(wbEl.Name, "ITEM", {
        description: wbEl.Description
      }),
          await Re.current.addMemory(`Thực thể khởi đầu (Vật phẩm): ${wbEl.Name} — ${wbEl.Description}`);
      for (const wbEl of wbSeed.locations) Se.current.addOrUpdateNode(wbEl.Name, "LOCATION", {
        description: wbEl.Description
      }),
          await Re.current.addMemory(`Thực thể khởi đầu (Địa điểm): ${wbEl.Name} — ${wbEl.Description}`);
      // Fact chuẩn từ thực thể người chơi tự tạo (ý đồ người chơi = sự thật chuẩn)
      if (wbSeed.facts.length > 0) {
        const wbFacts = applyCanonicalEventsToFacts([], wbSeed.facts, 0, "initial-seed", []);
        ve.current = wbFacts,
            be(wbFacts),
            xe(buildCanonicalWorldState(seededKb, n, [], wbFacts, 0))
      }
      // === AI 0 — WORLD DIRECTOR (3 giai đoạn tuần tự): CHỈ LÀ GỢI Ý, lỗi không crash ===
      let wb = null;
      try {
        wb = await WB.callAI0WorldDirector({
          gameSettings: n,
          worldTime: seededKb.worldTime,
          worldKnowledge: oe,
          onProgress: wbPhase => {
            wbPhase && console.log("[AI 0]", wbPhase)
          }
        })
      } catch (wbErr) {
        console.warn("AI 0 (World Director) lỗi — chơi tiếp với ngữ cảnh rỗng:", wbErr)
      }
      wb && wb.suggestedYear && seededKb.worldTime.year <= 1 && (seededKb.worldTime = WB.applySuggestedYear(seededKb.worldTime, wb.suggestedYear),
          M(e => ({
        ...e,
        worldTime: seededKb.worldTime
      })),
          xe(buildCanonicalWorldState(seededKb, n, [], ve.current, 0)));
      WbRef.current = wb;
      const wbDigest = wb && wb.contextBlock ? `\n        ---BẢN ĐỒ THẾ GIỚI (AI 0 - GỢI Ý THAM KHẢO, KHÔNG PHẢI SỰ THẬT CHUẨN)---\n        ${WB.buildWorldContextForConsumer("writer", wb)}\n        ---HẾT BẢN ĐỒ THẾ GIỚI---\n` : "";
      const e = buildInitialGamePrompt({
        initialPrompt: buildInitialPrompt(n),
        wbDigest,
        preferredInitialSkill: n.preferredInitialSkill,
        initialWorldElements: n.initialWorldElements,
        systemRules: buildSystemRulesPrompt(n)
      });
      t("gameplay");
      // === WORLD-BUILDER: VIỆC CHẠY NỀN — điền hồ sơ NPC + nhân vật chính ===
      // Không block game; CHỈ điền chỗ trống, không ghi đè dữ liệu người chơi đã nhập.
      async function wbStartBackgroundFills() {
        try {
          const wbPlayerData = await WB.fillProfile(WB.buildPlayerFillPrompt(n, seededKb.playerSkills, WbRef.current));
          if (wbPlayerData) {
            if (Array.isArray(wbPlayerData.initialSkills) && wbPlayerData.initialSkills.length > 0) M(kb => {
              if ((kb.playerSkills || []).length > 0) return kb;
              const t = JSON.parse(JSON.stringify(kb));
              wbPlayerData.initialSkills.slice(0, 3).forEach(s => {
                s && s.Name && t.playerSkills.push({
                  id: crypto.randomUUID(),
                  Name: s.Name,
                  name: s.Name,
                  Description: s.Description || "",
                  description: s.Description || "",
                  Type: "Thiên Phú"
                })
              });
              return t
            });
            wbPlayerData.characterGoal && n.useCharacterGoal && !n.characterGoal && a(e => ({
              ...e,
              characterGoal: wbPlayerData.characterGoal
            }))
          }
        } catch (wbErr) {
          console.warn("Fill nền NV chính lỗi:", wbErr)
        }
        const wbNpcs = (seededKb.npcs || []).filter(x => x && x.Name);
        for (const wbNpc of wbNpcs) {
          try {
            const wbData = await WB.fillProfile(WB.buildNpcLorePrompt(wbNpc, n, WbRef.current));
            if (!wbData) continue;
            M(kb => {
              const t = JSON.parse(JSON.stringify(kb));
              const idx = (t.npcs || []).findIndex(x => (x.Name || "").toLowerCase() === wbNpc.Name.toLowerCase());
              if (idx < 0) return t;
              const r = t.npcs[idx];
              const put = (k, v) => {
                if (v && !r[k]) r[k] = v
              };
              put("Description", wbData.Description),
                  put("TrueEgo", wbData.TrueEgo),
                  put("Persona", wbData.Persona),
                  put("StateOfMind", wbData.StateOfMind),
                  put("Boundaries", wbData.Boundaries),
                  put("CoreDesire", wbData.CoreDesire),
                  put("CoreFear", wbData.CoreFear),
                  put("SpeakingStyle", wbData.SpeakingStyle),
                  put("TypicalSchedule", wbData.TypicalSchedule),
                  put("Goal", wbData.Goal),
                  put("Beliefs", wbData.Beliefs),
                  put("Age", wbData.Age);
              if (wbData.Plan && (!r.plan || 0 === r.plan.length)) {
                const planStr = Array.isArray(wbData.Plan) ? wbData.Plan.join(";") : String(wbData.Plan);
                r.plan = planStr.split(";").map(x => x.trim()).filter(Boolean)
              }
              if (Array.isArray(wbData.Skills) && wbData.Skills.length > 0 && (!r.skills || 0 === r.skills.length)) r.skills = wbData.Skills.map(x => "string" == typeof x ? x : x && x.Name).filter(Boolean).slice(0, 3);
              return t
            });
            await new Promise(r => setTimeout(r, 400))
          } catch (wbErr) {
            console.warn(`Fill nền NPC ${wbNpc.Name} lỗi:`, wbErr)
          }
        }
        console.log("✅ Việc chạy nền (điền NPC/NV chính) hoàn tất.")
      }
      const wbRunOpening = async(wbResp, i = null) => {
        if (!wbResp) return t("setup"),
            void g(!1);
        let c = wbResp,
            l = !1;
        const s = [],
            h = ve.current,
            m = {
          chunks: [],
          facts: [],
          candidates: [],
          trace:{
            recordsSearched: 0
          }
        },
            u = async e => {
          const t = extractCanonicalEventsBlock(e),
              a = extractMemoryAnchorsBlock(e),
              i = validateCanonicalEventsAgainstFacts(h, t.events, e);
          t.found && t.valid || i.push({
            eventIndex: - 1,
            reason: "Phần mở đầu thiếu khối CANONICAL_EVENTS_JSON hợp lệ."
          }),
              a.found && a.valid || i.push({
            eventIndex: - 1,
            reason: "Phần mở đầu thiếu khối MEMORY_ANCHORS_JSON hợp lệ."
          });
          const r = await Je({
            rawText: e,
            actionText: "Bắt đầu game; đối chiếu phần mở đầu với cài đặt ban đầu.",
            recallResult: m,
            ledger: s,
            facts: h,
            knowledgeBaseSnapshot: seededKb,
            gameSettingsSnapshot: n,
            worldKnowledgeSnapshot: oe,
            isInitialCall: !0
          });
          return {
            passed: 0 === i.length && r.passed,
            conflicts: i,
            audit: r
          }
        };
        let d = await u(c);
        if (!d.passed) {
          const t = summarizeMemoryGateFailure(d.conflicts, d.audit.report,
                d.audit.evidenceProblems),
              n = await qe(buildOpeningRewritePrompt({ basePrompt: e, failureSummary: t.join(" | ") }),
                !0, !0);
          n && (c = n, l = !0, d = await u(c))
        }
        if (!d.passed) {
          const e = summarizeMemoryGateFailure(d.conflicts, d.audit.report,
                d.audit.evidenceProblems);
          return v([]),
              x(null),
              t("setup"),
              g(!1),
              void H({
            show: !0,
            title: "Phần mở đầu chưa vượt qua kiểm chứng",
            type: "warning",
            content: "Cổng kiểm chứng trí nhớ đã từ chối xuất bản phần mở đầu vì chưa xác minh được tính nhất quán. Phần mở đầu này không được ghi vào Story Ledger. Hãy thử tạo game lại.\n\n" + e.join("\n")
          })
        }
        l && v(e => {
          const t = [...e];
          return "model" === t[t.length - 1]?.role && (t[t.length - 1] = {
            ...t[t.length - 1],
            parts: [{
                text: c
              }]
          }),
                t
        });
        const {
          story: p,
          analysis: y,
          canonicalEvents: T = [],
          memoryAnchors: C = []
        } = await je(c),
            f = {
          type: "story",
          content: p,
          id: crypto.randomUUID(),
          analysis: y
        };
        r(e => [...e,
          f]),
            await He({
          actionType: "initial",
          playerAction: "Bắt đầu game",
          narrative: p,
          rawAiResponse: c,
          analysis: y,
          canonicalEvents: T,
          memoryAnchors: C,
          systemEvents: extractStructuredSystemEvents(c),
          validationWarnings: [],
          memoryVerification:{
            ...d.audit,
            status: "passed",
            checkedCategories: d.audit.report.checkedCategories,
            summary: d.audit.report.summary
          }
        }, i),
            de({
          lastPlayerAction: "Bắt đầu game",
          lastAiResponse: p.slice(- 1500)
        }),
            Ne(e => ({
          ...e,
          summary: `Cảnh bắt đầu: ${p.slice(0,1500)}`
        })),
            setTimeout(() => {
          wbStartBackgroundFills().catch(e => console.warn("Việc chạy nền lỗi:", e))
        }, 1200)
      };
      if (p && y) try {
        const i = await fbCreateGame(p,
              {
          settings: n,
          storyHistory: [],
          currentStory: "Đang khởi tạo...",
          chatHistoryForGemini: [],
          activityLog: [],
          worldKnowledge: [],
          knowledgeBase: {
            npcs: seededKb.npcs,
            items: seededKb.items,
            locations: seededKb.locations,
            companions: [],
            inventory: [],
            playerSkills: [],
            relationships: [],
            playerStatus: [],
            quests: []
          },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          status: "active"
        });
        x(i.id);
        const r = await qe(e, !0);
        await wbRunOpening(r, i.id)
      } catch (e) {
        H({
          show: !0,
          title: "Lỗi Tạo Game",
          content: `Không thể tạo game mới: ${e.message}`,
          type: "error"
        }),
            t("setup")
      } else {
        const t = await qe(e, !0);
        await wbRunOpening(t, null)
      }
    },
    isLoading: m,
    handleFetchSuggestions: Ue,
    isFetchingSuggestions: O,
    handleGenerateBackstory: _e,
    isGeneratingContent: V,
    handleGenerateDifficultyDescription: Me,
    isGeneratingDifficultyDesc: j,
    addInitialWorldElement: () => a(e => ({
      ...e,
      initialWorldElements: [...e.initialWorldElements,
        {
          id: crypto.randomUUID(),
          type: "NPC",
          name: "",
          description: "",
          personality: ""
        }]
    })),
    removeInitialWorldElement: e => a(t => ({
      ...t,
      initialWorldElements: t.initialWorldElements.filter(t => t.id !== e)
    })),
    handleInitialElementChange: (e, t) => {
      const {
        name: n,
        value: i
      } = t.target;
      a(t => {
        const a = [...t.initialWorldElements];
        return a[e] = {
          ...a[e],
          [n]: i
        },
              {
          ...t,
          initialWorldElements: a
        }
      })
    },
    handleGenerateInitialElementDescription: async e => {
      const t = n.initialWorldElements[e];
      if (!t || !t.name) return void H({
        show: !0,
        title: "Thiếu Tên",
        content: "Vui lòng nhập tên thực thể trước khi tạo mô tả.",
        type: "info"
      });
      Q(e => ({
        ...e,
        [t.id]: !0
      }));
      const {
        theme: i,
        setting: r
      } = n,
          l = buildWorldElementPrompt({ theme: i, setting: r, entity: t }),
          s = await Pe(l);
      s && a(t => {
        const n = [...t.initialWorldElements];
        return n[e] = {
          ...n[e],
          description: s
        },
              {
          ...t,
          initialWorldElements: n
        }
      }),
          Q(e => ({
        ...e,
        [t.id]: !1
      }))
    },
    isGeneratingInitialElementDesc: Y,
    handleGenerateGoal: Ge,
    isGeneratingGoal: W,
    handleGenerateCharacterName: De,
    isGeneratingCharacterName: X,
    handleGenerateInitialSkill: Oe,
    isGeneratingInitialSkill: Z
  }),
    "gameplay" === e && React.createElement(GameplayScreen,
      {
    goHome: at,
    gameSettings: n,
    restartGame: () => {
      P({
        show: !0,
        title: "Bắt Đầu Lại?",
        content: "Lưu tiến trình hiện tại trước khi bắt đầu lại?",
        onConfirm: async() => {
          E && await et(),
                nt()
        },
        onCancel: () => nt(),
        confirmText: "Lưu và Bắt đầu lại",
        cancelText: "Bắt đầu lại (Không lưu)"
      })
    },
    storyHistory: i,
    isLoading: m,
    currentStory: c,
    formatStoryText: it,
    customActionInput: L,
    setCustomActionInput: U,
    handleCustomAction: Ze,
    knowledgeBase: _,
    setShowCharacterInfoModal: D,
    isSaving: u,
    setShowActivityLogModal: se,
    setShowWorldKnowledgeModal: ge,
    handleSaveGameToFile: () => {
      if (0 === i.length) return void H({
        show: !0,
        title: "Không Thể Lưu",
        content: "Không có gì để lưu. Hãy bắt đầu cuộc phiêu lưu trước.",
        type: "info"
      });
      const e = i;
      let t = b;
      if (b.length > 8001) {
        t = [b[0],
          ...b.slice(- 8000)]
      }
      const a = {
        settings: n,
        storyHistory: e,
        canonicalMemorySchemaVersion: 2,
        canonicalStoryLedger: Ce.current,
        canonicalFacts: ve.current,
        canonicalWorldState: buildCanonicalWorldState(_, n, oe, ve.current,
              Ce.current.length),
        workingMemory: ue,
        episodicMemory: pe,
        currentStory: c,
        chatHistoryForGemini: t,
        knowledgeBase: _,
        activityLog: re,
        worldKnowledge: oe,
        savedAt: (new Date).toISOString(),
        version: "4.0.0-canonical-memory-ledger"
      },
          r = JSON.stringify(a, null, 2),
          l = new Blob([r], {
        type: "application/json"
      }),
          o = URL.createObjectURL(l),
          h = document.createElement("a");
      h.href = o;
      const m = `${(n.theme||"phieu-luu").replace(/[^a-z0-9]/gi,"_")}_${(new Date).toISOString().slice(0,10)}.json`;
      h.download = m,
          document.body.appendChild(h),
          h.click(),
          document.body.removeChild(h),
          URL.revokeObjectURL(o),
          H({
        show: !0,
        title: "Đã Lưu",
        content: `Game đã được lưu vào tệp "${m}".`,
        type: "success"
      })
    },
    handleDeleteKnowledgeItem: $e
  }),
    I && React.createElement(LoadGameModal,
      {
    savedGames: S,
    loadGame: tt,
    setShowLoadGameModal: k,
    setConfirmationModal: P,
    userId: p,
    setModalMessage: H
  }),
    G && React.createElement(CharacterInfoModal,
      {
    knowledge: _,
    show: G,
    onClose: () => D(!1),
    gameSettings: n,
    characterName: n.characterName,
    onDeleteItem: $e,
    onAddItem: (e, t) => {
      if (!e || !t) return;
      const a = {
        ...t,
        id: crypto.randomUUID()
      };
      M(t => {
        const n = t[e] || [];
        return {
          ...t,
          [e]: [...n,
            a]
        }
      });
      const i = a.Name || a.name || a.NPC;
      i && Se.current && ("npcs" === e ? Se.current.addOrUpdateNode(i, "NPC",
              {
        personality: a.Personality,
        origin: a.Origin,
        appearance: a.Appearance,
        description: a.Description,
        goal: a.Goal,
        lifeStatus: a.lifeStatus
      }): "inventory" === e ?(Se.current.addOrUpdateNode(i, "INVENTORY_ITEM",
                {
        description: a.Description
      }), Se.current.addOrUpdateEdge(n.characterName, i, "SỞ HỮU")): "items" === e ? Se.current.addOrUpdateNode(i,
              "ITEM", {
        description: a.Description
      }): "locations" === e ? Se.current.addOrUpdateNode(i, "LOCATION",
              {
        description: a.Description
      }): "playerSkills" === e && (Se.current.addOrUpdateNode(i, "SKILL",
                {
        description: a.Description,
        type: a.Type
      }), Se.current.addOrUpdateEdge(n.characterName, i, "ĐÃ HỌC CÔNG PHÁP")));
      let r = `(Hệ thống): Chủ quản thế giới đã ban cho ngươi một vật phẩm/kỹ năng/trạng thái mới: [${i||"vô danh"}].`;
      "npcs" === e && (r = `(Hệ thống): Một thực thể mới tên là [${i||"vô danh"}] vừa được Chủ quản thế giới giáng xuống.`),
          Fe(r),
          H({
        show: !0,
        title: "Thao Tác Thành Công",
        content: `Đã thêm dữ liệu mới vào mục [${e}]. AI sẽ nhận biết ngay sự tồn tại của nó ở lượt tiếp theo.`,
        type: "success"
      })
    },
    onUpdateItem: Be,
    onAutoUpdateNpc: Ke
  }),
    te && React.createElement(QuickLoreModal,
      {
    loreItem: ae,
    show: te,
    onClose: () => ne(!1)
  }),
    le && React.createElement(ActivityLogModal,
      {
    show: le,
    onClose: () => se(!1),
    activityLog: re,
    deleteEntry: e => {
      ce(t => t.filter(t => t.id !== e))
    }
  }),
    me && React.createElement(WorldKnowledgeModal,
      {
    show: me,
    onClose: () => ge(!1),
    worldKnowledge: oe,
    addRule: () => {
      const e = {
        id: crypto.randomUUID(),
        type: "FACT",
        subject: "",
        verb: "",
        object: "",
        condition: "",
        effect: "",
        enabled: !0
      };
      he(t => [...t,
        e])
    },
    updateRule: (e, t, n) => {
      he(a => a.map(a => a.id === e ?{
        ...a,
        [t]: n
      }: a))
    },
    toggleRule: e => {
      he(t => t.map(t => t.id === e ?{
        ...t,
        enabled: !t.enabled
      }: t))
    },
    deleteRule: e => {
      he(t => t.filter(t => t.id !== e))
    },
    exportRules: () => {
      if (0 === oe.length) return void H({
        show: !0,
        title: "Không có gì để xuất",
        content: "Hãy tạo ít nhất một luật lệ trước khi xuất.",
        type: "info"
      });
      const e = JSON.stringify(oe, null, 2),
          t = new Blob([e], {
        type: "application/json"
      }),
          n = URL.createObjectURL(t),
          a = document.createElement("a");
      a.href = n;
      const i = `world_knowledge_${(new Date).toISOString().slice(0,10)}.json`;
      a.download = i,
          document.body.appendChild(a),
          a.click(),
          document.body.removeChild(a),
          URL.revokeObjectURL(n),
          H({
        show: !0,
        title: "Đã Xuất",
        content: `Tri Thức Thế Giới đã được lưu vào tệp "${i}".`,
        type: "success"
      })
    },
    importRules: e => {
      const t = e.target.files[0];
      if (!t) return;
      const n = new FileReader;
      n.onload = async n => {
        try {
          const e = String(n.target.result || ""),
              a = JSON.parse(e);
          if (!Array.isArray(a)) throw new Error("Tệp JSON không chứa một mảng các luật lệ.");
          if (a.length > 0 && (void 0 === a[0].type || void 0 === a[0].enabled)) throw new Error("Dữ liệu trong tệp không đúng định dạng của Tri Thức Thế Giới.");
          he(a),
              H({
            show: !0,
            title: "Nhập Thành Công",
            content: `Đã tải thành công ${a.length} luật lệ từ tệp "${t.name}".`,
            type: "success"
          })
        } catch (e) {
          console.error("Error loading world knowledge from file:", e),
              H({
            show: !0,
            title: "Lỗi Nhập Tệp",
            content: `Không thể tải luật lệ: ${e.message}`,
            type: "error"
          })
        } finally {
          e.target.value = null
        }
      },
          n.onerror = () => H({
        show: !0,
        title: "Lỗi Đọc Tệp",
        content: "Không thể đọc tệp đã chọn.",
        type: "error"
      }),
          n.readAsText(t)
    }
  }),
    React.createElement(SuggestionsModal,
      {
    show: B.show,
    title: B.title || "✨ Gợi Ý",
    suggestions: B.suggestions,
    isLoading: B.isLoading,
    onSelect: e => {
      B.fieldType && a(t => ({
        ...t,
        [B.fieldType]: e
      }))
    },
    onClose: () => K({
      show: !1,
      fieldType: null,
      suggestions: [],
      isLoading: !1,
      title: ""
    })
  }),
    React.createElement(MessageModal,
      {
    show: A.show,
    title: A.title,
    content: A.content,
    type: A.type,
    onClose: () => H({
      show: !1,
      title: "",
      content: "",
      type: "info"
    })
  }),
    React.createElement(ConfirmationModal,
      {
    show: w.show,
    title: w.title,
    content: w.content,
    onConfirm: w.onConfirm,
    onCancel: w.onCancel,
    confirmText: w.confirmText,
    cancelText: w.cancelText,
    setConfirmationModal: P
  })): React.createElement("div",
    {
    className: "min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4"
  },
    React.createElement("div", {
    className: "text-2xl animate-pulse"
  }, "Đang tải và xác thực..."))
};
ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App, null));