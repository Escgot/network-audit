import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import {
  Upload, Search, Check, Copy, Clock, ArrowUpDown, ArrowRightLeft,
  Users, History, Send, UserMinus, Star, UserCheck, Link as LinkIcon, Unlink, FileJson, Calendar, Activity,
  ChevronRight, ShieldCheck, BarChart3, Zap, X, ExternalLink, FileSpreadsheet
} from 'lucide-react';
import AppLogo from './assets/logo.png';
import { getGender } from 'gender-detection-from-name';

// --- GENDER DETECTION HELPER ---
// Multi-strategy gender detection from Instagram usernames.
// 1. Blacklists common English words that are false-positive name matches
// 2. Transliterates Arabic chat-speak numerals (3mr→amr, 7md→hmd, etc.)
// 3. Strips common prefixes (eng, dr, mr, mrs, prof, etc.)
// 4. Tries sliding-window substring matching for fused names (ahmedali → ahmed)
// 5. Handles camelCase and mixed-case splits

const BLACKLIST = new Set([
  // Common English words the library wrongly classifies as names
  'just','love','art','beauty','life','real','free','king','queen',
  'hope','joy','faith','dawn','star','storm','chance','hunter','scout',
  'phoenix','cash','ash','eden','winter','summer','autumn','river','ocean',
  'sky','rain','fern','holly','ivy','rose','ruby','jade','amber','pearl',
  'violet','iris','lily','daisy','wolf','soul','dark','cool','soul',
  'miss','style','design','travel','photo','deep','live','official',
  'best','good','bad','big','old','new','hot','ice','fire','pure',
  'true','wild','bold','soft','slim','fast','slow','rich','poor',
  'gold','silver','blue','red','pink','black','white','green',
  'sweet','bitter','magic','dream','fancy','royal','prime','epic',
  'legend','myth','hero','power','boss','chief','captain','major',
  'general','master','lord','duke','prince','princess','knight','baron',
  'count','angel','devil','demon','ghost','spirit','shadow','phantom',
  'blade','steel','iron','stone','crystal','diamond','velvet','silk',
  'eagle','falcon','hawk','raven','dove','fox','bear','tiger','lion',
  'cobra','viper','dragon','shark','panther','puma','lynx','mink',
  'nano','mini','mega','ultra','super','hyper','meta','pro','elite',
  'alpha','beta','sigma','omega','delta','gamma','zen','ace',
  'club','band','crew','gang','squad','team','studio','lab','hub',
  'vibe','mood','aura','karma','yoga','guru','ninja','samurai',
  'pixel','code','data','tech','web','net','dev','hack','byte',
  'page','post','feed','snap','click','buzz','flash','spark','glow',
  'urban','metro','city','town','hood','block','lane','road','path',
  'ram', 'boy', 'girl', 'man', 'woman', 'zy', 'kie'
]);

// Arabic chat-speak numeral transliterations
const ARAB_CHAT_MAP = {
  '2': 'a', // hamza
  '3': 'a', // ain → approximate with 'a' for matching
  '5': 'kh',
  '6': 't',  // taa
  '7': 'h',  // haa
  '8': 'q',  // qaf
  '9': 's',  // saad
};

// Common Arabic abbreviations that the dictionary misses
const ALIAS_MAP = {
  'ahmd': 'ahmed',
  'mhd': 'mohamed',
  'mohd': 'mohamed',
  'abd': 'abdul',
  'hany': 'hani',
  'ramy': 'rami',
  'nona': 'noura',
  'noname': 'unknown', // Library wrongly thinks this is a male name
  'zynb': 'zaynab',
  'mahaa': 'maha',
  'keenza': 'kenza',
  'linaa': 'lina',
  'tsnym': 'tasnym',
  'ranyym': 'ranim',
  'fyrouz': 'fairouz',
  'haadyl': 'hadil',
  'hedire': 'hadir',
  'eaa': 'eya',
  'fat': 'fatima',
  'huuuuur': 'zouhur',
  'syrynee': 'sirine',
  'syryne': 'sirine',
  'lma': 'salma',
  'yasmiiine': 'yasmine',
  'eyaaa': 'eya',
  'rahmaa': 'rahma',
  'ghozleene': 'ghozlene',
  'halloumaaaaa': 'halima',
  'hallouma': 'halima',
  'ghzlen': 'ghozlene',
  'saraa': 'sara',
  'zayneeb': 'zayneb',
  'sind': 'sinda',
  'hadyyl': 'hadil',
  'hadyl': 'hadil',
  'yessmin': 'yassmine'
};

// Names that the dictionary misses or wrongly classifies as male
const FEMALE_OVERRIDE = new Set([
  'abir', 'samar', 'hale', 'qmar', 'erije', 'maram', 'chaima', 'nadine',
  'ishrak', 'kenza', 'julea', 'tasnym', 'ranim', 'ghaya', 'fairouz',
  'hadil', 'chadha', 'hadir', 'nagham', 'raghed', 'eya', 'fatima',
  'zouhur', 'wejden', 'rafa', 'ghalya', 'sirine', 'salma', 'yasmine',
  'yoldez', 'balsem', 'asouma', 'asma', 'nadou', 'nada', 'montaha', 'achwek',
  'ghozlene', 'halima', 'lin', 'anwar', 'jawaher', 'jaweher', 'shadha',
  'loujain', 'loudjein', 'giuli', 'zayneb', 'sinda', 'wyssal', 'yassmine'
]);

// Common username prefixes to strip
const PREFIX_RE = /^(eng|dr|mr|mrs|ms|prof|doc|the|its|iam|im|am|iamm|itz|xo|xx|x|o)\s+/i;
const SUFFIX_RE = /\s+(official|offcl|real|original|hd|tv|eg|sa|ae|kw|bh|jo|lb|iq|ps|sy|ye|ly|tn|dz|ma|sd|so|mr|om|qa)$/i;

function lookupGender(token) {
  if (!token || token.length < 2 || BLACKLIST.has(token)) return null;
  if (FEMALE_OVERRIDE.has(token)) return 'female';
  const result = getGender(token);
  return (result === 'male' || result === 'female') ? result : null;
}

