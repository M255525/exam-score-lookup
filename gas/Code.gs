/**
 * 課程成績查詢 API（獨立 Apps Script Web App，以老師身分讀取私人試算表）
 * 只回傳「學號＋姓名」都相符的列，且只回傳白名單欄位（時間戳記、系所、學號、姓名、分數）；
 * 不回傳作答內容與電子郵件。
 *
 * 新增考試：在 EXAMS 加一行即可（Google 表單回覆試算表，需有 時間戳記／分數／系所／學號／姓名 欄位）。
 */
var EXAMS = [
  { name: '期中測驗', sheetId: '1F-k8yRFmG614stE9zystmCSj3YIici3828PG5s4lUNc', tab: '表單回覆 1' }
];

// 回傳欄位：[輸出鍵, 試算表標頭]
var FIELDS = [
  ['time', '時間戳記'],
  ['score', '分數'],
  ['dept', '系所'],
  ['sid', '學號'],
  ['name', '姓名']
];

var CACHE_SECONDS = 300; // 老師改試算表最多 5 分鐘後生效

function doGet(e) {
  var p = (e && e.parameter) || {};
  var out;
  try {
    out = p.action === 'ping' ? { ok: true, exams: EXAMS.map(function (x) { return x.name; }) }
      : lookup_(p.sid, p.name);
  } catch (err) {
    out = { ok: false, error: '查詢失敗：' + err.message };
  }
  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

function toHalf_(s) {
  return String(s == null ? '' : s)
    .replace(/[！-～]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })
    .replace(/　/g, ' ');
}

function normalizeSid_(s) {
  return toHalf_(s).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

function normalizeName_(s) {
  return toHalf_(s).replace(/\s+/g, '');
}

function cellText_(v, tz) {
  if (v instanceof Date) return Utilities.formatDate(v, tz, 'yyyy/MM/dd HH:mm:ss');
  return String(v == null ? '' : v).trim();
}

// 「96 / 100」→ {got: 96, full: 100}；純數字也可
function parseScore_(s) {
  var m = String(s).match(/(-?\d+(?:\.\d+)?)\s*(?:\/\s*(\d+(?:\.\d+)?))?/);
  if (!m) return { got: null, full: null };
  return { got: parseFloat(m[1]), full: m[2] ? parseFloat(m[2]) : null };
}

// 讀一份考試的回覆，精簡成 [學號正規化, 姓名正規化, 時間, 分數, 系所, 學號, 姓名]，快取 5 分鐘
function loadExam_(exam, idx) {
  var cache = CacheService.getScriptCache();
  var key = 'exam' + idx + '_' + exam.sheetId.slice(0, 10);
  var hit = cache.get(key);
  if (hit) return JSON.parse(hit);

  var ss = SpreadsheetApp.openById(exam.sheetId);
  var sh = ss.getSheetByName(exam.tab) || ss.getSheets()[0];
  var values = sh.getDataRange().getValues();
  if (!values.length) return [];
  var header = values[0].map(function (h) { return String(h).trim(); });
  var cols = FIELDS.map(function (f) { return header.indexOf(f[1]); });
  var sidCol = cols[3], nameCol = cols[4];
  if (sidCol < 0 || nameCol < 0) throw new Error('「' + exam.name + '」表頭找不到學號或姓名欄位');
  var tz = ss.getSpreadsheetTimeZone();

  var rows = [];
  for (var r = 1; r < values.length; r++) {
    var sid = normalizeSid_(values[r][sidCol]);
    if (!sid) continue;
    rows.push([sid, normalizeName_(values[r][nameCol])].concat(
      cols.map(function (c) { return c < 0 ? '' : cellText_(values[r][c], tz); })));
  }
  var json = JSON.stringify(rows);
  if (json.length < 95000) cache.put(key, json, CACHE_SECONDS); // CacheService 單筆上限 100KB
  return rows;
}

function lookup_(rawSid, rawName) {
  var sid = normalizeSid_(rawSid);
  var name = normalizeName_(rawName);
  if (!/^[A-Z0-9]{6,12}$/.test(sid)) return { ok: false, error: '請輸入正確的學號（6～12 碼英數字）' };
  if (!name) return { ok: false, error: '請輸入姓名' };

  var records = [];
  EXAMS.forEach(function (exam, i) {
    loadExam_(exam, i).forEach(function (row) {
      if (row[0] !== sid || row[1] !== name) return;
      var rec = { exam: exam.name };
      FIELDS.forEach(function (f, j) { rec[f[0]] = row[j + 2]; });
      var sc = parseScore_(rec.score);
      rec.got = sc.got;
      rec.full = sc.full;
      records.push(rec);
    });
  });
  // 依考試順序，再依時間先後
  records.sort(function (a, b) {
    var ea = EXAMS.map(function (x) { return x.name; });
    return (ea.indexOf(a.exam) - ea.indexOf(b.exam)) || a.time.localeCompare(b.time);
  });

  // 每場考試的最高分
  var best = {};
  records.forEach(function (r) {
    if (r.got == null) return;
    if (!best[r.exam] || r.got > best[r.exam].got) best[r.exam] = { got: r.got, full: r.full, time: r.time };
  });

  // 學號或姓名任一不符都回同樣的「查無資料」，不透露是哪一個不符
  return { ok: true, count: records.length, records: records, best: best };
}

// 在 Apps Script 編輯器執行一次以完成授權；結果看執行紀錄
function testLookup() {
  Logger.log(JSON.stringify(lookup_('412130308', '吳婕妤')));
}
