import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, Search, Check, Copy, Clock, ArrowUpDown, ArrowRightLeft,
  Users, History, Send, UserMinus, Star, UserCheck, Link as LinkIcon, Unlink, FileJson
} from 'lucide-react';
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
    <div className="min-h-screen bg-[#050505] text-white p-6 md:p-12 font-sans selection:bg-cyan-500/30 pb-24">
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="fixed top-5 right-5 bg-gradient-to-r from-cyan-600 to-emerald-600 px-6 py-3 rounded-2xl z-50 flex items-center gap-2 shadow-xl shadow-black/40 border border-white/10 font-medium">
            <Check size={18} />{toast}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-6xl mx-auto space-y-8">

        <div className="text-center space-y-4 mb-4">
          <img src={AppLogo} alt="Network Audit Logo" className="mx-auto w-24 h-24 drop-shadow-2xl" />
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
            Network Intelligence
          </h1>
        </div>

        {/* ALWAYS VISIBLE: Input Interface Matrix */}
        <div className="bg-white/[0.02] p-6 rounded-3xl border border-white/5 shadow-2xl shadow-black/50 space-y-5 backdrop-blur-xl">
          <div className="flex justify-between items-center px-2">
            <h2 className="text-sm font-bold text-gray-400 tracking-widest uppercase flex items-center gap-2">
              <FileJson size={16} className="text-emerald-500" /> Data Ingestion
            </h2>
            {hasActiveResults && <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full font-bold tracking-widest uppercase border border-emerald-500/20 flex items-center gap-1.5"><Check size={10} /> Matrix Active</span>}
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
                <span className="font-bold text-[11px] uppercase tracking-wider block text-gray-300 group-hover:text-cyan-300 transition-colors">{fileConfig.name}</span>
                <span className="text-[10px] text-gray-600 truncate w-full mt-1 px-1 block font-medium">{files[fileConfig.id]?.name || 'Upload JSON'}</span>
              </label>
            ))}
          </div>
          <button onClick={handleProcess} disabled={isProcessing} className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-600 to-emerald-600 font-bold hover:from-cyan-500 hover:to-emerald-500 shadow-lg shadow-cyan-900/20 transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2">
            {isProcessing ? 'Compiling...' : (hasActiveResults ? <><ArrowRightLeft size={18} /> Update Analysis</> : 'Analyze Selection')}
          </button>
        </div>

        {/* Workspace Navigation & Results */}
        {hasActiveResults && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/[0.02] p-2 rounded-2xl border border-white/5 sticky top-4 z-40 backdrop-blur-2xl shadow-xl shadow-black/40">
              <div className="flex p-1 bg-black/40 rounded-xl overflow-x-auto custom-scrollbar">
                <NavTab id="core" icon={<Users size={16} />} label="Core Network" active={activeTab} set={setActiveTab} />
                <NavTab id="history" icon={<History size={16} />} label="Time Machine" active={activeTab} set={setActiveTab} />
                <NavTab id="pending" icon={<Send size={16} />} label="Outbound" active={activeTab} set={setActiveTab} />
              </div>

              <div className="relative flex-1 max-w-sm shrink-0">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                <input type="text" placeholder="Filter current view..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value.toLowerCase())} className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-cyan-500 text-sm transition-colors placeholder:text-gray-600 focus:bg-white/10" />
              </div>
            </div>

            {activeTab === 'core' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {results.notFollowingBack ? <StandardCard title="Not Following Back" icon={UserMinus} data={results.notFollowingBack.filter(u => u.username.includes(searchTerm))} sort={sortConfig.notFollowingBack} onSort={() => cycleSort('notFollowingBack')} color="rose" links={userLinks} /> : <EmptyState icon={UserMinus} title="No Core Data" message="Upload Current Following & Followers to view this metric." color="rose" />}
                {results.fans ? <StandardCard title="Fans" icon={Star} data={results.fans.filter(u => u.username.includes(searchTerm))} sort={sortConfig.fans} onSort={() => cycleSort('fans')} color="cyan" links={userLinks} /> : <EmptyState icon={Star} title="No Core Data" message="Upload Current Following & Followers to view this metric." color="cyan" />}
                {results.mutuals ? <StandardCard title="Mutuals" icon={UserCheck} data={results.mutuals.filter(u => u.username.includes(searchTerm))} sort={sortConfig.mutuals} onSort={() => cycleSort('mutuals')} color="emerald" links={userLinks} /> : <EmptyState icon={UserCheck} title="No Core Data" message="Upload Current Following & Followers to view this metric." color="emerald" />}
              </motion.div>
            )}

            {activeTab === 'history' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                {results.stillConnected ? <StandardCard title="Still Connected" icon={LinkIcon} data={results.stillConnected.filter(u => u.username.includes(searchTerm))} sort={sortConfig.stillConnected} onSort={() => cycleSort('stillConnected')} color="teal" links={userLinks} /> : <EmptyState icon={LinkIcon} title="No Historical Data" message="Upload Old & Current files to track network stability." color="teal" />}
                {results.disconnected ? <StandardCard title="Disconnected" icon={Unlink} data={results.disconnected.filter(u => u.username.includes(searchTerm))} sort={sortConfig.disconnected} onSort={() => cycleSort('disconnected')} color="orange" links={userLinks} /> : <EmptyState icon={Unlink} title="No Historical Data" message="Upload Old & Current files to track account drift." color="orange" />}
              </motion.div>
            )}

            {activeTab === 'pending' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
                {results.pending ? <StandardCard title="Pending Requests" icon={Send} data={results.pending.filter(u => u.username.includes(searchTerm))} sort={sortConfig.pending} onSort={() => cycleSort('pending')} color="purple" links={userLinks} isPending={true} /> : <EmptyState icon={Send} title="No Outbound Data" message="Upload your Pending Requests JSON to view history." color="purple" />}
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
    <button onClick={() => set(id)} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${isActive ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}>
      {icon} <span>{label}</span>
    </button>
  );
}

