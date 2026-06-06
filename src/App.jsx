import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Search, Check, Copy, Clock, ArrowUpDown, ArrowRightLeft, Users, History, Send } from 'lucide-react';
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

  const [activeTab, setActiveTab] = useState('core');

  const [sortConfig, setSortConfig] = useState({
    notFollowingBack: { type: 'alpha', dir: 'asc' },
    fans: { type: 'alpha', dir: 'asc' },
    mutuals: { type: 'alpha', dir: 'asc' },
    stillConnected: { type: 'alpha', dir: 'asc' },
    disconnected: { type: 'alpha', dir: 'asc' },
    pending: { type: 'time', dir: 'asc' }
  });

  const triggerToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

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
    let rawList = type.includes('following') ? (data.relationships_following || []) : (Array.isArray(data) ? data : []);

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

      if (files.currFollowing) processed.currFollowing = parseJsonFile(await loadJson(files.currFollowing), 'following');
      if (files.currFollowers) processed.currFollowers = parseJsonFile(await loadJson(files.currFollowers), 'followers');
      if (files.oldFollowing) processed.oldFollowing = parseJsonFile(await loadJson(files.oldFollowing), 'following');
      if (files.oldFollowers) processed.oldFollowers = parseJsonFile(await loadJson(files.oldFollowers), 'followers');

      if (processed.currFollowing && processed.currFollowers) {
        const activeFollowersSet = new Set(processed.currFollowers.map(u => u.username));
        const activeFollowingSet = new Set(processed.currFollowing.map(u => u.username));

        outResults.notFollowingBack = processed.currFollowing.filter(u => !activeFollowersSet.has(u.username));
        outResults.fans = processed.currFollowers.filter(u => !activeFollowingSet.has(u.username));
        outResults.mutuals = processed.currFollowing.filter(u => activeFollowersSet.has(u.username));
      }

      if (processed.oldFollowing || processed.oldFollowers) {
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

      if (files.pending) {
        const pendingData = await loadJson(files.pending);
        outResults.pending = pendingData.map((item, idx) => {
          const username = item.label_values?.find(l => l.label === 'Username')?.value?.toLowerCase();
          const daysAgo = Math.floor((Date.now() / 1000 - item.timestamp) / 86400);
          return username ? { username, daysAgo, fileIndex: idx } : null;
        }).filter(Boolean);
      }

      setResults(outResults);

      // Smart Tab Routing based on what they just uploaded
      if (files.currFollowing && files.currFollowers && !files.oldFollowing && !files.oldFollowers && !files.pending) setActiveTab('core');
      else if ((files.oldFollowing || files.oldFollowers) && !files.currFollowing && !files.currFollowers && !files.pending) setActiveTab('history');
      else if (files.pending && !files.currFollowing && !files.currFollowers && !files.oldFollowing && !files.oldFollowers) setActiveTab('pending');

      triggerToast('Network matrix updated successfully!');
    } catch (err) {
      console.error(err);
      triggerToast('Error analyzing files. Verify file integrity.');
    } finally {
      setIsProcessing(false);
    }
  };

  const hasActiveResults = results && Object.keys(results).length > 0;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white p-6 md:p-12 font-sans selection:bg-cyan-500/30">
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="fixed top-5 right-5 bg-gradient-to-r from-cyan-600 to-emerald-600 px-6 py-3 rounded-2xl z-50 flex items-center gap-2 shadow-xl shadow-black/40 border border-white/10 font-medium">
            <Check size={18} />{toast}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <div className="text-center space-y-4 mb-4">
          <img src={AppLogo} alt="Network Audit Logo" className="mx-auto w-24 h-24" />
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
            Network Intelligence
          </h1>
        </div>

        {/* ALWAYS VISIBLE: Input Interface Matrix */}
        <div className="bg-white/[0.02] p-6 rounded-3xl border border-white/10 space-y-5">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-semibold text-gray-400 tracking-wider uppercase flex items-center gap-2">
              <ArrowRightLeft size={16} /> Data File Ingestion
            </h2>
            {hasActiveResults && <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full font-bold tracking-widest uppercase border border-emerald-500/20">Matrix Active</span>}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { id: 'currFollowing', name: 'New Following' },
              { id: 'currFollowers', name: 'New Followers' },
              { id: 'oldFollowing', name: 'Old Following' },
              { id: 'oldFollowers', name: 'Old Followers' },
              { id: 'pending', name: 'Pending Requests' },
            ].map((fileConfig) => (
              <label key={fileConfig.id} className={`group relative border border-dashed rounded-2xl p-3 transition-all duration-300 cursor-pointer text-center flex flex-col justify-center items-center h-24 ${files[fileConfig.id] ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'bg-white/[0.02] border-white/10 hover:border-cyan-500/50 hover:bg-white/[0.04]'}`}>
                <input type="file" className="hidden" onChange={(e) => setFiles(p => ({ ...p, [fileConfig.id]: e.target.files[0] }))} />
                {files[fileConfig.id] ? <Check size={20} className="mb-1 text-emerald-400" /> : <Upload size={20} className="mb-1 text-gray-500 group-hover:text-cyan-400 transition-colors" />}
                <span className="font-bold text-xs tracking-tight block text-white group-hover:text-cyan-300 transition-colors">{fileConfig.name}</span>
                <span className="text-[10px] text-gray-500 truncate w-full mt-1 px-1 block">{files[fileConfig.id]?.name || 'Upload JSON'}</span>
              </label>
            ))}
          </div>
          <button onClick={handleProcess} disabled={isProcessing} className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-600 to-emerald-600 font-bold hover:from-cyan-500 hover:to-emerald-500 shadow-lg shadow-cyan-950/20 transition-all active:scale-[0.99] disabled:opacity-50">
            {isProcessing ? 'Compiling...' : (hasActiveResults ? 'Update Analysis' : 'Analyze Selection')}
          </button>
        </div>

        {/* Workspace Navigation & Results */}
        {hasActiveResults && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/5 p-2 rounded-2xl border border-white/10 sticky top-4 z-40 backdrop-blur-xl">
              <div className="flex p-1 bg-black/40 rounded-xl">
                <NavTab id="core" icon={<Users size={16} />} label="Core Network" active={activeTab} set={setActiveTab} />
                <NavTab id="history" icon={<History size={16} />} label="Time Machine" active={activeTab} set={setActiveTab} />
                <NavTab id="pending" icon={<Send size={16} />} label="Outbound" active={activeTab} set={setActiveTab} />
              </div>

              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input type="text" placeholder="Filter current view..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value.toLowerCase())} className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-cyan-500 text-sm transition-colors placeholder:text-gray-600" />
              </div>
            </div>

            {activeTab === 'core' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {results.notFollowingBack ? <StandardCard title="Not Following Back" data={results.notFollowingBack.filter(u => u.username.includes(searchTerm))} sort={sortConfig.notFollowingBack} onSort={() => cycleSort('notFollowingBack')} color="rose" links={userLinks} /> : <EmptyState message="Upload Current Following & Followers to see this data." />}
                {results.fans ? <StandardCard title="Fans" data={results.fans.filter(u => u.username.includes(searchTerm))} sort={sortConfig.fans} onSort={() => cycleSort('fans')} color="cyan" links={userLinks} /> : <EmptyState message="Upload Current Following & Followers to see this data." />}
                {results.mutuals ? <StandardCard title="Mutuals" data={results.mutuals.filter(u => u.username.includes(searchTerm))} sort={sortConfig.mutuals} onSort={() => cycleSort('mutuals')} color="emerald" links={userLinks} /> : <EmptyState message="Upload Current Following & Followers to see this data." />}
              </motion.div>
            )}

            {activeTab === 'history' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                {results.stillConnected ? <StandardCard title="Still Connected" data={results.stillConnected.filter(u => u.username.includes(searchTerm))} sort={sortConfig.stillConnected} onSort={() => cycleSort('stillConnected')} color="teal" links={userLinks} /> : <EmptyState message="Upload Old & Current files to track network stability." />}
                {results.disconnected ? <StandardCard title="Disconnected" data={results.disconnected.filter(u => u.username.includes(searchTerm))} sort={sortConfig.disconnected} onSort={() => cycleSort('disconnected')} color="orange" links={userLinks} /> : <EmptyState message="Upload Old & Current files to track account drift." />}
              </motion.div>
            )}

            {activeTab === 'pending' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
                {results.pending ? <StandardCard title="Pending Requests" data={results.pending.filter(u => u.username.includes(searchTerm))} sort={sortConfig.pending} onSort={() => cycleSort('pending')} color="purple" links={userLinks} isPending={true} /> : <EmptyState message="Upload your Pending Requests JSON to view outbound history." />}
              </motion.div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function NavTab({ id, icon, label, active, set }) {
  const isActive = active === id;
  return (
    <button onClick={() => set(id)} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${isActive ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}>
      {icon} <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function EmptyState({ message }) {
  return (
    <div className="border border-dashed border-white/10 rounded-3xl p-6 h-[480px] flex flex-col items-center justify-center text-center bg-white/[0.01]">
      <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4 text-gray-600"><Users size={20} /></div>
      <p className="text-gray-500 text-sm max-w-[200px]">{message}</p>
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

  const getSortBadgeLabel = () => sort.type === 'alpha' ? (sort.dir === 'asc' ? 'A-Z' : 'Z-A') : (sort.dir === 'asc' ? 'Oldest' : 'Newest');

  const sortedItems = [...data].sort((a, b) => {
    if (sort.type === 'alpha') return sort.dir === 'asc' ? a.username.localeCompare(b.username) : b.username.localeCompare(a.username);
    const stepA = a.daysAgo !== undefined ? a.daysAgo : a.fileIndex;
    const stepB = b.daysAgo !== undefined ? b.daysAgo : b.fileIndex;
    return sort.dir === 'asc' ? stepB - stepA : stepA - stepB;
  });

  return (
    <div className={`border rounded-3xl p-5 h-[500px] flex flex-col transition-all duration-300 shadow-md ${styles[color]}`}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold text-lg text-white tracking-tight">{title}</span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/10 opacity-70 text-white">{data.length}</span>
        </div>
        <button onClick={onSort} className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-xl transition-all text-[11px] font-bold tracking-wider uppercase text-white shadow-inner active:scale-95">
          <span>{getSortBadgeLabel()}</span><ArrowUpDown size={11} className="opacity-60" />
        </button>
      </div>

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
        {data.length === 0 && <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-30"><span className="text-xs font-medium">No accounts in segment</span></div>}
      </div>
    </div>
  );
}