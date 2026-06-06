import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, Search, Check, Copy, Clock, ArrowUpDown, ArrowRightLeft,
  Users, History, Send, UserMinus, Star, UserCheck, Link as LinkIcon, Unlink, FileJson, Calendar
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
    pending: { type: 'time', dir: 'desc' } // Default to newest first
  });

  const triggerToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const handleSetFile = (id, file) => {
    setFiles(prev => ({ ...prev, [id]: file }));
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
          const listData = item.string_list_data?.[0] || {};
          const username = (listData.value || item.title || item.label_values?.find(l => l.label === 'Username')?.value)?.toLowerCase();

          // Architecture for temporal data extraction
          const unixTime = listData.timestamp || item.timestamp;
          const dateObj = unixTime ? new Date(unixTime * 1000) : null;

          const isoDate = dateObj ? dateObj.toISOString().split('T')[0] : 'Unknown Date';
          const prettyDate = dateObj ? dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Unknown Date';
          const daysAgo = unixTime ? Math.floor((Date.now() / 1000 - unixTime) / 86400) : 0;

          // Composite search string index for unified querying
          const searchString = `${username} ${isoDate} ${prettyDate}`.toLowerCase();

          return username ? { username, daysAgo, fileIndex: idx, isoDate, prettyDate, searchString } : null;
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

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08 } },
    exit: { opacity: 0, y: -10, transition: { duration: 0.2 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 md:p-12 font-sans selection:bg-cyan-500/30 pb-24 overflow-x-hidden">
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="fixed top-5 right-5 bg-gradient-to-r from-cyan-600 to-emerald-600 px-6 py-3 rounded-2xl z-50 flex items-center gap-2 shadow-xl shadow-black/40 border border-white/10 font-medium">
            <Check size={18} />{toast}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-6xl mx-auto space-y-8">

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="text-center space-y-4 mb-4">
          <img src={AppLogo} alt="Network Audit Logo" className="mx-auto w-24 h-24 drop-shadow-2xl select-none pointer-events-none" />
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
            Network Intelligence
          </h1>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white/[0.02] p-6 rounded-3xl border border-white/5 shadow-2xl shadow-black/50 space-y-5 backdrop-blur-xl">
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
              <FileUploadZone key={fileConfig.id} id={fileConfig.id} name={fileConfig.name} file={files[fileConfig.id]} setFile={handleSetFile} />
            ))}
          </div>
          <button onClick={handleProcess} disabled={isProcessing} className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-600 to-emerald-600 font-bold hover:from-cyan-500 hover:to-emerald-500 shadow-lg shadow-cyan-900/10 hover:shadow-cyan-500/20 hover:-translate-y-0.5 transition-all active:translate-y-0 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2">
            {isProcessing ? 'Compiling...' : (hasActiveResults ? <><ArrowRightLeft size={18} /> Update Analysis</> : 'Analyze Selection')}
          </button>
        </motion.div>

        {hasActiveResults && (
          <div className="space-y-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/[0.02] p-2 rounded-2xl border border-white/5 sticky top-4 z-40 backdrop-blur-2xl shadow-xl shadow-black/40">
              <div className="flex p-1 bg-black/40 rounded-xl overflow-x-auto custom-scrollbar">
                <NavTab id="core" icon={<Users size={16} />} label="Core Network" active={activeTab} set={setActiveTab} />
                <NavTab id="history" icon={<History size={16} />} label="Time Machine" active={activeTab} set={setActiveTab} />
                <NavTab id="pending" icon={<Send size={16} />} label="Outbound" active={activeTab} set={setActiveTab} />
              </div>

              <div className="relative flex-1 max-w-sm shrink-0 group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-cyan-400 transition-colors" size={16} />
                <input
                  type="text"
                  placeholder={activeTab === 'pending' ? "Search by handle, year, or month..." : "Filter current view..."}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value.toLowerCase())}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-cyan-500/50 text-sm transition-all placeholder:text-gray-600 focus:bg-white/[0.08] focus:shadow-[0_0_20px_-5px_rgba(6,182,212,0.1)]"
                />
              </div>
            </motion.div>

            <AnimatePresence mode="wait">
              {activeTab === 'core' && (
                <motion.div key="core" variants={containerVariants} initial="hidden" animate="show" exit="exit" className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <motion.div variants={itemVariants} className="h-full">
                    {results.notFollowingBack ? <StandardCard title="Not Following Back" icon={UserMinus} data={results.notFollowingBack.filter(u => u.username.includes(searchTerm))} sort={sortConfig.notFollowingBack} onSort={() => cycleSort('notFollowingBack')} color="rose" links={userLinks} /> : <EmptyState icon={UserMinus} title="No Core Data" message="Upload Current Following & Followers to view this metric." color="rose" />}
                  </motion.div>
                  <motion.div variants={itemVariants} className="h-full">
                    {results.fans ? <StandardCard title="Fans" icon={Star} data={results.fans.filter(u => u.username.includes(searchTerm))} sort={sortConfig.fans} onSort={() => cycleSort('fans')} color="cyan" links={userLinks} /> : <EmptyState icon={Star} title="No Core Data" message="Upload Current Following & Followers to view this metric." color="cyan" />}
                  </motion.div>
                  <motion.div variants={itemVariants} className="h-full">
                    {results.mutuals ? <StandardCard title="Mutuals" icon={UserCheck} data={results.mutuals.filter(u => u.username.includes(searchTerm))} sort={sortConfig.mutuals} onSort={() => cycleSort('mutuals')} color="emerald" links={userLinks} /> : <EmptyState icon={UserCheck} title="No Core Data" message="Upload Current Following & Followers to view this metric." color="emerald" />}
                  </motion.div>
                </motion.div>
              )}

              {activeTab === 'history' && (
                <motion.div key="history" variants={containerVariants} initial="hidden" animate="show" exit="exit" className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                  <motion.div variants={itemVariants} className="h-full">
                    {results.stillConnected ? <StandardCard title="Still Connected" icon={LinkIcon} data={results.stillConnected.filter(u => u.username.includes(searchTerm))} sort={sortConfig.stillConnected} onSort={() => cycleSort('stillConnected')} color="teal" links={userLinks} /> : <EmptyState icon={LinkIcon} title="No Historical Data" message="Upload Old & Current files to track network stability." color="teal" />}
                  </motion.div>
                  <motion.div variants={itemVariants} className="h-full">
                    {results.disconnected ? <StandardCard title="Disconnected" icon={Unlink} data={results.disconnected.filter(u => u.username.includes(searchTerm))} sort={sortConfig.disconnected} onSort={() => cycleSort('disconnected')} color="orange" links={userLinks} /> : <EmptyState icon={Unlink} title="No Historical Data" message="Upload Old & Current files to track account drift." color="orange" />}
                  </motion.div>
                </motion.div>
              )}

              {activeTab === 'pending' && (
                <motion.div key="pending" variants={containerVariants} initial="hidden" animate="show" exit="exit" className="max-w-2xl mx-auto">
                  <motion.div variants={itemVariants} className="h-full">
                    {results.pending ? <GroupedPendingCard title="Outbound Requests" icon={Send} data={results.pending} searchTerm={searchTerm} sort={sortConfig.pending} onSort={() => cycleSort('pending')} color="purple" links={userLinks} /> : <EmptyState icon={Send} title="No Outbound Data" message="Upload your Pending Requests JSON to view history." color="purple" />}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

// --- INTERACTIVE COMPONENTS ---
function FileUploadZone({ id, name, file, setFile }) {
  const [isDragging, setIsDragging] = useState(false);

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
    if (e.dataTransfer.files && e.dataTransfer.files[0]) setFile(id, e.dataTransfer.files[0]);
  };

  const handleChange = (e) => {
    if (e.target.files && e.target.files[0]) setFile(id, e.target.files[0]);
  };

  return (
    <div
      onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
      className={`relative border-2 border-dashed rounded-2xl p-3 transition-all duration-300 ease-out flex flex-col justify-center items-center h-28 overflow-hidden group ${isDragging
        ? 'border-cyan-400 bg-cyan-500/10 scale-[1.02] z-10 shadow-[0_0_30px_-5px_rgba(6,182,212,0.3)]'
        : file
          ? 'border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/15'
          : 'border-white/10 bg-white/[0.02] hover:border-cyan-500/30 hover:bg-white/[0.04]'
        }`}
    >
      <input type="file" accept=".json" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" onChange={handleChange} />
      <div className="relative z-10 flex flex-col items-center justify-center">
        <div className="h-10 flex items-center justify-center mb-1">
          <AnimatePresence mode="wait">
            {file ? (
              <motion.div key="check" initial={{ scale: 0, opacity: 0, rotate: -45 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} exit={{ scale: 0, opacity: 0 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="w-8 h-8 bg-emerald-500/20 rounded-full flex items-center justify-center border border-emerald-500/30">
                <Check size={16} className="text-emerald-400" />
              </motion.div>
            ) : (
              <motion.div key="upload" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-300 ${isDragging ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/5 text-gray-500 group-hover:text-cyan-400 group-hover:bg-cyan-500/10'}`}>
                <motion.div animate={isDragging ? { y: [-2, 2, -2] } : {}} transition={{ repeat: Infinity, duration: 1, ease: "easeInOut" }}>
                  <Upload size={16} />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <span className={`font-bold text-[11px] uppercase tracking-wider block text-center transition-colors duration-300 ${file ? 'text-emerald-400' : isDragging ? 'text-cyan-300' : 'text-gray-300 group-hover:text-cyan-300'}`}>{name}</span>
        <span className={`text-[10px] truncate w-full mt-1 px-2 text-center block font-medium transition-colors ${file ? 'text-emerald-500' : 'text-gray-600 group-hover:text-gray-400'}`}>{file ? file.name : (isDragging ? 'Drop it here!' : 'Click or drag JSON')}</span>
      </div>
      {file && <motion.div initial={{ scale: 0, opacity: 0.5 }} animate={{ scale: 4, opacity: 0 }} transition={{ duration: 0.8, ease: "easeOut" }} className="absolute inset-0 bg-emerald-500 rounded-full z-0 origin-center pointer-events-none" />}
    </div>
  );
}

function NavTab({ id, icon, label, active, set }) {
  const isActive = active === id;
  return (
    <button onClick={() => set(id)} className={`relative flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-colors whitespace-nowrap z-10 ${isActive ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}>
      {isActive && <motion.div layoutId="activeTabIndicator" className="absolute inset-0 bg-white/10 rounded-lg -z-10" transition={{ type: "tween", ease: "easeInOut", duration: 0.2 }} />}
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
      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${colorMap[color].split(' ')[0]} border ${colorMap[color].split(' ')[2]}`}><Icon size={28} className="opacity-80" /></div>
      <h3 className="font-bold text-lg mb-2 text-white">{title}</h3>
      <p className="text-sm opacity-70 max-w-[200px]">{message}</p>
    </div>
  );
}

function StandardCard({ title, icon: Icon, data, sort, onSort, color, links }) {
  const styles = {
    rose: "bg-rose-500/[0.02] text-rose-400 border-rose-500/10 hover:border-rose-500/30 hover:shadow-[0_0_30px_-5px_rgba(244,63,94,0.12)]",
    cyan: "bg-cyan-500/[0.02] text-cyan-400 border-cyan-500/10 hover:border-cyan-500/30 hover:shadow-[0_0_30px_-5px_rgba(6,182,212,0.12)]",
    emerald: "bg-emerald-500/[0.02] text-emerald-400 border-emerald-500/10 hover:border-emerald-500/30 hover:shadow-[0_0_30px_-5px_rgba(16,185,129,0.12)]",
    teal: "bg-teal-500/[0.02] text-teal-400 border-teal-500/10 hover:border-teal-500/30 hover:shadow-[0_0_30px_-5px_rgba(20,184,166,0.12)]",
    orange: "bg-orange-500/[0.02] text-orange-400 border-orange-500/10 hover:border-orange-500/30 hover:shadow-[0_0_30px_-5px_rgba(249,115,22,0.12)]"
  };

  const getSortBadgeLabel = () => sort.type === 'alpha' ? (sort.dir === 'asc' ? 'A-Z' : 'Z-A') : (sort.dir === 'asc' ? 'Oldest' : 'Newest');

  const sortedItems = useMemo(() => {
    return [...data].sort((a, b) => {
      if (sort.type === 'alpha') return sort.dir === 'asc' ? a.username.localeCompare(b.username) : b.username.localeCompare(a.username);
      return sort.dir === 'asc' ? b.fileIndex - a.fileIndex : a.fileIndex - b.fileIndex;
    });
  }, [data, sort]);

  const [scrollTop, setScrollTop] = useState(0);
  const itemHeight = 60;
  const containerHeight = 440;
  const buffer = 5;

  const handleScroll = (e) => setScrollTop(e.target.scrollTop);
  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(sortedItems.length - 1, Math.floor((scrollTop + containerHeight) / itemHeight) + buffer);

  const visibleItems = sortedItems.slice(Math.max(0, startIndex - buffer), endIndex + 1);
  const paddingTop = Math.max(0, startIndex - buffer) * itemHeight;
  const paddingBottom = Math.max(0, sortedItems.length - (endIndex + 1)) * itemHeight;

  return (
    <div className={`border rounded-3xl p-5 h-[500px] flex flex-col transition-all duration-300 ease-out hover:-translate-y-1 ${styles[color]}`}>
      <div className="mb-5 flex items-center justify-between pb-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-white/5 shadow-inner transition-transform duration-300 group-hover:scale-105"><Icon size={18} /></div>
          <div>
            <span className="font-bold text-lg text-white tracking-tight block leading-none">{title}</span>
            <span className="text-[11px] font-semibold text-gray-500 tracking-wider uppercase mt-1 block">{data.length} Accounts</span>
          </div>
        </div>
        <button onClick={onSort} className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 active:scale-95 px-3 py-1.5 rounded-xl transition-all text-[10px] font-bold tracking-wider uppercase text-white shadow-inner border border-white/[0.02] hover:border-white/10">
          <span>{getSortBadgeLabel()}</span><ArrowUpDown size={12} className="opacity-60" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar" onScroll={handleScroll}>
        <div style={{ height: paddingTop }}></div>
        {visibleItems.map((item) => (
          <div key={item.username} className="flex justify-between items-center bg-black/20 hover:bg-white/[0.04] p-3.5 mb-1.5 rounded-xl border border-white/[0.01] hover:border-white/5 transition-all duration-200 ease-out group">
            <a href={links[item.username] || `https://instagram.com/${item.username}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium tracking-tight text-gray-400 group-hover:text-white group-hover:translate-x-1 transform transition-all duration-200 truncate max-w-[70%]">
              @{item.username}
            </a>
            <button onClick={() => navigator.clipboard.writeText(item.username)} className="opacity-0 group-hover:opacity-100 p-1.5 bg-white/5 hover:bg-white/10 active:scale-90 rounded-lg text-gray-400 hover:text-white transition-all shadow-sm border border-white/5">
              <Copy size={13} />
            </button>
          </div>
        ))}
        <div style={{ height: paddingBottom }}></div>
        {data.length === 0 && <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-30"><span className="text-sm font-medium text-white">List is empty</span></div>}
      </div>
    </div>
  );
}

// --- NEW COMPONENT: Outbound Temporal Matrix ---
function GroupedPendingCard({ title, icon: Icon, data, sort, onSort, color, links, searchTerm }) {
  const styles = {
    purple: "bg-purple-500/[0.02] text-purple-400 border-purple-500/10 hover:border-purple-500/30 hover:shadow-[0_0_30px_-5px_rgba(168,85,247,0.12)]"
  };

  const getSortBadgeLabel = () => sort.type === 'alpha' ? (sort.dir === 'asc' ? 'A-Z' : 'Z-A') : (sort.dir === 'asc' ? 'Oldest First' : 'Newest First');

  const groupedData = useMemo(() => {
    // 1. Filter first
    const filtered = data.filter(item => item.searchString.includes(searchTerm));

    // 2. Group by Date String
    const groups = filtered.reduce((acc, item) => {
      if (!acc[item.isoDate]) {
        acc[item.isoDate] = { prettyDate: item.prettyDate, timestamp: item.timestamp, items: [] };
      }
      acc[item.isoDate].items.push(item);
      return acc;
    }, {});

    // 3. Sort Group Headers (Time-based or Alpha)
    const sortedGroupKeys = Object.keys(groups).sort((a, b) => {
      const timeA = groups[a].timestamp;
      const timeB = groups[b].timestamp;
      return sort.type === 'time' && sort.dir === 'asc' ? timeA - timeB : timeB - timeA;
    });

    // 4. Sort Items within the Groups
    sortedGroupKeys.forEach(key => {
      groups[key].items.sort((a, b) => {
        if (sort.type === 'alpha') return sort.dir === 'asc' ? a.username.localeCompare(b.username) : b.username.localeCompare(a.username);
        return sort.dir === 'asc' ? a.timestamp - b.timestamp : b.timestamp - a.timestamp;
      });
    });

    return { keys: sortedGroupKeys, map: groups, totalCount: filtered.length };
  }, [data, sort, searchTerm]);

  return (
    <div className={`border rounded-3xl p-5 h-[650px] flex flex-col transition-all duration-300 ease-out hover:-translate-y-1 ${styles[color] || styles.purple}`}>
      {/* Header Section */}
      <div className="mb-5 flex items-center justify-between pb-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-white/5 shadow-inner transition-transform duration-300 hover:scale-105">
            <Icon size={18} />
          </div>
          <div>
            <span className="font-bold text-lg text-white tracking-tight block leading-none">{title}</span>
            <span className="text-[11px] font-semibold text-gray-500 tracking-wider uppercase mt-1 block">{groupedData.totalCount} Total Requests</span>
          </div>
        </div>
        <button onClick={onSort} className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 active:scale-95 px-3 py-1.5 rounded-xl transition-all text-[10px] font-bold tracking-wider uppercase text-white shadow-inner border border-white/[0.02]">
          <span>{getSortBadgeLabel()}</span><ArrowUpDown size={12} className="opacity-60" />
        </button>
      </div>

      {/* Scrollable Container */}
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        {groupedData.keys.length > 0 ? (
          groupedData.keys.map(dateKey => {
            const group = groupedData.map[dateKey];
            return (
              <div key={dateKey} className="mb-6 last:mb-0">
                {/* Native Sticky Date Header */}
                <div className="sticky top-0 z-10 bg-[#0a0a0a]/95 backdrop-blur-md py-2 mb-2 border-b border-white/5 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Calendar size={12} className="text-purple-500" />
                    <span className="text-xs font-bold text-purple-400 uppercase tracking-widest">{group.prettyDate}</span>
                  </div>
                  <span className="text-[10px] text-gray-500 font-semibold bg-white/5 px-2 py-0.5 rounded-md">{group.items.length} requests</span>
                </div>

                {/* Items */}
                <div className="space-y-1.5">
                  {group.items.map(item => (
                    <div key={item.username} className="flex justify-between items-center bg-black/20 hover:bg-white/[0.04] p-3 rounded-xl border border-white/[0.01] hover:border-white/5 transition-all duration-200 group">
                      <a href={links[item.username] || `https://instagram.com/${item.username}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium tracking-tight text-gray-400 group-hover:text-white group-hover:translate-x-1 transform transition-all duration-200 truncate max-w-[70%]">
                        @{item.username}
                      </a>
                      <div className="flex items-center gap-2">
                        <div className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 px-2 py-1 rounded-md border ${item.daysAgo > 180 ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-white/5 text-gray-400 border-white/10'}`}>
                          <Clock size={10} /> {item.daysAgo}d
                        </div>
                        <button onClick={() => navigator.clipboard.writeText(item.username)} className="opacity-0 group-hover:opacity-100 p-1.5 bg-white/5 hover:bg-white/10 active:scale-90 rounded-lg text-gray-400 hover:text-white transition-all border border-white/5">
                          <Copy size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-30">
            <Calendar size={32} className="mb-4 opacity-50" />
            <span className="text-sm font-medium text-white">No requests match query</span>
          </div>
        )}
      </div>
    </div>
  );
}
const filteredCount = (data, searchTerm) => data.filter(d => d.searchString.includes(searchTerm)).length;