function EmptyState({ icon: Icon, title, message, color }) {
  const colorMap = {
    rose: "bg-rose-500/5 text-rose-500 border-rose-500/10",
    cyan: "bg-cyan-500/5 text-cyan-500 border-cyan-500/10",
    emerald: "bg-emerald-500/5 text-emerald-500 border-emerald-500/10",
    teal: "bg-teal-500/5 text-teal-500 border-teal-500/10",
    orange: "bg-orange-500/5 text-orange-500 border-orange-500/10",
    purple: "bg-purple-500/5 text-purple-500 border-purple-500/10"
  };

  return (
    <div className={`border rounded-3xl p-6 h-[500px] flex flex-col items-center justify-center text-center ${colorMap[color]}`}>
      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${colorMap[color].split(' ')[0]} border ${colorMap[color].split(' ')[2]}`}>
        <Icon size={28} className="opacity-80" />
      </div>
      <h3 className="font-bold text-lg mb-2 text-white">{title}</h3>
      <p className="text-sm opacity-70 max-w-[200px]">{message}</p>
    </div>
  );
}

function StandardCard({ title, icon: Icon, data, sort, onSort, color, links, isPending }) {
  const styles = {
    rose: "bg-rose-500/[0.03] text-rose-400 border-rose-500/20 hover:border-rose-500/40 hover:shadow-rose-900/10",
    cyan: "bg-cyan-500/[0.03] text-cyan-400 border-cyan-500/20 hover:border-cyan-500/40 hover:shadow-cyan-900/10",
    emerald: "bg-emerald-500/[0.03] text-emerald-400 border-emerald-500/20 hover:border-emerald-500/40 hover:shadow-emerald-900/10",
    teal: "bg-teal-500/[0.03] text-teal-400 border-teal-500/20 hover:border-teal-500/40 hover:shadow-teal-900/10",
    orange: "bg-orange-500/[0.03] text-orange-400 border-orange-500/20 hover:border-orange-500/40 hover:shadow-orange-900/10",
    purple: "bg-purple-500/[0.03] text-purple-400 border-purple-500/20 hover:border-purple-500/40 hover:shadow-purple-900/10"
  };

  const getSortBadgeLabel = () => sort.type === 'alpha' ? (sort.dir === 'asc' ? 'A-Z' : 'Z-A') : (sort.dir === 'asc' ? 'Oldest' : 'Newest');

  const sortedItems = [...data].sort((a, b) => {
    if (sort.type === 'alpha') return sort.dir === 'asc' ? a.username.localeCompare(b.username) : b.username.localeCompare(a.username);
    const stepA = a.daysAgo !== undefined ? a.daysAgo : a.fileIndex;
    const stepB = b.daysAgo !== undefined ? b.daysAgo : b.fileIndex;
    return sort.dir === 'asc' ? stepB - stepA : stepA - stepB;
  });

  return (
    <div className={`border rounded-3xl p-5 h-[500px] flex flex-col transition-all duration-500 shadow-xl hover:-translate-y-1 ${styles[color]}`}>
      <div className="mb-5 flex items-center justify-between pb-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl bg-white/5 shadow-inner`}>
            <Icon size={18} />
          </div>
          <div>
            <span className="font-bold text-lg text-white tracking-tight block leading-none">{title}</span>
            <span className="text-[11px] font-semibold text-gray-500 tracking-wider uppercase mt-1 block">{data.length} Accounts</span>
          </div>
        </div>
        <button onClick={onSort} className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-xl transition-all text-[10px] font-bold tracking-wider uppercase text-white shadow-inner active:scale-95">
          <span>{getSortBadgeLabel()}</span><ArrowUpDown size={12} className="opacity-60" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-1.5 custom-scrollbar">
        {sortedItems.map((item) => (
          <div key={item.username} className="flex justify-between items-center bg-black/20 hover:bg-white/[0.08] p-3.5 rounded-xl transition-all duration-200 group border border-white/[0.02]">
            <a href={links[item.username] || `https://instagram.com/${item.username}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium tracking-tight text-gray-300 group-hover:text-white transition-colors truncate max-w-[70%]">
              @{item.username}
            </a>
            {isPending ? (
              <div className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 px-2.5 py-1 rounded-md border ${item.daysAgo > 180 ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-white/5 text-gray-400 border-white/10'}`}>
                <Clock size={10} /> {item.daysAgo}d
              </div>
            ) : (
              <button onClick={() => navigator.clipboard.writeText(item.username)} className="opacity-0 group-hover:opacity-100 p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-gray-300 hover:text-white transition-all shadow-sm">
                <Copy size={13} />
              </button>
            )}
          </div>
        ))}
        {data.length === 0 && <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-30"><span className="text-sm font-medium text-white">List is empty</span></div>}
      </div>
    </div>
  );
}