function detectGender(username) {
  if (!username) return 'unknown';

  // Phase 0: Transliterate Arabic chat-speak numerals
  let cleaned = username.toLowerCase();
  cleaned = cleaned.replace(/[2-9]/g, ch => ARAB_CHAT_MAP[ch] || ' ');

  // Phase 1: Tokenize on delimiters (_, ., remaining digits, camelCase)
  let tokenized = cleaned
    .replace(/[0-9]+/g, ' ')
    .replace(/[._\-]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase split
    .toLowerCase();

  // Strip known prefixes/suffixes
  tokenized = tokenized.replace(PREFIX_RE, ' ').replace(SUFFIX_RE, ' ');

  let tokens = tokenized.split(/\s+/).filter(t => t.length >= 2);
  
  // Apply aliases
  tokens = tokens.map(t => ALIAS_MAP[t] || t);

  let foundMale = false;

  // Phase 2: Direct lookup on each token
  for (const token of tokens) {
    const result = lookupGender(token);
    if (result === 'female') return 'female'; // High priority heuristic
    if (result === 'male') foundMale = true;
  }

  // Phase 3: Sliding-window substring matching on longer tokens
  for (const token of tokens) {
    if (token.length < 6) continue; // only worthwhile for longer tokens

    // Try progressively shorter substrings from the start (greedy)
    for (let len = Math.min(token.length - 1, 12); len >= 3; len--) {
      const prefix = token.substring(0, len);
      const result = lookupGender(prefix);
      if (result === 'female') return 'female';
      if (result === 'male') foundMale = true;
    }

    // Also try from the end
    for (let len = Math.min(token.length - 1, 12); len >= 3; len--) {
      const suffix = token.substring(token.length - len);
      const result = lookupGender(suffix);
      if (result === 'female') return 'female';
      if (result === 'male') foundMale = true;
    }
  }

  return foundMale ? 'male' : 'unknown';
}

// --- VIRTUALIZED LIST ENGINE ---
function VirtualList({ items, itemHeight, renderItem, className, stickyIndices = [] }) {
  const [scrollTop, setScrollTop] = useState(0);
  const [clientHeight, setClientHeight] = useState(600);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setClientHeight(entry.contentRect.height);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - 3);
  const endIndex = Math.min(items.length, Math.ceil((scrollTop + clientHeight) / itemHeight) + 3);

  let activeStickyIndex = -1;
  let nextStickyIndex = -1;
  
  if (stickyIndices.length > 0) {
    const currentIndex = Math.floor(scrollTop / itemHeight);
    for (let i = 0; i < stickyIndices.length; i++) {
      if (stickyIndices[i] <= currentIndex) {
        activeStickyIndex = stickyIndices[i];
      } else {
        nextStickyIndex = stickyIndices[i];
        break;
      }
    }
  }

  let floatingHeaderTop = scrollTop;
  if (nextStickyIndex !== -1) {
    const nextHeaderTop = nextStickyIndex * itemHeight;
    if (nextHeaderTop - scrollTop < itemHeight) {
      floatingHeaderTop = nextHeaderTop - itemHeight;
    }
  }

  const visibleItems = [];
  for (let i = startIndex; i < endIndex; i++) {
    if (i === activeStickyIndex && floatingHeaderTop >= i * itemHeight) continue;
    visibleItems.push(
      <div key={i} style={{ position: 'absolute', top: i * itemHeight, width: '100%', height: itemHeight }}>
        {renderItem(items[i], i)}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={(e) => setScrollTop(e.target.scrollTop)}
      style={{ height: '100%', overflowY: 'auto', position: 'relative' }}
      className={className}
    >
      <div style={{ height: items.length * itemHeight, width: '100%', position: 'relative' }}>
        {activeStickyIndex !== -1 && (
          <div style={{ position: 'absolute', top: floatingHeaderTop, width: '100%', height: itemHeight, zIndex: 10 }}>
            {renderItem(items[activeStickyIndex], activeStickyIndex)}
          </div>
        )}
        {visibleItems}
      </div>
    </div>
  );
}

// ============================================================
// MAIN APP COMPONENT
// ============================================================
export default function App() {
  const [appStarted, setAppStarted] = useState(false);
  const [files, setFiles] = useState({
    currFollowing: [], currFollowers: [],
    oldFollowing: [], oldFollowers: [],
    pending: [], recentRequests: [], recentUnfollowed: [],
    compOldFollowing: [], compNewFollowing: [],
    compOldFollowers: [], compNewFollowers: [],
    compCsvFollowing: [], compCsvFile1: [], compCsvFile2: [], compCsvFile: []
  });

  const [results, setResults] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [userLinks, setUserLinks] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState(null);

  const [activeTab, setActiveTab] = useState('core');
  const [showUploadModal, setShowUploadModal] = useState(true);

  const [sortConfig, setSortConfig] = useState({
    notFollowingBack: { type: 'alpha', dir: 'asc' },
    fans: { type: 'alpha', dir: 'asc' },
    mutuals: { type: 'alpha', dir: 'asc' },
    stillConnected: { type: 'alpha', dir: 'asc' },
    disconnected: { type: 'alpha', dir: 'asc' },
    pending: { type: 'time', dir: 'desc' },
    recentRequests: { type: 'time', dir: 'desc' },
    recentUnfollowed: { type: 'time', dir: 'desc' },
    compCommon: { type: 'alpha', dir: 'asc' },
    compOnlyOld: { type: 'alpha', dir: 'asc' },
    compOnlyNew: { type: 'alpha', dir: 'asc' },
    compFolCommon: { type: 'alpha', dir: 'asc' },
    compFolOnlyOld: { type: 'alpha', dir: 'asc' },
    compFolOnlyNew: { type: 'alpha', dir: 'asc' },
    compCsvOnlyFollowing: { type: 'alpha', dir: 'asc' },
    compCsvOnlyCsv: { type: 'alpha', dir: 'asc' },
    compCsvDiffAll: { type: 'alpha', dir: 'asc' },
    compCsvCommon: { type: 'alpha', dir: 'asc' },
    compCsvAllCsv: { type: 'alpha', dir: 'asc' },
    compCsvAllFollowing: { type: 'alpha', dir: 'asc' }
  });

  const triggerToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const handleSetFile = (id, newFiles) => {
    setFiles(prev => {
      const existing = prev[id] || [];
      return { ...prev, [id]: [...existing, ...newFiles] };
    });
  };

  const cycleSort = (key) => {
    setSortConfig(prev => {
      const current = prev[key];
      let nextType = current.type;
      let nextDir = current.dir;

      if (current.type === 'alpha' && current.dir === 'asc') nextDir = 'desc';
      else if (current.type === 'alpha' && current.dir === 'desc') { nextType = 'time'; nextDir = 'asc'; }
      else if (current.type === 'time' && current.dir === 'asc') nextDir = 'desc';
      else { nextType = 'alpha'; nextDir = 'asc'; }

      return { ...prev, [key]: { type: nextType, dir: nextDir } };
    });
  };

  const parseJsonFile = (data, type) => {
    const tempLinks = { ...userLinks };

    let rawList = [];
    if (Array.isArray(data)) {
      rawList = data;
    } else if (data && typeof data === 'object') {
      if (Array.isArray(data.relationships_following)) {
        rawList = data.relationships_following;
      } else if (Array.isArray(data.following)) {
        rawList = data.following;
      } else if (Array.isArray(data.relationships_followers)) {
        rawList = data.relationships_followers;
      } else if (Array.isArray(data.followers)) {
        rawList = data.followers;
      } else {
        // Collect arrays from all top-level keys if not in standard format
        for (const key of Object.keys(data)) {
          if (Array.isArray(data[key])) {
            rawList = rawList.concat(data[key]);
          }
        }
      }
    }

    const extractInstagramUsername = (item) => {
      if (!item) return { username: null, href: '#' };
      if (typeof item === 'string') {
        const u = item.replace(/^@/, '').trim().toLowerCase();
        return { username: u || null, href: u ? `https://instagram.com/${u}` : '#' };
      }
      if (typeof item !== 'object') return { username: null, href: '#' };

      let username = null;
      let href = null;

      // 1. Check all elements in string_list_data (official Instagram format)
      if (Array.isArray(item.string_list_data)) {
        for (const s of item.string_list_data) {
          if (!s) continue;
          if (s.value && typeof s.value === 'string' && s.value.trim()) {
            username = s.value;
          }
          if (s.href && typeof s.href === 'string' && s.href.trim()) {
            href = s.href;
            if (!username) {
              const m = s.href.match(/instagram\.com\/(?:_u\/)?([a-zA-Z0-9._]+)/i);
              if (m && !['p', 'reel', 'reels', 'stories', 'explore', 'direct', 'tv'].includes(m[1].toLowerCase())) {
                username = m[1];
              }
            }
          }
          if (username) break;
        }
      }

      // 2. Check direct username / value fields
      if (!username && item.username && typeof item.username === 'string' && item.username.trim()) {
        username = item.username;
      }
      if (!username && item.value && typeof item.value === 'string' && item.value.trim()) {
        username = item.value;
      }

      // 3. Check item.href
      if (!username && item.href && typeof item.href === 'string' && item.href.trim()) {
        href = item.href;
        const m = item.href.match(/instagram\.com\/(?:_u\/)?([a-zA-Z0-9._]+)/i);
        if (m && !['p', 'reel', 'reels', 'stories', 'explore', 'direct', 'tv'].includes(m[1].toLowerCase())) {
          username = m[1];
        }
      }

      // 4. Check item.title
      if (!username && item.title && typeof item.title === 'string' && item.title.trim()) {
        const t = item.title.trim();
        if (!/^instagram user$/i.test(t)) {
          username = t;
        }
      }

      if (username) {
        username = String(username).replace(/^@/, '').toLowerCase().trim();
      }

      if (!href) {
        href = username ? `https://instagram.com/${username}` : '#';
      }

      return { username, href };
    };

    const items = rawList.map((item, idx) => {
      const { username, href } = extractInstagramUsername(item);
      if (username) tempLinks[username] = href;
      const gender = detectGender(username);
      return username ? { username, href, fileIndex: idx, gender } : null;
    }).filter(Boolean);

    setUserLinks(prev => ({ ...prev, ...tempLinks }));
    return items;
  };

  const parseCsvText = (text) => {
    if (!text || typeof text !== 'string') return [];
    // Strip UTF-8 BOM
    text = text.replace(/^\uFEFF/, '').trim();
    if (!text) return [];

    // Split lines across Windows (\r\n), Classic Mac (\r), or Unix (\n)
    const rawLines = text.split(/\r\n|\r|\n/).map(l => l.trim()).filter(Boolean);
    if (rawLines.length === 0) return [];

    // Delimiter detection across sample lines
    const sample = rawLines.slice(0, Math.min(10, rawLines.length)).join('\n');
    const countChar = (str, char) => (str.match(new RegExp('\\' + char, 'g')) || []).length;
    const delimiters = [',', ';', '\t', '|'];
    let delimiter = ',';
    let maxCount = -1;
    for (const d of delimiters) {
      const c = countChar(sample, d);
      if (c > maxCount) {
        maxCount = c;
        delimiter = d;
      }
    }
    if (maxCount === 0) delimiter = ',';

    const splitLine = (line) => {
      const cols = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === delimiter && !inQuotes) {
          cols.push(cur.trim());
          cur = '';
        } else {
          cur += char;
        }
      }
      cols.push(cur.trim());
      return cols;
    };

    const rows = rawLines.map(splitLine);
    if (rows.length === 0) return [];

    const cleanVal = (val) => {
      if (!val) return '';
      let s = val.replace(/^["']|["']$/g, '').trim();
      if (s.includes('instagram.com/')) {
        const m = s.match(/instagram\.com\/(?:_u\/)?([a-zA-Z0-9._]+)/i);
        if (m && !['p', 'reel', 'reels', 'stories', 'explore', 'direct', 'tv'].includes(m[1].toLowerCase())) {
          s = m[1];
        }
      }
      s = s.replace(/^@/, '').trim().toLowerCase();
      return s;
    };

    const isUsernameLike = (val) => {
      if (!val) return false;
      const clean = cleanVal(val);
      if (!clean) return false;
      if (/^(username|user|handle|account|instagram|ig|name|profile|id|index|link|url|user_id|userid|full_name|fullname|bio)$/i.test(clean)) return false;
      return /^[a-zA-Z0-9._]{1,35}$/.test(clean);
    };

    // Find best column
    const firstRow = rows[0];
    let targetColIdx = 0;
    let startIndex = 0;

    const headerIdx = firstRow.findIndex(col => {
      const c = col.replace(/^["']|["']$/g, '').trim().toLowerCase();
      return /^(username|user|user_name|user name|handle|account|instagram|ig|profile|account name|ig username)$/i.test(c);
    });

    if (headerIdx !== -1) {
      targetColIdx = headerIdx;
      startIndex = 1;
    } else {
      const partialIdx = firstRow.findIndex(col => {
        const c = col.replace(/^["']|["']$/g, '').trim().toLowerCase();
        return /username|handle|account/i.test(c) && !/id|number|count/i.test(c);
      });
      if (partialIdx !== -1) {
        targetColIdx = partialIdx;
        startIndex = 1;
      } else {
        const numCols = Math.max(...rows.slice(0, 10).map(r => r.length));
        const colScores = new Array(numCols).fill(0);
        for (let r = 0; r < Math.min(10, rows.length); r++) {
          for (let c = 0; c < rows[r].length; c++) {
            if (isUsernameLike(rows[r][c])) colScores[c]++;
          }
        }
        let bestCol = 0;
        let bestScore = -1;
        for (let c = 0; c < colScores.length; c++) {
          if (colScores[c] > bestScore) {
            bestScore = colScores[c];
            bestCol = c;
          }
        }
        targetColIdx = bestCol;
        if (!isUsernameLike(firstRow[targetColIdx])) {
          startIndex = 1;
        }
      }
    }

    const list = [];
    const seen = new Set();

    for (let i = startIndex; i < rows.length; i++) {
      const row = rows[i];
      let val = cleanVal(row[targetColIdx]);
      if (!val || !isUsernameLike(val)) {
        for (let c = 0; c < row.length; c++) {
          if (c !== targetColIdx) {
            const alt = cleanVal(row[c]);
            if (alt && isUsernameLike(alt)) {
              val = alt;
              break;
            }
          }
        }
      }
      if (val && isUsernameLike(val) && !seen.has(val)) {
        seen.add(val);
        list.push(val);
      }
    }

    return list;
  };

  const parseTemporalJsonFile = (data) => {
    return data.map((item, idx) => {
      const listData = item.string_list_data?.[0] || {};
      const username = (listData.value || item.title || item.label_values?.find(l => l.label === 'Username')?.value)?.toLowerCase();

      const unixTime = listData.timestamp || item.timestamp;
      const dateObj = unixTime ? new Date(unixTime * 1000) : null;

      const isoDate = dateObj ? dateObj.toISOString().split('T')[0] : 'Unknown Date';
      const prettyDate = dateObj ? dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Unknown Date';
      const daysAgo = unixTime ? Math.floor((Date.now() / 1000 - unixTime) / 86400) : 0;

      const gender = detectGender(username);
      const searchString = `${username} ${isoDate} ${prettyDate}`.toLowerCase();

      return username ? { username, daysAgo, fileIndex: idx, isoDate, prettyDate, searchString, timestamp: unixTime, gender } : null;
    }).filter(Boolean);
  };

  const handleProcess = async () => {
    if (!Object.values(files).some(fileArray => fileArray && fileArray.length > 0)) {
      return triggerToast('Please upload at least one system file to process.');
    }
    setIsProcessing(true);

    const loadJson = (file) => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(JSON.parse(e.target.result));
      reader.readAsText(file);
    });

    const loadText = (file) => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsText(file);
    });

    const processCsvFiles = async (fileArray) => {
      if (!fileArray || fileArray.length === 0) return null;
      const tempLinks = {};
      let allUsernames = [];
      for (const file of fileArray) {
        const text = await loadText(file);
        const parsedUsernames = parseCsvText(text);
        allUsernames = allUsernames.concat(parsedUsernames);
      }
      const uniqueUsernames = Array.from(new Set(allUsernames));
      const items = uniqueUsernames.map((username, idx) => {
        const href = `https://instagram.com/${username}`;
        tempLinks[username] = href;
        const gender = detectGender(username);
        return { username, href, fileIndex: idx, gender };
      });
      setUserLinks(prev => ({ ...prev, ...tempLinks }));
      return items;
    };

    const processFiles = async (fileArray, type, isTemporal = false) => {
      if (!fileArray || fileArray.length === 0) return null;
      let allItems = [];
      const tempLinks = {};
      for (const file of fileArray) {
        const isCsv = file.name && (file.name.toLowerCase().endsWith('.csv') || file.name.toLowerCase().endsWith('.txt'));
        if (isCsv) {
          const text = await loadText(file);
          const parsedUsernames = parseCsvText(text);
          parsedUsernames.forEach((username, idx) => {
            const href = `https://instagram.com/${username}`;
            tempLinks[username] = href;
            const gender = detectGender(username);
            allItems.push({ username, href, fileIndex: idx, gender });
          });
        } else {
          const data = await loadJson(file);
          const parsed = isTemporal ? parseTemporalJsonFile(data) : parseJsonFile(data, type);
          allItems = allItems.concat(parsed);
        }
      }
      setUserLinks(prev => ({ ...prev, ...tempLinks }));
      const uniqueMap = new Map();
      for (const item of allItems) {
        if (item && item.username && !uniqueMap.has(item.username)) {
          uniqueMap.set(item.username, item);
        }
      }
      return Array.from(uniqueMap.values());
    };

    try {
      const processed = {};
      const outResults = {};

      if (files.currFollowing?.length) processed.currFollowing = await processFiles(files.currFollowing, 'following');
      if (files.currFollowers?.length) processed.currFollowers = await processFiles(files.currFollowers, 'followers');
      if (files.oldFollowing?.length) processed.oldFollowing = await processFiles(files.oldFollowing, 'following');
      if (files.oldFollowers?.length) processed.oldFollowers = await processFiles(files.oldFollowers, 'followers');
      console.log("New Followers Loaded:", processed.currFollowers?.length || 0);

      if (processed.currFollowing && processed.currFollowers) {
        const activeFollowersSet = new Set(processed.currFollowers.map(u => u.username));
        const activeFollowingSet = new Set(processed.currFollowing.map(u => u.username));
        outResults.notFollowingBack = processed.currFollowing.filter(u => !activeFollowersSet.has(u.username));
        outResults.fans = processed.currFollowers.filter(u => !activeFollowingSet.has(u.username));
        outResults.mutuals = processed.currFollowing.filter(u => activeFollowersSet.has(u.username));
      }

      if (processed.oldFollowing || processed.oldFollowers) {
        if (!processed.currFollowing && !processed.currFollowers) {
          triggerToast('Upload current Following & Followers to use the Time Machine.');
        } else {
          const currentActivePool = new Set([
            ...(processed.currFollowing?.map(u => u.username) || []),
            ...(processed.currFollowers?.map(u => u.username) || [])
          ]);

          const combinedOldMap = new Map();
          [...(processed.oldFollowing || []), ...(processed.oldFollowers || [])].forEach(item => {
            if (!combinedOldMap.has(item.username)) combinedOldMap.set(item.username, item);
          });
          const distinctOldItems = Array.from(combinedOldMap.values());

          outResults.stillConnected = distinctOldItems.filter(u => currentActivePool.has(u.username));
          outResults.disconnected = distinctOldItems.filter(u => !currentActivePool.has(u.username));
        }
      }

      if (files.pending?.length) {
        outResults.pending = await processFiles(files.pending, null, true);
      }
      if (files.recentRequests?.length) {
        outResults.recentRequests = await processFiles(files.recentRequests, null, true);
      }
      if (files.recentUnfollowed?.length) {
        outResults.recentUnfollowed = await processFiles(files.recentUnfollowed, null, true);
      }

        const compOldFile = files.compOldFollowing?.length ? files.compOldFollowing : files.oldFollowing;
        const compNewFile = files.compNewFollowing?.length ? files.compNewFollowing : files.currFollowing;
        if (compOldFile?.length && compNewFile?.length) {
          const compOldList = await processFiles(compOldFile, 'following');
          const compNewList = await processFiles(compNewFile, 'following');
          const compOldSet = new Set(compOldList.map(u => u.username));
          const compNewSet = new Set(compNewList.map(u => u.username));
          outResults.compCommon = compNewList.filter(u => compOldSet.has(u.username));
          outResults.compOnlyOld = compOldList.filter(u => !compNewSet.has(u.username));
          outResults.compOnlyNew = compNewList.filter(u => !compOldSet.has(u.username));
        }

        const compOldFolFile = files.compOldFollowers?.length ? files.compOldFollowers : files.oldFollowers;
        const compNewFolFile = files.compNewFollowers?.length ? files.compNewFollowers : files.currFollowers;
        if (compOldFolFile?.length && compNewFolFile?.length) {
          const compOldFolList = await processFiles(compOldFolFile, 'followers');
          const compNewFolList = await processFiles(compNewFolFile, 'followers');
          const compOldFolSet = new Set(compOldFolList.map(u => u.username));
          const compNewFolSet = new Set(compNewFolList.map(u => u.username));
          outResults.compFolCommon = compNewFolList.filter(u => compOldFolSet.has(u.username));
          outResults.compFolOnlyOld = compOldFolList.filter(u => !compNewFolSet.has(u.username));
          outResults.compFolOnlyNew = compNewFolList.filter(u => !compOldFolSet.has(u.username));
        }

        // Following JSON vs Merged CSVs comparison
        const compCsvFollowingFile = files.compCsvFollowing?.length ? files.compCsvFollowing : (files.currFollowing?.length ? files.currFollowing : files.compNewFollowing);
        const allCsvFiles = [
          ...(files.compCsvFile1 || []),
          ...(files.compCsvFile2 || []),
          ...(files.compCsvFile || [])
        ];

        if (allCsvFiles.length > 0) {
          if (!compCsvFollowingFile?.length) {
            triggerToast('Upload a Following JSON file to compare with your CSV files.');
          } else {
            const compFollowingList = await processFiles(compCsvFollowingFile, 'following');
            const compCsvList = await processFiles(allCsvFiles, 'followers');
            if (compFollowingList && compCsvList) {
              // Build index maps from CSV list for symbol-insensitive matching
              const csvExactSet = new Set(compCsvList.map(u => u.username));
              const csvTrimmedMap = new Map();
              const csvNormMap = new Map();

              compCsvList.forEach(item => {
                const u = item.username;
                const trimmed = u.replace(/^[._]+|[._]+$/g, '');
                const norm = u.replace(/[._]/g, '');
                if (trimmed && !csvTrimmedMap.has(trimmed)) csvTrimmedMap.set(trimmed, item);
                if (norm && norm.length >= 3 && !csvNormMap.has(norm)) csvNormMap.set(norm, item);
              });

              // Helper to check if a Following username exists in CSVs
              const matchInCsv = (fUser) => {
                if (csvExactSet.has(fUser)) return { matched: true, matchType: 'exact', target: fUser };
                const trimmed = fUser.replace(/^[._]+|[._]+$/g, '');
                if (trimmed && csvTrimmedMap.has(trimmed)) {
                  return { matched: true, matchType: 'trimmed', target: csvTrimmedMap.get(trimmed).username };
                }
                const norm = fUser.replace(/[._]/g, '');
                if (norm && norm.length >= 3 && csvNormMap.has(norm)) {
                  return { matched: true, matchType: 'norm', target: csvNormMap.get(norm).username };
                }
                return { matched: false };
              };

              // Build index maps from Following list for reverse matching
              const followingExactSet = new Set(compFollowingList.map(u => u.username));
              const followingTrimmedMap = new Map();
              const followingNormMap = new Map();

              compFollowingList.forEach(item => {
                const u = item.username;
                const trimmed = u.replace(/^[._]+|[._]+$/g, '');
                const norm = u.replace(/[._]/g, '');
                if (trimmed && !followingTrimmedMap.has(trimmed)) followingTrimmedMap.set(trimmed, item);
                if (norm && norm.length >= 3 && !followingNormMap.has(norm)) followingNormMap.set(norm, item);
              });

              // Helper to check if a CSV username exists in Following
              const matchInFollowing = (cUser) => {
                if (followingExactSet.has(cUser)) return { matched: true, matchType: 'exact', target: cUser };
                const trimmed = cUser.replace(/^[._]+|[._]+$/g, '');
                if (trimmed && followingTrimmedMap.has(trimmed)) {
                  return { matched: true, matchType: 'trimmed', target: followingTrimmedMap.get(trimmed).username };
                }
                const norm = cUser.replace(/[._]/g, '');
                if (norm && norm.length >= 3 && followingNormMap.has(norm)) {
                  return { matched: true, matchType: 'norm', target: followingNormMap.get(norm).username };
                }
                return { matched: false };
              };

              const onlyFollowing = [];
              const common = [];

              compFollowingList.forEach(item => {
                const match = matchInCsv(item.username);
                if (match.matched) {
                  common.push({
                    ...item,
                    matchedWith: match.matchType !== 'exact' ? match.target : undefined
                  });
                } else {
                  onlyFollowing.push(item);
                }
              });

              const onlyCsv = [];
              compCsvList.forEach(item => {
                const match = matchInFollowing(item.username);
                if (!match.matched) {
                  onlyCsv.push(item);
                }
              });

              outResults.compCsvOnlyFollowing = onlyFollowing;
              outResults.compCsvOnlyCsv = onlyCsv;
              outResults.compCsvDiffAll = [
                ...onlyFollowing,
                ...onlyCsv
              ];
              outResults.compCsvCommon = common;
              outResults.compCsvAllCsv = compCsvList;
              outResults.compCsvAllFollowing = compFollowingList;
            }
          }
        }

        setResults(outResults);

        const hasCore = files.currFollowing?.length > 0 && files.currFollowers?.length > 0;
        const hasHistory = files.oldFollowing?.length > 0 || files.oldFollowers?.length > 0;
        const hasActivity = files.pending?.length > 0 || files.recentRequests?.length > 0 || files.recentUnfollowed?.length > 0;
        const hasComparison = files.compOldFollowing?.length > 0 || files.compNewFollowing?.length > 0;
        const hasFollowersComparison = files.compOldFollowers?.length > 0 || files.compNewFollowers?.length > 0;
        const hasCsvComparison = allCsvFiles.length > 0 && compCsvFollowingFile?.length > 0;

        if (hasCore && !hasHistory && !hasActivity && !hasComparison && !hasFollowersComparison && !hasCsvComparison) setActiveTab('core');
        else if (hasHistory && !hasCore && !hasActivity && !hasComparison && !hasFollowersComparison && !hasCsvComparison) setActiveTab('history');
        else if (hasActivity && !hasCore && !hasHistory && !hasComparison && !hasFollowersComparison && !hasCsvComparison) setActiveTab('activity');
        else if (hasComparison && !hasCore && !hasHistory && !hasActivity && !hasFollowersComparison && !hasCsvComparison) setActiveTab('comparison');
        else if (hasFollowersComparison && !hasCore && !hasHistory && !hasActivity && !hasComparison && !hasCsvComparison) setActiveTab('followersComparison');
        else if (hasCsvComparison) setActiveTab('csvComparison');

      triggerToast('Network matrix updated successfully!');
      setShowUploadModal(false);
    } catch (err) {
      console.error(err);
      triggerToast('Error analyzing files. Verify file integrity.');
    } finally {
      setIsProcessing(false);
    }
  };

  const hasActiveResults = results && Object.keys(results).length > 0;
  const uploadedCount = Object.values(files).filter(f => f && f.length > 0).length;
  const totalFileSlots = Object.values(files).length;

  // ── RENDER ──
  return (
    <div className="h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-emerald-950 animate-gradient text-white font-sans overflow-hidden relative flex flex-col">
      {/* Ambient background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/30 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[35%] h-[35%] bg-emerald-600/20 rounded-full blur-[100px] pointer-events-none mix-blend-screen" />
      <div className="absolute top-[40%] left-[60%] w-[25%] h-[25%] bg-cyan-600/20 rounded-full blur-[90px] pointer-events-none mix-blend-screen" />

      <AnimatePresence mode="wait">
        {!appStarted ? (
          <motion.div key="landing" exit={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }} transition={{ duration: 0.5 }} className="flex-1 flex flex-col">
            <LandingPage onStart={() => setAppStarted(true)} />
          </motion.div>
        ) : (
          <motion.div key="app" className="flex-1 flex flex-col min-h-0 w-full" initial={{ opacity: 0, scale: 1.05, filter: "blur(10px)" }} animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }} transition={{ duration: 0.5, delay: 0.1 }}>

            {/* ── Toast notification ── */}
            <AnimatePresence>
              {toast && (
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                  className="fixed top-5 left-1/2 -translate-x-1/2 bg-emerald-500/20 backdrop-blur-3xl px-6 py-3 rounded-2xl z-[200] flex items-center gap-2 shadow-2xl border border-emerald-500/30 font-medium text-emerald-200 text-sm"
                >
                  <Check size={16} />{toast}
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Header bar ── */}
            <header className="flex items-center justify-between px-6 py-3 flex-shrink-0 relative z-20">
              <div className="flex items-center gap-3">
                <img src={AppLogo} alt="Logo" className="w-10 h-10 drop-shadow-xl select-none pointer-events-none" />
                <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent hidden sm:block">
                  Network Intelligence
                </h1>
              </div>
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.12] rounded-xl text-sm font-semibold transition-all hover:-translate-y-0.5 active:scale-[0.97] backdrop-blur-xl shadow-lg"
              >
                <Upload size={15} />
                {hasActiveResults ? 'Update Data' : 'Upload Data'}
              </button>
            </header>

            {/* ── Main tab bar ── */}
            {hasActiveResults && (
              <nav className="flex items-center gap-1 px-6 pb-2 flex-shrink-0 relative z-20 overflow-x-auto custom-scrollbar">
                <LayoutGroup>
                  {[
                    { id: 'core', icon: Users, label: 'Core Network' },
                    { id: 'history', icon: History, label: 'Time Machine' },
                    { id: 'activity', icon: Activity, label: 'Activity' },
                    { id: 'comparison', icon: ArrowRightLeft, label: 'Following Diff' },
                    { id: 'followersComparison', icon: UserCheck, label: 'Followers Diff' },
                    { id: 'csvComparison', icon: FileSpreadsheet, label: 'Following vs CSVs' },
                  ].map(tab => {
                    const isActive = activeTab === tab.id && !showUploadModal;
                    const TabIcon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => { setActiveTab(tab.id); setShowUploadModal(false); }}
                        className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap ${isActive ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="mainTabPill"
                            className="absolute inset-0 bg-white/[0.08] border border-white/[0.1] rounded-xl"
                            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                          />
                        )}
                        <span className="relative z-10 flex items-center gap-2">
                          <TabIcon size={16} className={isActive ? 'text-cyan-400' : ''} />
                          {tab.label}
                        </span>
                      </button>
                    );
                  })}
                </LayoutGroup>
              </nav>
            )}

            {/* ── Content area ── */}
            <div className="flex-1 min-h-0 px-4 md:px-6 pb-4 relative z-10">
              {hasActiveResults && !showUploadModal ? (
                <AnimatePresence mode="wait">
                  {activeTab === 'core' && (
                    <DataPanel key="core" categories={[
                      { id: 'notFollowingBack', title: 'Not Following Back', icon: UserMinus, data: results.notFollowingBack, sort: sortConfig.notFollowingBack, color: 'rose' },
                      { id: 'fans', title: 'Fans', icon: Star, data: results.fans, sort: sortConfig.fans, color: 'cyan' },
                      { id: 'mutuals', title: 'Mutuals', icon: UserCheck, data: results.mutuals, sort: sortConfig.mutuals, color: 'emerald' }
                    ].filter(c => c.data)} searchTerm={searchTerm} onSearchChange={(v) => setSearchTerm(v.toLowerCase())} onCycleSort={cycleSort} links={userLinks} />
                  )}
                  {activeTab === 'history' && (
                    <DataPanel key="history" categories={[
                      { id: 'stillConnected', title: 'Still Connected', icon: LinkIcon, data: results.stillConnected, sort: sortConfig.stillConnected, color: 'teal' },
                      { id: 'disconnected', title: 'Disconnected', icon: Unlink, data: results.disconnected, sort: sortConfig.disconnected, color: 'orange' }
                    ].filter(c => c.data)} searchTerm={searchTerm} onSearchChange={(v) => setSearchTerm(v.toLowerCase())} onCycleSort={cycleSort} links={userLinks} />
                  )}
                  {activeTab === 'activity' && (
                    <DataPanel key="activity" categories={[
                      { id: 'pending', title: 'Pending Requests', icon: Send, data: results.pending, sort: sortConfig.pending, color: 'purple', isTemporal: true },
                      { id: 'recentRequests', title: 'Recent Requests', icon: Clock, data: results.recentRequests, sort: sortConfig.recentRequests, color: 'cyan', isTemporal: true },
                      { id: 'recentUnfollowed', title: 'Unfollowed', icon: UserMinus, data: results.recentUnfollowed, sort: sortConfig.recentUnfollowed, color: 'rose', isTemporal: true }
                    ].filter(c => c.data)} searchTerm={searchTerm} onSearchChange={(v) => setSearchTerm(v.toLowerCase())} onCycleSort={cycleSort} links={userLinks} />
                  )}
                  {activeTab === 'comparison' && (
                    <DataPanel key="comparison" categories={[
                      { id: 'compCommon', title: 'Common', icon: LinkIcon, data: results.compCommon, sort: sortConfig.compCommon, color: 'emerald' },
                      { id: 'compOnlyOld', title: 'Only in Old', icon: History, data: results.compOnlyOld, sort: sortConfig.compOnlyOld, color: 'orange' },
                      { id: 'compOnlyNew', title: 'Only in New', icon: Zap, data: results.compOnlyNew, sort: sortConfig.compOnlyNew, color: 'cyan' }
                    ].filter(c => c.data)} searchTerm={searchTerm} onSearchChange={(v) => setSearchTerm(v.toLowerCase())} onCycleSort={cycleSort} links={userLinks} />
                  )}
                  {activeTab === 'followersComparison' && (
                    <DataPanel key="followersComparison" categories={[
                      { id: 'compFolCommon', title: 'Common', icon: UserCheck, data: results.compFolCommon, sort: sortConfig.compFolCommon, color: 'emerald' },
                      { id: 'compFolOnlyOld', title: 'Only in Old', icon: History, data: results.compFolOnlyOld, sort: sortConfig.compFolOnlyOld, color: 'orange' },
                      { id: 'compFolOnlyNew', title: 'Only in New', icon: Zap, data: results.compFolOnlyNew, sort: sortConfig.compFolOnlyNew, color: 'cyan' }
                    ].filter(c => c.data)} searchTerm={searchTerm} onSearchChange={(v) => setSearchTerm(v.toLowerCase())} onCycleSort={cycleSort} links={userLinks} />
                  )}
                  {activeTab === 'csvComparison' && (
                    <DataPanel key="csvComparison" categories={[
                      { id: 'compCsvOnlyFollowing', title: 'Only in Following', icon: UserMinus, data: results.compCsvOnlyFollowing, sort: sortConfig.compCsvOnlyFollowing, color: 'rose' },
                      { id: 'compCsvOnlyCsv', title: 'Only in CSVs', icon: Zap, data: results.compCsvOnlyCsv, sort: sortConfig.compCsvOnlyCsv, color: 'cyan' },
                      { id: 'compCsvDiffAll', title: 'All Differences', icon: ArrowRightLeft, data: results.compCsvDiffAll, sort: sortConfig.compCsvDiffAll, color: 'orange' },
                      { id: 'compCsvCommon', title: 'In Both (Common)', icon: LinkIcon, data: results.compCsvCommon, sort: sortConfig.compCsvCommon, color: 'emerald' },
                      { id: 'compCsvAllCsv', title: 'All CSV Usernames', icon: FileSpreadsheet, data: results.compCsvAllCsv, sort: sortConfig.compCsvAllCsv, color: 'teal' },
                      { id: 'compCsvAllFollowing', title: 'All Following (JSON)', icon: Users, data: results.compCsvAllFollowing, sort: sortConfig.compCsvAllFollowing, color: 'purple' }
                    ].filter(c => c.data)} searchTerm={searchTerm} onSearchChange={(v) => setSearchTerm(v.toLowerCase())} onCycleSort={cycleSort} links={userLinks} />
                  )}
                </AnimatePresence>
              ) : !hasActiveResults && !showUploadModal ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                    <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 mx-auto shadow-inner">
                      <Upload size={32} className="text-gray-500" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">No Data Yet</h3>
                    <p className="text-gray-400 text-sm max-w-md mb-6">Upload your Instagram JSON exports to start analyzing your social network.</p>
                    <button onClick={() => setShowUploadModal(true)} className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-emerald-600 rounded-xl font-bold text-white hover:from-cyan-500 hover:to-emerald-500 transition-all hover:-translate-y-0.5 active:scale-95 shadow-lg shadow-cyan-900/20">
                      Upload Data
                    </button>
                  </motion.div>
                </div>
              ) : null}
            </div>

            {/* ── Upload Modal ── */}
            <AnimatePresence>
              {showUploadModal && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
                  onClick={(e) => { if (e.target === e.currentTarget && hasActiveResults) setShowUploadModal(false); }}
                >
                  <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} className="w-full max-w-4xl max-h-[90vh] overflow-y-auto custom-scrollbar">
                    <div className="bg-[#0a0a0a]/95 p-6 md:p-8 rounded-3xl border border-white/[0.12] shadow-2xl shadow-black/50 space-y-5 backdrop-blur-3xl relative">

                      {/* Modal header */}
                      <div className="flex justify-between items-center">
                        <h2 className="text-lg font-bold text-white flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border border-white/10 flex items-center justify-center shadow-inner">
                            <FileJson size={20} className="text-emerald-400" />
                          </div>
                          Data Ingestion
                        </h2>
                        {hasActiveResults && (
                          <button onClick={() => setShowUploadModal(false)} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors border border-white/10">
                            <X size={16} className="text-gray-400" />
                          </button>
                        )}
                      </div>

                      {/* Progress bar */}
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                          <motion.div
                            className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${(uploadedCount / totalFileSlots) * 100}%` }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-gray-400 tabular-nums">{uploadedCount}/{totalFileSlots}</span>
                      </div>

                      {/* Step 1: Core data */}
                      <UploadSection step={1} title="Core & Activity Data" subtitle="Current network + history" color="cyan">
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                          {[
                            { id: 'currFollowing', name: 'New Following' },
                            { id: 'currFollowers', name: 'New Followers' },
                            { id: 'oldFollowing', name: 'Old Following' },
                            { id: 'oldFollowers', name: 'Old Followers' },
                            { id: 'pending', name: 'Pending Req' },
                            { id: 'recentRequests', name: 'Recent Req' },
                            { id: 'recentUnfollowed', name: 'Unfollowed' },
                          ].map((fc) => (
                            <FileUploadZone key={fc.id} id={fc.id} name={fc.name} file={files[fc.id]} setFile={handleSetFile} />
                          ))}
                        </div>
                      </UploadSection>

                      {/* Step 2: Following comparison */}
                      <UploadSection step={2} title="Following Comparison" subtitle="Independent old vs new" color="cyan">
                        <div className="grid grid-cols-2 lg:grid-cols-7 gap-3">
                          {[
                            { id: 'compOldFollowing', name: 'Old Following' },
                            { id: 'compNewFollowing', name: 'New Following' },
                          ].map((fc) => (
                            <FileUploadZone key={fc.id} id={fc.id} name={fc.name} file={files[fc.id]} setFile={handleSetFile} />
                          ))}
                        </div>
                      </UploadSection>

                      {/* Step 3: Followers comparison */}
                      <UploadSection step={3} title="Followers Comparison" subtitle="Independent old vs new" color="emerald">
                        <div className="grid grid-cols-2 lg:grid-cols-7 gap-3">
                          {[
                            { id: 'compOldFollowers', name: 'Old Followers' },
                            { id: 'compNewFollowers', name: 'New Followers' },
                          ].map((fc) => (
                            <FileUploadZone key={fc.id} id={fc.id} name={fc.name} file={files[fc.id]} setFile={handleSetFile} />
                          ))}
                        </div>
                      </UploadSection>

                      {/* Step 4: Following vs Merged CSVs */}
                      <UploadSection step={4} title="Following vs CSVs Comparison" subtitle="Compare Following JSON vs Two Merged CSVs" color="purple">
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-3">
                          <FileUploadZone id="compCsvFollowing" name="Following (JSON)" file={files.compCsvFollowing} setFile={handleSetFile} accept=".json" fileTypeLabel="JSON" />
                          <FileUploadZone id="compCsvFile1" name="Usernames (CSV 1)" file={files.compCsvFile1} setFile={handleSetFile} accept=".csv,.txt" fileTypeLabel="CSV 1" />
                          <FileUploadZone id="compCsvFile2" name="Usernames (CSV 2)" file={files.compCsvFile2} setFile={handleSetFile} accept=".csv,.txt" fileTypeLabel="CSV 2" />
                        </div>
                      </UploadSection>

                      {/* Analyze button */}
                      <button onClick={handleProcess} disabled={isProcessing}
                        className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-600 to-emerald-600 font-bold hover:from-cyan-500 hover:to-emerald-500 shadow-lg shadow-cyan-900/20 hover:shadow-cyan-500/20 hover:-translate-y-0.5 transition-all active:translate-y-0 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 text-lg"
                      >
                        {isProcessing ? 'Compiling...' : (hasActiveResults ? <><ArrowRightLeft size={20} /> Update Analysis</> : 'Analyze Selection')}
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


// ============================================================
// LANDING PAGE
// ============================================================
function LandingPage({ onStart }) {
  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center max-w-5xl mx-auto space-y-10 relative z-10 px-4">
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: "easeOut" }} className="text-center space-y-4 max-w-4xl">
        <img src={AppLogo} alt="Logo" className="w-50 h-50 mx-auto drop-shadow-2xl select-none" />
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter bg-gradient-to-r from-cyan-300 via-emerald-300 to-emerald-600 bg-clip-text text-transparent drop-shadow-sm leading-tight">
          Manage <br /> Your Network.
        </h1>
        <p className="text-lg md:text-xl text-gray-300 font-medium leading-relaxed px-4">
          Upload your Instagram data to generate a stunning, glass-rendered matrix of your followers, fans, mutuals, and outbound requests. All processed instantly on your device.
        </p>
        <div className="pt-6">
          <button onClick={onStart} className="group relative inline-flex items-center gap-3 px-8 py-4 bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-3xl rounded-full text-white font-bold text-lg shadow-2xl hover:shadow-cyan-500/20 transition-all duration-300 active:scale-95 overflow-hidden">
            <span className="relative z-10 flex items-center gap-2">Launch Workspace <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" /></span>
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
          </button>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }} className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full px-4">
        <FeatureCard icon={ShieldCheck} title="Privacy First" desc="Your data never leaves your browser. Zero servers, zero tracking." color="cyan" />
        <FeatureCard icon={BarChart3} title="Deep Analytics" desc="Track fans, unrequited follows, and historical connection shifts." color="emerald" />
        <FeatureCard icon={Zap} title="Instant Matrices" desc="Powered by a high-performance React engine with Liquid Glass visuals." color="purple" />
      </motion.div>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, desc, color }) {
  const colorMap = { cyan: "text-cyan-400", emerald: "text-emerald-400", purple: "text-purple-400" };
  return (
    <div className="bg-white/5 border border-white/10 backdrop-blur-3xl rounded-3xl p-6 shadow-2xl hover:bg-white/10 hover:border-white/20 transition-all duration-300 hover:-translate-y-1 group">
      <div className="w-12 h-12 rounded-2xl bg-black/20 border border-white/10 shadow-inner flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
        <Icon size={24} className={`${colorMap[color]} drop-shadow-md`} />
      </div>
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
    </div>
  );
}


// ============================================================
// UPLOAD SECTION (step container)
// ============================================================
function UploadSection({ step, title, subtitle, color, children }) {
  const colorMap = {
    cyan: 'bg-cyan-500/20 border-cyan-500/30 text-cyan-400',
    emerald: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400',
    purple: 'bg-purple-500/20 border-purple-500/30 text-purple-400'
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className={`w-6 h-6 rounded-full border text-xs font-bold flex items-center justify-center ${colorMap[color]}`}>
          {step}
        </span>
        <span className="text-sm font-bold text-white">{title}</span>
        <span className="text-xs text-gray-500 font-medium">{subtitle}</span>
      </div>
      {children}
    </div>
  );
}


// ============================================================
// FILE UPLOAD ZONE
// ============================================================
function FileUploadZone({ id, name, file, setFile, accept = ".json", fileTypeLabel = "JSON" }) {
  const [isDragging, setIsDragging] = useState(false);
  
  const hasFiles = file && file.length > 0;

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setIsDragging(true);
    else if (e.type === 'dragleave') setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(id, Array.from(e.dataTransfer.files));
    }
  };

  const handleChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(id, Array.from(e.target.files));
    }
  };

  return (
    <div
      onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
      className={`relative border border-dashed rounded-2xl p-3 transition-all duration-300 ease-out flex flex-col justify-center items-center h-24 overflow-hidden group cursor-pointer ${isDragging
        ? 'border-white/50 bg-white/20 scale-[1.02] z-10 shadow-2xl shadow-black/50 backdrop-blur-3xl'
        : hasFiles
          ? 'border-emerald-500/50 bg-emerald-500/10 shadow-lg backdrop-blur-xl'
          : 'border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]'
        }`}
    >
      <input type="file" multiple accept={accept} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" onChange={handleChange} />
      <div className="relative z-10 flex flex-col items-center justify-center gap-1">
        <AnimatePresence mode="wait">
          {hasFiles ? (
            <motion.div key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-7 h-7 bg-emerald-500/20 rounded-full flex items-center justify-center border border-emerald-500/30">
              <Check size={14} className="text-emerald-400" />
            </motion.div>
          ) : (
            <motion.div key="upload" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${isDragging ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/5 text-gray-500 group-hover:text-cyan-400 group-hover:bg-cyan-500/10'}`}>
              <Upload size={13} />
            </motion.div>
          )}
        </AnimatePresence>
        <span className={`font-bold text-[10px] uppercase tracking-wider text-center transition-colors ${hasFiles ? 'text-emerald-400' : isDragging ? 'text-cyan-300' : 'text-gray-400 group-hover:text-gray-200'}`}>{name}</span>
        <span className={`text-[9px] truncate w-full px-1 text-center font-medium ${hasFiles ? 'text-emerald-500/70' : 'text-gray-600'}`}>{hasFiles ? (file.length === 1 ? file[0].name : `${file.length} files added`) : fileTypeLabel}</span>
      </div>
    </div>
  );
}


