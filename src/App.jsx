import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Search, Check, Copy, Clock, ArrowUpDown, ArrowRightLeft } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import AppLogo from './assets/logo.png';

export default function App() {
  const [files, setFiles] = useState({
    currFollowing: null, currFollowers: null,
    oldFollowing: null, oldFollowers: null,
    pending: null
  });

  const [results, setResults] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [userLinks, setUserLinks] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState(null);

  // Core Sorting State Configuration for every possible output column
  const [sortConfig, setSortConfig] = useState({
    notFollowingBack: { type: 'alpha', dir: 'asc' },
    fans: { type: 'alpha', dir: 'asc' },
    mutuals: { type: 'alpha', dir: 'asc' },
    stillConnected: { type: 'alpha', dir: 'asc' },
    disconnected: { type: 'alpha', dir: 'asc' },
    pending: { type: 'time', dir: 'asc' }
  });

  const triggerToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  // Rotates sequentially through: A-Z -> Z-A -> Oldest -> Newest
  const cycleSort = (key) => {
    setSortConfig(prev => {
      const current = prev[key];
      let nextType = current.type;
      let nextDir = current.dir;

      if (current.type === 'alpha' && current.dir === 'asc') {
        nextDir = 'desc';
      } else if (current.type === 'alpha' && current.dir === 'desc') {
        nextType = 'time';
        nextDir = 'asc';
      } else if (current.type === 'time' && current.dir === 'asc') {
        nextDir = 'desc';
      } else {
        nextType = 'alpha';
        nextDir = 'asc';
      }

      return { ...prev, [key]: { type: nextType, dir: nextDir } };
    });
  };

  // Uniform sorting execution for text arrays, implicit structures, and real timestamps
  const getSortedData = (data, key) => {
    const { type, dir } = sortConfig[key];
    return [...data].sort((a, b) => {
      if (type === 'alpha') {
        return dir === 'asc' ? a.username.localeCompare(b.username) : b.username.localeCompare(a.username);
      } else {
        // High indices/days indicate older relationships in data streams
        const ageA = a.daysAgo !== undefined ? a.daysAgo : a.fileIndex;
        const ageB = b.daysAgo !== undefined ? b.daysAgo : b.fileIndex;
        return dir === 'asc' ? ageB - ageA : ageA - ageB;
      }
    });
  };

  // Normalizer: Standardizes data profiles across structural variations while mapping outbound hyper-references
  const parseJsonFile = (data, type) => {
    const tempLinks = { ...userLinks };
    let rawList = [];

    if (type.includes('following')) {
      rawList = data.relationships_following || [];
    } else if (Array.isArray(data)) {
      rawList = data;
    }

    const items = rawList.map((item, idx) => {
      const username = (item.title || item.string_list_data?.[0]?.value)?.toLowerCase();
      const href = item.string_list_data?.[0]?.href || '#';
      if (username) tempLinks[username] = href;
      return username ? { username, href, fileIndex: idx } : null;
    }).filter(Boolean);

    setUserLinks(prev => ({ ...prev, ...tempLinks }));
    return items;
  };

  const handleProcess = async () => {
    if (!Object.values(files).some(file => file !== null)) {
      return triggerToast('Please upload at least one system file to process.');
    }
    setIsProcessing(true);

    const loadJson = (file) => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(JSON.parse(e.target.result));
      reader.readAsText(file);
    });

    try {
      const processed = {};
      const outResults = {};

      // Parse whatever files the user actually provided
      if (files.currFollowing) processed.currFollowing = parseJsonFile(await loadJson(files.currFollowing), 'following');
      if (files.currFollowers) processed.currFollowers = parseJsonFile(await loadJson(files.currFollowers), 'followers');
      if (files.oldFollowing) processed.oldFollowing = parseJsonFile(await loadJson(files.oldFollowing), 'following');
      if (files.oldFollowers) processed.oldFollowers = parseJsonFile(await loadJson(files.oldFollowers), 'followers');

      // Execution Modules 1: Active Relations Analysis (Requires both current files)
      if (processed.currFollowing && processed.currFollowers) {
        const activeFollowersSet = new Set(processed.currFollowers.map(u => u.username));
        const activeFollowingSet = new Set(processed.currFollowing.map(u => u.username));

        outResults.notFollowingBack = processed.currFollowing.filter(u => !activeFollowersSet.has(u.username));
        outResults.fans = processed.currFollowers.filter(u => !activeFollowingSet.has(u.username));
        outResults.mutuals = processed.currFollowing.filter(u => activeFollowersSet.has(u.username));
      }

      // Execution Modules 2: Historical Continuity Audits (Compares old profiles with current state)
      if (processed.oldFollowing || processed.oldFollowers) {
        const currentActivePool = new Set([
          ...(processed.currFollowing?.map(u => u.username) || []),
          ...(processed.currFollowers?.map(u => u.username) || [])
        ]);

        // Merge target profiles from old files
        const combinedOldMap = new Map();
        [...(processed.oldFollowing || []), ...(processed.oldFollowers || [])].forEach(item => {
          if (!combinedOldMap.has(item.username)) combinedOldMap.set(item.username, item);
        });
        const distinctOldItems = Array.from(combinedOldMap.values());

        outResults.stillConnected = distinctOldItems.filter(u => currentActivePool.has(u.username));
        outResults.disconnected = distinctOldItems.filter(u => !currentActivePool.has(u.username));
      }

      // Execution Modules 3: Outbound Request Timelines
      if (files.pending) {
        const pendingData = await loadJson(files.pending);
        outResults.pending = pendingData.map((item, idx) => {
          const username = item.label_values?.find(l => l.label === 'Username')?.value?.toLowerCase();
          const daysAgo = Math.floor((Date.now() / 1000 - item.timestamp) / 86400);
          return username ? { username, daysAgo, fileIndex: idx } : null;
        }).filter(Boolean);
      }

      setResults(outResults);
      triggerToast('Network matrix compiled successfully!');
    } catch (err) {
      console.error(err);
      triggerToast('Error analyzing files. Verify file integrity.');
    } finally {
      setIsProcessing(false);
    }
  };

  const hasActiveResults = results && Object.keys(results).length > 0;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white p-6 md:p-12 font-sans">
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="fixed top-5 right-5 bg-gradient-to-r from-cyan-600 to-emerald-600 px-6 py-3 rounded-2xl z-50 flex items-center gap-2 shadow-xl shadow-black/40 border border-white/10 font-medium">
            <Check size={18} />{toast}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto space-y-10">
        <div className="text-center space-y-4">
          <img src={AppLogo} alt="Network Audit Logo" className="mx-auto w-32 h-32 animate-pulse" />
          <h1 className="text-5xl font-extrabold tracking-tighter bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
            Network Intelligence
          </h1>
        </div>

        {/* Input Interface Matrix */}
        <div className="bg-white/5 p-6 rounded-3xl border border-white/10 space-y-4">
          <h2 className="text-sm font-semibold text-gray-400 tracking-wider uppercase flex items-center gap-2"><ArrowRightLeft size={16} /> Data File Ingestion</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { id: 'currFollowing', name: 'New Following' },
              { id: 'currFollowers', name: 'New Followers' },
              { id: 'oldFollowing', name: 'Old Following' },
              { id: 'oldFollowers', name: 'Old Followers' },
              { id: 'pending', name: 'Pending Requests' },
            ].map((fileConfig) => (
              <label key={fileConfig.id} className={`group relative border border-dashed rounded-2xl p-4 transition-all duration-300 cursor-pointer text-center flex flex-col justify-center items-center h-28 ${files[fileConfig.id] ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'bg-white/[0.02] border-white/10 hover:border-cyan-500/50 hover:bg-white/[0.04]'}`}>
                <input type="file" className="hidden" onChange={(e) => setFiles(p => ({ ...p, [fileConfig.id]: e.target.files[0] }))} />
                {files[fileConfig.id] ? <Check size={20} className="mb-1 text-emerald-400 animate-scale" /> : <Upload size={20} className="mb-1 text-gray-500 group-hover:text-cyan-400 transition-colors" />}
                <span className="font-bold text-xs tracking-tight block text-white group-hover:text-cyan-300 transition-colors">{fileConfig.name}</span>
                <span className="text-[10px] text-gray-500 truncate max-w-[110px] mt-1 block">{files[fileConfig.id]?.name || 'Upload JSON'}</span>
              </label>
            ))}
          </div>
          <button onClick={handleProcess} disabled={isProcessing} className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-600 to-emerald-600 font-bold hover:from-cyan-500 hover:to-emerald-500 shadow-lg shadow-cyan-950/20 transition-all active:scale-[0.99] disabled:opacity-50">
            {isProcessing ? 'Compiling Datasets...' : 'Analyze Selection'}
          </button>
        </div>

        {/* Processed Analytics Workspace */}
        {hasActiveResults && (
          <div className="space-y-6">
            <div className="relative">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input type="text" placeholder="Search usernames across lists..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value.toLowerCase())} className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-6 py-4 outline-none focus:border-cyan-500 text-sm transition-colors placeholder:text-gray-600" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {results.notFollowingBack && (
                <StandardCard title="Not Following Back" data={results.notFollowingBack.filter(u => u.username.includes(searchTerm))} sort={sortConfig.notFollowingBack} onSort={() => cycleSort('notFollowingBack')} color="rose" links={userLinks} />
              )}
              {results.fans && (
                <StandardCard title="Fans" data={results.fans.filter(u => u.username.includes(searchTerm))} sort={sortConfig.fans} onSort={() => cycleSort('fans')} color="cyan" links={userLinks} />
              )}
              {results.mutuals && (
                <StandardCard title="Mutuals" data={results.mutuals.filter(u => u.username.includes(searchTerm))} sort={sortConfig.mutuals} onSort={() => cycleSort('mutuals')} color="emerald" links={userLinks} />
              )}
              {results.stillConnected && (
                <StandardCard title="Still Connected" data={results.stillConnected.filter(u => u.username.includes(searchTerm))} sort={sortConfig.stillConnected} onSort={() => cycleSort('stillConnected')} color="teal" links={userLinks} />
              )}
              {results.disconnected && (
                <StandardCard title="Disconnected" data={results.disconnected.filter(u => u.username.includes(searchTerm))} sort={sortConfig.disconnected} onSort={() => cycleSort('disconnected')} color="orange" links={userLinks} />
              )}
              {results.pending && (
                <StandardCard title="Pending Outbound" data={results.pending.filter(u => u.username.includes(searchTerm))} sort={sortConfig.pending} onSort={() => cycleSort('pending')} color="purple" links={userLinks} isPending={true} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StandardCard({ title, data, sort, onSort, color, links, isPending }) {
  const styles = {
    rose: "bg-rose-500/5 text-rose-400 border-rose-500/20 hover:border-rose-500/40",
    cyan: "bg-cyan-500/5 text-cyan-400 border-cyan-500/20 hover:border-cyan-500/40",
    emerald: "bg-emerald-500/5 text-emerald-400 border-emerald-500/20 hover:border-emerald-500/40",
    teal: "bg-teal-500/5 text-teal-400 border-teal-500/20 hover:border-teal-500/40",
    orange: "bg-orange-500/5 text-orange-400 border-orange-500/20 hover:border-orange-500/40",
    purple: "bg-purple-500/5 text-purple-400 border-purple-500/20 hover:border-purple-500/40"
  };

  const getSortBadgeLabel = () => {
    if (sort.type === 'alpha') return sort.dir === 'asc' ? 'A-Z' : 'Z-A';
    return sort.dir === 'asc' ? 'Oldest' : 'Newest';
  };

  const sortedItems = [...data].sort((a, b) => {
    if (sort.type === 'alpha') {
      return sort.dir === 'asc' ? a.username.localeCompare(b.username) : b.username.localeCompare(a.username);
    } else {
      const stepA = a.daysAgo !== undefined ? a.daysAgo : a.fileIndex;
      const stepB = b.daysAgo !== undefined ? b.daysAgo : b.fileIndex;
      return sort.dir === 'asc' ? stepB - stepA : stepA - stepB;
    }
  });

  return (
    <div className={`border rounded-3xl p-5 h-[480px] flex flex-col transition-all duration-300 shadow-md ${styles[color]}`}>
      {/* List Header controls */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold text-base text-white tracking-tight">{title}</span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/10 opacity-70 text-white">{data.length}</span>
        </div>

        <button onClick={onSort} className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-xl transition-all text-[11px] font-bold tracking-wider uppercase text-white shadow-inner active:scale-95">
          <span>{getSortBadgeLabel()}</span>
          <ArrowUpDown size={11} className="opacity-60" />
        </button>
      </div>

      {/* Target Accounts Stream */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-1.5 scrollbar-thin scrollbar-thumb-white/10">
        {sortedItems.map((item) => (
          <div key={item.username} className="flex justify-between items-center bg-white/[0.03] hover:bg-white/[0.07] p-3 rounded-xl transition-all duration-200 group border border-white/[0.02]">
            <a href={links[item.username] || `https://instagram.com/${item.username}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium tracking-tight text-gray-300 hover:text-white transition-colors truncate max-w-[75%]">
              @{item.username}
            </a>

            {isPending ? (
              <div className={`text-[11px] font-medium flex items-center gap-1 px-2 py-0.5 rounded-md ${item.daysAgo > 180 ? 'bg-rose-500/20 text-rose-400' : 'bg-white/5 text-gray-400'}`}>
                <Clock size={11} /> {item.daysAgo}d
              </div>
            ) : (
              <button onClick={() => navigator.clipboard.writeText(item.username)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-all">
                <Copy size={13} />
              </button>
            )}
          </div>
        ))}
        {data.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-30">
            <span className="text-xs font-medium">No accounts in segment</span>
          </div>
        )}
      </div>
    </div>
  );
}