// ============================================================
// EMPTY STATE
// ============================================================
function EmptyState({ icon: Icon, title, message, color }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
      className="h-full flex flex-col items-center justify-center text-center p-8"
    >
      <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-5 shadow-inner">
        <Icon size={28} className="text-gray-500" />
      </div>
      <h3 className="font-bold text-lg mb-2 text-white">{title}</h3>
      <p className="text-gray-400 text-sm max-w-[260px] leading-relaxed">{message}</p>
    </motion.div>
  );
}


// ============================================================
// DATA PANEL — Full-width tabbed data table
// ============================================================
function DataPanel({ categories, searchTerm, onSearchChange, onCycleSort, links }) {
  const [activeCatId, setActiveCatId] = useState(null);
  const [selectedUsers, setSelectedUsers] = useState(new Set());
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [genderFilter, setGenderFilter] = useState('all'); // 'all' | 'male' | 'female' | 'unknown'

  useEffect(() => {
    if (categories.length > 0 && (!activeCatId || !categories.find(c => c.id === activeCatId))) {
      setActiveCatId(categories[0].id);
    }
  }, [categories, activeCatId]);

  const activeCat = categories.find(c => c.id === activeCatId) || categories[0];

  if (!activeCat) {
    return <EmptyState icon={Activity} title="No Data" message="Upload files to see results for this section." color="purple" />;
  }

  const isTemporal = !!activeCat.isTemporal;
  const sort = activeCat.sort;

  const getSortLabel = () => sort.type === 'alpha'
    ? (sort.dir === 'asc' ? 'A → Z' : 'Z → A')
    : (sort.dir === 'asc' ? 'Oldest' : 'Newest');

  // Gender statistics for the current category
  const genderStats = useMemo(() => {
    const data = activeCat.data || [];
    const stats = { male: 0, female: 0, unknown: 0 };
    data.forEach(d => {
      const g = d.gender || 'unknown';
      if (stats[g] !== undefined) stats[g]++;
      else stats.unknown++;
    });
    return stats;
  }, [activeCat]);

  const processedData = useMemo(() => {
    const data = activeCat.data || [];
    let filtered = isTemporal
      ? data.filter(d => d.searchString.includes(searchTerm))
      : data.filter(d => d.username.includes(searchTerm));

    // Apply gender filter
    if (genderFilter !== 'all') {
      filtered = filtered.filter(d => (d.gender || 'unknown') === genderFilter);
    }

    filtered.sort((a, b) => {
      if (sort.type === 'alpha') {
        return sort.dir === 'asc' ? a.username.localeCompare(b.username) : b.username.localeCompare(a.username);
      }
      const timeA = isTemporal ? a.timestamp : a.fileIndex;
      const timeB = isTemporal ? b.timestamp : b.fileIndex;
      return sort.dir === 'asc' ? timeB - timeA : timeA - timeB;
    });

    if (!isTemporal) return filtered;

    // Group temporal data by date
    const groups = {};
    filtered.forEach(item => {
      const key = item.prettyDate || 'Unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });

    const displayList = [];
    let rowCounter = 1;
    Object.keys(groups).forEach(date => {
      displayList.push({ _isHeader: true, date, count: groups[date].length });
      groups[date].forEach(item => {
        item._rowNum = rowCounter++;
        displayList.push(item);
      });
    });

    return displayList;
  }, [activeCat, sort, searchTerm, isTemporal, genderFilter]);

  const stickyIndices = useMemo(() =>
    isTemporal ? processedData.map((d, i) => d._isHeader ? i : -1).filter(i => i !== -1) : [],
    [processedData, isTemporal]
  );

  const dataCount = isTemporal
    ? processedData.filter(d => !d._isHeader).length
    : processedData.length;

  const colorAccentMap = {
    rose: 'text-rose-400', cyan: 'text-cyan-400', emerald: 'text-emerald-400',
    teal: 'text-teal-400', orange: 'text-orange-400', purple: 'text-purple-400'
  };

  const toggleSelection = (username) => {
    setSelectedUsers(prev => {
      const next = new Set(prev);
      if (next.has(username)) next.delete(username);
      else next.add(username);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const selectable = processedData.filter(d => !d._isHeader).map(d => d.username);
    const allSelected = selectable.every(u => selectedUsers.has(u));
    
    setSelectedUsers(prev => {
      const next = new Set(prev);
      if (allSelected) {
        selectable.forEach(u => next.delete(u));
      } else {
        selectable.forEach(u => next.add(u));
      }
      return next;
    });
  };

  const handleSelectRange = () => {
    const start = parseInt(rangeStart, 10);
    const end = parseInt(rangeEnd, 10);
    if (isNaN(start) || isNaN(end) || start < 1 || end < start) return;
    
    const selectable = processedData.filter(d => !d._isHeader).map(d => d.username);
    const sliceStart = Math.max(0, start - 1);
    const sliceEnd = Math.min(selectable.length, end);
    const toSelect = selectable.slice(sliceStart, sliceEnd);
    
    setSelectedUsers(new Set(toSelect));
    setRangeStart('');
    setRangeEnd('');
  };

  const handleOpenSelected = () => {
    if (selectedUsers.size === 0) return;
    
    // Most browsers block opening > 20 tabs at once, so we might want to cap this or warn, but let's just loop
    selectedUsers.forEach(username => {
      const link = links[username] || `https://instagram.com/${username}`;
      window.open(link, '_blank', 'noopener,noreferrer');
    });
  };

  const handleSelectNext = () => {
    const size = selectedUsers.size;
    if (size === 0) return;
    
    const selectable = processedData.filter(d => !d._isHeader).map(d => d.username);
    let maxIdx = -1;
    selectable.forEach((u, idx) => {
      if (selectedUsers.has(u)) maxIdx = Math.max(maxIdx, idx);
    });
    
    if (maxIdx === -1) return;
    
    const nextStart = maxIdx + 1;
    const nextEnd = Math.min(selectable.length, nextStart + size);
    const toSelect = selectable.slice(nextStart, nextEnd);
    
    if (toSelect.length > 0) {
      setSelectedUsers(new Set(toSelect));
    }
  };

  const handleSelectPrev = () => {
    const size = selectedUsers.size;
    if (size === 0) return;
    
    const selectable = processedData.filter(d => !d._isHeader).map(d => d.username);
    let minIdx = selectable.length;
    selectable.forEach((u, idx) => {
      if (selectedUsers.has(u)) minIdx = Math.min(minIdx, idx);
    });
    
    if (minIdx === selectable.length) return;
    
    const prevEnd = minIdx;
    const prevStart = Math.max(0, prevEnd - size);
    const toSelect = selectable.slice(prevStart, prevEnd);
    
    if (toSelect.length > 0) {
      setSelectedUsers(new Set(toSelect));
    }
  };

  const renderRow = (item, index) => {
    if (!item) return null;

    // Date group header for temporal data
    if (item._isHeader) {
      return (
        <div className="flex items-center justify-between px-5 h-full bg-slate-900/95 backdrop-blur-md border-b border-white/10 shadow-sm z-10 relative">
          <div className="flex items-center gap-2">
            <Calendar size={12} className="text-gray-500" />
            <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">{item.date}</span>
          </div>
          <span className="text-[10px] font-bold text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">{item.count}</span>
        </div>
      );
    }

    const rowNum = isTemporal ? item._rowNum : (index + 1);

    return (
      <div 
        className="flex items-center h-full px-5 border-b border-white/[0.04] hover:bg-white/[0.06] transition-colors group cursor-pointer"
        onClick={() => toggleSelection(item.username)}
      >
        {/* Checkbox */}
        <div className="w-8 flex-shrink-0 flex items-center justify-center">
          <div className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${selectedUsers.has(item.username) ? 'bg-cyan-500 border-cyan-500 text-white' : 'bg-white/5 border-white/20 group-hover:border-cyan-400'}`}>
            {selectedUsers.has(item.username) && <Check size={12} strokeWidth={3} />}
          </div>
        </div>
        {/* Row number */}
        <div className="w-8 flex-shrink-0 text-xs text-gray-600 tabular-nums font-medium">{rowNum}</div>
        {/* Gender badge */}
        <div className="w-6 flex-shrink-0 flex items-center justify-center">
          <span
            className={`text-[10px] font-bold leading-none ${
              item.gender === 'male' ? 'text-blue-400'
              : item.gender === 'female' ? 'text-pink-400'
              : 'text-gray-600'
            }`}
            title={item.gender === 'male' ? 'Male' : item.gender === 'female' ? 'Female' : 'Unknown'}
          >
            {item.gender === 'male' ? '♂' : item.gender === 'female' ? '♀' : '·'}
          </span>
        </div>
        {/* Username */}
        <div className="flex-1 min-w-0 px-2 flex items-center gap-2">
          <a href={links[item.username] || `https://instagram.com/${item.username}`} target="_blank" rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-sm font-medium text-gray-300 hover:text-cyan-300 truncate transition-colors flex items-center gap-1.5 inline-flex"
          >
            @{item.username}
            <ExternalLink size={11} className="opacity-0 group-hover:opacity-40 transition-opacity flex-shrink-0" />
          </a>
          {item.matchedWith && (
            <span className="text-[10px] text-emerald-400/90 font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/25 truncate" title={`Symbol-matched with: @${item.matchedWith}`}>
              ≈ @{item.matchedWith}
            </span>
          )}
        </div>
        {/* Date (temporal) */}
        {isTemporal && (
          <div className="w-36 flex-shrink-0 flex flex-col justify-center gap-0.5">
            <span className="text-xs font-medium text-gray-300">{item.prettyDate}</span>
            <span className="text-[9px] text-cyan-500/70 font-bold uppercase tracking-wider">{item.daysAgo} {item.daysAgo === 1 ? 'day' : 'days'} ago</span>
          </div>
        )}
        {/* Actions */}
        <div className="w-16 flex-shrink-0 flex justify-end">
          <button
            onClick={() => navigator.clipboard.writeText(item.username)}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-all text-gray-600 hover:text-white"
            title="Copy username"
          >
            <Copy size={13} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col h-full bg-black/30 backdrop-blur-2xl rounded-2xl border border-white/[0.08] shadow-2xl overflow-hidden"
    >
      {/* Sub-tabs + controls bar */}
      <div className="flex items-center border-b border-white/[0.08] flex-shrink-0 bg-white/[0.02]">
        {/* Category sub-tabs */}
        <div className="flex items-center overflow-x-auto custom-scrollbar flex-1">
          <LayoutGroup>
            {categories.map(cat => {
              const isActive = activeCat.id === cat.id;
              const CatIcon = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCatId(cat.id)}
                  className={`relative flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-colors whitespace-nowrap ${isActive ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="subTabIndicator"
                      className="absolute bottom-0 left-2 right-2 h-0.5 bg-cyan-400 rounded-full"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <CatIcon size={14} className={isActive ? colorAccentMap[cat.color] || 'text-cyan-400' : ''} />
                  <span>{cat.title}</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums ${isActive ? 'bg-cyan-500/20 text-cyan-300' : 'bg-white/5 text-gray-600'}`}>
                    {cat.data?.length || 0}
                  </span>
                </button>
              );
            })}
          </LayoutGroup>
        </div>

        {/* Gender filter + Search + Sort controls */}
        <div className="flex items-center gap-2 px-3 flex-shrink-0 border-l border-white/[0.06]">
          {/* Gender filter chips */}
          <div className="flex items-center gap-1">
            {[
              { id: 'all',     label: 'All',     icon: null,  count: genderStats.male + genderStats.female + genderStats.unknown },
              { id: 'male',    label: '♂',        icon: null,  count: genderStats.male,    color: 'text-blue-400 bg-blue-500/15 border-blue-500/30 hover:bg-blue-500/25' },
              { id: 'female',  label: '♀',        icon: null,  count: genderStats.female,  color: 'text-pink-400 bg-pink-500/15 border-pink-500/30 hover:bg-pink-500/25' },
              { id: 'unknown', label: '?',        icon: null,  count: genderStats.unknown, color: 'text-gray-400 bg-gray-500/15 border-gray-500/30 hover:bg-gray-500/25' },
            ].map(chip => {
              const isActive = genderFilter === chip.id;
              const baseStyle = chip.id === 'all'
                ? 'text-gray-400 bg-white/[0.04] border-white/[0.06] hover:bg-white/[0.08]'
                : chip.color;
              return (
                <button
                  key={chip.id}
                  onClick={() => setGenderFilter(chip.id)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-all border whitespace-nowrap ${
                    isActive
                      ? `${baseStyle} ring-1 ring-white/20 shadow-sm scale-[1.04]`
                      : `${baseStyle} opacity-60 hover:opacity-100`
                  }`}
                >
                  {chip.label}
                  <span className="tabular-nums text-[9px] opacity-70">{chip.count}</span>
                </button>
              );
            })}
          </div>

          <div className="w-px h-5 bg-white/10" />

          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Filter..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="bg-white/[0.04] border border-white/[0.08] rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:border-white/20 transition-colors text-white placeholder:text-gray-600 w-32 focus:w-48"
            />
          </div>
          <button
            onClick={() => onCycleSort(activeCat.id)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] rounded-lg text-[11px] font-bold text-gray-400 hover:text-white transition-colors border border-white/[0.06] whitespace-nowrap"
          >
            {getSortLabel()} <ArrowUpDown size={11} />
          </button>
        </div>
      </div>

      {/* Column headers */}
      <div className="flex items-center px-5 py-2 text-[11px] font-bold text-gray-600 uppercase tracking-wider border-b border-white/[0.05] bg-black/20 flex-shrink-0 select-none">
        <div className="w-8 flex-shrink-0 flex items-center justify-center cursor-pointer" onClick={toggleSelectAll}>
          <div className="w-4 h-4 rounded border border-white/20 hover:border-cyan-400 bg-white/5 flex items-center justify-center transition-colors">
             {(() => {
                const selectable = processedData.filter(d => !d._isHeader).map(d => d.username);
                if (selectable.length === 0) return null;
                const allSelected = selectable.every(u => selectedUsers.has(u));
                const someSelected = selectable.some(u => selectedUsers.has(u));
                if (allSelected) return <Check size={12} strokeWidth={3} className="text-cyan-400" />;
                if (someSelected) return <div className="w-2 h-0.5 bg-cyan-400 rounded-full" />;
                return null;
             })()}
          </div>
        </div>
        <div className="w-8 flex-shrink-0">#</div>
        <div className="w-6 flex-shrink-0 text-center" title="Gender">G</div>
        <div className="flex-1 px-2">Username</div>
        {isTemporal && <div className="w-36 flex-shrink-0">Date</div>}
        <div className="w-16 flex-shrink-0 text-right">Copy</div>
      </div>

      {/* Data rows */}
      <div className="flex-1 min-h-0">
        {dataCount === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-600 text-sm font-medium">
            No results found
          </div>
        ) : (
          <VirtualList
            items={processedData}
            itemHeight={52}
            renderItem={renderRow}
            className="custom-scrollbar"
            stickyIndices={stickyIndices}
          />
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-5 py-2 border-t border-white/[0.06] bg-black/20 flex-shrink-0 text-[11px] text-gray-600 font-medium">
        <div className="flex items-center gap-3">
          <span className="tabular-nums">{dataCount} {dataCount === 1 ? 'entry' : 'entries'}</span>
          
          {/* Range Selection */}
          <div className="flex items-center gap-1.5 border-l border-white/10 pl-3">
            <span className="text-[10px] uppercase font-bold text-gray-500">Select:</span>
            <input 
              type="number" 
              placeholder="From" 
              value={rangeStart}
              onChange={e => setRangeStart(e.target.value)}
              className="bg-white/5 border border-white/10 rounded px-1.5 py-0.5 w-12 outline-none focus:border-cyan-400 text-white placeholder:text-gray-600 transition-colors no-spinners"
            />
            <span className="text-gray-500">-</span>
            <input 
              type="number" 
              placeholder="To" 
              value={rangeEnd}
              onChange={e => setRangeEnd(e.target.value)}
              className="bg-white/5 border border-white/10 rounded px-1.5 py-0.5 w-12 outline-none focus:border-cyan-400 text-white placeholder:text-gray-600 transition-colors no-spinners"
            />
            <button 
              onClick={handleSelectRange}
              className="px-2 py-0.5 bg-white/10 hover:bg-white/20 rounded font-bold text-gray-300 hover:text-white transition-colors border border-white/10"
            >
              Go
            </button>
          </div>

          <AnimatePresence>
            {selectedUsers.size > 0 && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-1.5 ml-2"
              >
                <button
                  onClick={handleSelectPrev}
                  className="px-2 py-1 bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white rounded-lg transition-colors border border-white/10 text-[10px] font-bold uppercase"
                  title={`Select previous ${selectedUsers.size}`}
                >
                  Prev {selectedUsers.size}
                </button>
                
                <button 
                  onClick={handleOpenSelected}
                  className="flex items-center gap-1.5 px-3 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 rounded-lg transition-colors border border-cyan-500/30 font-bold shadow-lg"
                >
                  <ExternalLink size={12} />
                  Open {selectedUsers.size}
                </button>

                <button
                  onClick={() => {
                    const list = Array.from(selectedUsers).join('\n');
                    navigator.clipboard.writeText(list);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1 bg-white/10 hover:bg-white/20 text-gray-200 hover:text-white rounded-lg transition-colors border border-white/10 font-bold shadow-lg text-[11px]"
                  title={`Copy ${selectedUsers.size} selected usernames`}
                >
                  <Copy size={12} />
                  Copy {selectedUsers.size}
                </button>

                <button
                  onClick={handleSelectNext}
                  className="px-2 py-1 bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white rounded-lg transition-colors border border-white/10 text-[10px] font-bold uppercase"
                  title={`Select next ${selectedUsers.size}`}
                >
                  Next {selectedUsers.size}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <span>Sort: {getSortLabel()}</span>
      </div>
    </motion.div>
  );
}