import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, Search, Check, Copy, Clock, ArrowUpDown, ArrowRightLeft,
  Users, History, Send, UserMinus, Star, UserCheck, Link as LinkIcon, Unlink, FileJson, Calendar, Activity,
  ChevronRight, ShieldCheck, BarChart3, Zap
} from 'lucide-react';
import AppLogo from './assets/logo.png';

function VirtualList({ items, itemHeight, renderItem, className, stickyIndices = [] }) {
  const [scrollTop, setScrollTop] = useState(0);
  const [clientHeight, setClientHeight] = useState(600); // Default fallback
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

  // Determine active sticky header
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

export default function App() {
  const [appStarted, setAppStarted] = useState(false);
  const [files, setFiles] = useState({
    currFollowing: null, currFollowers: null,
    oldFollowing: null, oldFollowers: null,
    pending: null, recentRequests: null, recentUnfollowed: null,
    compOldFollowing: null, compNewFollowing: null
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
    compOnlyNew: { type: 'alpha', dir: 'asc' }
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

    // 1. Handle all possible Instagram JSON structures
    let rawList = [];
    if (Array.isArray(data)) {
      rawList = data;
    } else {
      rawList = data.relationships_following ||
        data.relationships_followers ||
        data.followers ||
        data.following ||
        [];
    }

    const items = rawList.map((item, idx) => {
      // 2. Safely extract, lowercase, AND trim invisible spaces
      let username = (item.title || item.string_list_data?.[0]?.value);
      if (username) {
        username = username.toLowerCase().trim();
      }

      const href = item.string_list_data?.[0]?.href || '#';
      if (username) tempLinks[username] = href;

      return username ? { username, href, fileIndex: idx } : null;
    }).filter(Boolean);

    setUserLinks(prev => ({ ...prev, ...tempLinks }));
    return items;
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

      const searchString = `${username} ${isoDate} ${prettyDate}`.toLowerCase();

      return username ? { username, daysAgo, fileIndex: idx, isoDate, prettyDate, searchString, timestamp: unixTime } : null;
    }).filter(Boolean);
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
      console.log("New Followers Loaded:", processed.currFollowers?.length || 0);

      if (processed.currFollowing && processed.currFollowers) {
        const activeFollowersSet = new Set(processed.currFollowers.map(u => u.username));
        const activeFollowingSet = new Set(processed.currFollowing.map(u => u.username));
        outResults.notFollowingBack = processed.currFollowing.filter(u => !activeFollowersSet.has(u.username));
        outResults.fans = processed.currFollowers.filter(u => !activeFollowingSet.has(u.username));
        outResults.mutuals = processed.currFollowing.filter(u => activeFollowersSet.has(u.username));
      }

      if (processed.oldFollowing || processed.oldFollowers) {
        // FIX: Ensure we actually have the new files to compare against!
        // Without this, if new files are missing, everyone incorrectly goes to "Disconnected".
        if (!processed.currFollowing && !processed.currFollowers) {
          triggerToast('Upload current Following & Followers to use the Time Machine.');
        } else {
          // 1. Create a massive pool of EVERYONE in the new files (both following & followers)
          const currentActivePool = new Set([
            ...(processed.currFollowing?.map(u => u.username) || []),
            ...(processed.currFollowers?.map(u => u.username) || [])
          ]);

          // 2. Create a massive pool of EVERYONE in the old files (removing duplicates)
          const combinedOldMap = new Map();
          [...(processed.oldFollowing || []), ...(processed.oldFollowers || [])].forEach(item => {
            if (!combinedOldMap.has(item.username)) combinedOldMap.set(item.username, item);
          });
          const distinctOldItems = Array.from(combinedOldMap.values());

          // 3. Cross-check: If the old user exists anywhere in the new pool, they are still connected.
          outResults.stillConnected = distinctOldItems.filter(u => currentActivePool.has(u.username));

          // 4. If the old user is nowhere to be found in the new pool, they are disconnected.
          outResults.disconnected = distinctOldItems.filter(u => !currentActivePool.has(u.username));
        }
      }

      if (files.pending) {
        outResults.pending = parseTemporalJsonFile(await loadJson(files.pending));
      }
      if (files.recentRequests) {
        outResults.recentRequests = parseTemporalJsonFile(await loadJson(files.recentRequests));
      }
      if (files.recentUnfollowed) {
        outResults.recentUnfollowed = parseTemporalJsonFile(await loadJson(files.recentUnfollowed));
      }

      const compOldFile = files.compOldFollowing || files.oldFollowing;
      const compNewFile = files.compNewFollowing || files.currFollowing;
      if (compOldFile && compNewFile) {
        const compOldList = parseJsonFile(await loadJson(compOldFile), 'following');
        const compNewList = parseJsonFile(await loadJson(compNewFile), 'following');
        const compOldSet = new Set(compOldList.map(u => u.username));
        const compNewSet = new Set(compNewList.map(u => u.username));
        outResults.compCommon = compNewList.filter(u => compOldSet.has(u.username));
        outResults.compOnlyOld = compOldList.filter(u => !compNewSet.has(u.username));
        outResults.compOnlyNew = compNewList.filter(u => !compOldSet.has(u.username));
      }

      setResults(outResults);

      const hasCore = files.currFollowing && files.currFollowers;
      const hasHistory = files.oldFollowing || files.oldFollowers;
      const hasActivity = files.pending || files.recentRequests || files.recentUnfollowed;
      const hasComparison = files.compOldFollowing || files.compNewFollowing;

      if (hasCore && !hasHistory && !hasActivity && !hasComparison) setActiveTab('core');
      else if (hasHistory && !hasCore && !hasActivity && !hasComparison) setActiveTab('history');
      else if (hasActivity && !hasCore && !hasHistory && !hasComparison) setActiveTab('activity');
      else if (hasComparison && !hasCore && !hasHistory && !hasActivity) setActiveTab('comparison');

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
    <div className="h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-emerald-950 animate-gradient text-white p-4 md:p-6 font-sans selection:bg-white/30 overflow-hidden relative flex flex-col">
      {/* Decorative Blobs for Glass Refraction */}
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
            <AnimatePresence>
              {toast && (
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="fixed top-5 right-5 bg-white/10 backdrop-blur-3xl px-6 py-3 rounded-2xl z-50 flex items-center gap-2 shadow-2xl shadow-black/50 border border-white/20 font-medium text-white">
                  <Check size={18} />{toast}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="max-w-6xl mx-auto flex flex-col min-h-0 h-full w-full gap-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="text-center flex-shrink-0">
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tighter bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent flex items-center justify-center gap-4">
                  <img src={AppLogo} alt="Logo" className="w-20 h-20 drop-shadow-2xl select-none pointer-events-none" />
                  Network Intelligence
                </h1>
              </motion.div>

              {/* Data Ingestion moved to Modal popup */}

              {hasActiveResults && (
                <div className="flex-1 flex flex-col min-h-0 gap-4">
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-end gap-4 bg-white/10 p-2 rounded-3xl border border-white/20 z-40 backdrop-blur-3xl shadow-2xl shadow-black/50 flex-shrink-0">
                    <div className="relative w-full group">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-cyan-400 transition-colors" size={16} />
                      <input
                        type="text"
                        placeholder={activeTab === 'activity' ? "Search by handle, year, or month..." : "Filter current view..."}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value.toLowerCase())}
                        className="w-full bg-black/20 border border-white/10 rounded-2xl pl-10 pr-4 py-2 outline-none focus:border-white/30 text-sm transition-all placeholder:text-gray-400 focus:bg-white/10 focus:shadow-inner text-white shadow-inner"
                      />
                    </div>
                  </motion.div>

                  {/* Navbar moved to root to fix scrolling issue */}

                  <AnimatePresence mode="wait">
                    {activeTab === 'core' && (
                      <motion.div key="core" variants={containerVariants} initial="hidden" animate="show" exit="exit" className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-0">
                        <motion.div variants={itemVariants} className="h-full min-h-0 flex flex-col">
                          {results.notFollowingBack ? <StandardCard title="Not Following Back" icon={UserMinus} data={results.notFollowingBack.filter(u => u.username.includes(searchTerm))} sort={sortConfig.notFollowingBack} onSort={() => cycleSort('notFollowingBack')} color="rose" links={userLinks} /> : <EmptyState icon={UserMinus} title="No Core Data" message="Upload Current Following & Followers to view this metric." color="rose" />}
                        </motion.div>
                        <motion.div variants={itemVariants} className="h-full min-h-0 flex flex-col">
                          {results.fans ? <StandardCard title="Fans" icon={Star} data={results.fans.filter(u => u.username.includes(searchTerm))} sort={sortConfig.fans} onSort={() => cycleSort('fans')} color="cyan" links={userLinks} /> : <EmptyState icon={Star} title="No Core Data" message="Upload Current Following & Followers to view this metric." color="cyan" />}
                        </motion.div>
                        <motion.div variants={itemVariants} className="h-full min-h-0 flex flex-col">
                          {results.mutuals ? <StandardCard title="Mutuals" icon={UserCheck} data={results.mutuals.filter(u => u.username.includes(searchTerm))} sort={sortConfig.mutuals} onSort={() => cycleSort('mutuals')} color="emerald" links={userLinks} /> : <EmptyState icon={UserCheck} title="No Core Data" message="Upload Current Following & Followers to view this metric." color="emerald" />}
                        </motion.div>
                      </motion.div>
                    )}

                    {activeTab === 'history' && (
                      <motion.div key="history" variants={containerVariants} initial="hidden" animate="show" exit="exit" className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto w-full flex-1 min-h-0">
                        <motion.div variants={itemVariants} className="h-full min-h-0 flex flex-col">
                          {results.stillConnected ? <StandardCard title="Still Connected" icon={LinkIcon} data={results.stillConnected.filter(u => u.username.includes(searchTerm))} sort={sortConfig.stillConnected} onSort={() => cycleSort('stillConnected')} color="teal" links={userLinks} /> : <EmptyState icon={LinkIcon} title="No Historical Data" message="Upload Old & Current files to track network stability." color="teal" />}
                        </motion.div>
                        <motion.div variants={itemVariants} className="h-full min-h-0 flex flex-col">
                          {results.disconnected ? <StandardCard title="Disconnected" icon={Unlink} data={results.disconnected.filter(u => u.username.includes(searchTerm))} sort={sortConfig.disconnected} onSort={() => cycleSort('disconnected')} color="orange" links={userLinks} /> : <EmptyState icon={Unlink} title="No Historical Data" message="Upload Old & Current files to track account drift." color="orange" />}
                        </motion.div>
                      </motion.div>
                    )}

                    {activeTab === 'activity' && (
                      <motion.div key="activity" variants={containerVariants} initial="hidden" animate="show" exit="exit" className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-0">
                        {results.pending && (
                          <motion.div variants={itemVariants} className="h-full min-h-0 flex flex-col">
                            <GroupedPendingCard title="Pending Requests" icon={Send} data={results.pending} searchTerm={searchTerm} sort={sortConfig.pending} onSort={() => cycleSort('pending')} color="purple" links={userLinks} />
                          </motion.div>
                        )}
                        {results.recentRequests && (
                          <motion.div variants={itemVariants} className="h-full min-h-0 flex flex-col">
                            <GroupedPendingCard title="Recent Follow Req." icon={Clock} data={results.recentRequests} searchTerm={searchTerm} sort={sortConfig.recentRequests} onSort={() => cycleSort('recentRequests')} color="cyan" links={userLinks} />
                          </motion.div>
                        )}
                        {results.recentUnfollowed && (
                          <motion.div variants={itemVariants} className="h-full min-h-0 flex flex-col">
                            <GroupedPendingCard title="Recent Unfollowed" icon={UserMinus} data={results.recentUnfollowed} searchTerm={searchTerm} sort={sortConfig.recentUnfollowed} onSort={() => cycleSort('recentUnfollowed')} color="rose" links={userLinks} />
                          </motion.div>
                        )}
                        {!results.pending && !results.recentRequests && !results.recentUnfollowed && (
                          <motion.div variants={itemVariants} className="col-span-3 h-full min-h-0 flex flex-col max-w-2xl mx-auto w-full">
                            <EmptyState icon={Activity} title="No Activity Data" message="Upload Pending Requests, Recent Requests, or Recent Unfollowed JSON to view history." color="purple" />
                          </motion.div>
                        )}
                      </motion.div>
                    )}
{activeTab === 'comparison' && (
                      <motion.div key="comparison" variants={containerVariants} initial="hidden" animate="show" exit="exit" className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-0">
                        <motion.div variants={itemVariants} className="h-full min-h-0 flex flex-col">
                          {results.compCommon ? <StandardCard title="Common" icon={LinkIcon} data={results.compCommon.filter(u => u.username.includes(searchTerm))} sort={sortConfig.compCommon} onSort={() => cycleSort('compCommon')} color="emerald" links={userLinks} /> : <EmptyState icon={LinkIcon} title="No Comparison Data" message="Upload two Following files to find shared usernames." color="emerald" />}
                        </motion.div>
                        <motion.div variants={itemVariants} className="h-full min-h-0 flex flex-col">
                          {results.compOnlyOld ? <StandardCard title="Only in Old" icon={History} data={results.compOnlyOld.filter(u => u.username.includes(searchTerm))} sort={sortConfig.compOnlyOld} onSort={() => cycleSort('compOnlyOld')} color="orange" links={userLinks} /> : <EmptyState icon={History} title="No Comparison Data" message="Upload two Following files to find old-only usernames." color="orange" />}
                        </motion.div>
                        <motion.div variants={itemVariants} className="h-full min-h-0 flex flex-col">
                          {results.compOnlyNew ? <StandardCard title="Only in New" icon={Zap} data={results.compOnlyNew.filter(u => u.username.includes(searchTerm))} sort={sortConfig.compOnlyNew} onSort={() => cycleSort('compOnlyNew')} color="cyan" links={userLinks} /> : <EmptyState icon={Zap} title="No Comparison Data" message="Upload two Following files to find new-only usernames." color="cyan" />}
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {appStarted && (
          <motion.div 
            initial={{ opacity: 0, x: -20 }} 
            animate={{ opacity: 1, x: 0 }} 
            exit={{ opacity: 0, x: -20 }}
            className="fixed left-4 top-4 flex flex-col gap-2 p-2 bg-black/40 backdrop-blur-3xl rounded-2xl border border-white/10 shadow-2xl z-50 group hover:bg-black/60 transition-all duration-300"
          >
            <NavTab id="upload" icon={<Upload size={20} />} label="Data Ingestion" active={showUploadModal ? 'upload' : null} set={() => setShowUploadModal(true)} />
            {hasActiveResults && (
              <>
                <NavTab id="core" icon={<Users size={20} />} label="Core Network" active={!showUploadModal ? activeTab : null} set={(id) => { setActiveTab(id); setShowUploadModal(false); }} />
                <NavTab id="history" icon={<History size={20} />} label="Time Machine" active={!showUploadModal ? activeTab : null} set={(id) => { setActiveTab(id); setShowUploadModal(false); }} />
                <NavTab id="activity" icon={<Activity size={20} />} label="Activity Log" active={!showUploadModal ? activeTab : null} set={(id) => { setActiveTab(id); setShowUploadModal(false); }} />
                <NavTab id="comparison" icon={<ArrowRightLeft size={20} />} label="Comparison" active={!showUploadModal ? activeTab : null} set={(id) => { setActiveTab(id); setShowUploadModal(false); }} />
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload Modal Popup */}
      <AnimatePresence>
        {showUploadModal && appStarted && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
            onClick={(e) => {
              if (e.target === e.currentTarget && hasActiveResults) setShowUploadModal(false);
            }}
          >
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="w-full max-w-5xl">
              <div className="bg-[#0a0a0a]/90 p-8 rounded-3xl border border-white/20 shadow-2xl shadow-black/50 space-y-6 backdrop-blur-3xl relative">
                <div className="flex justify-between items-center px-2">
                  <h2 className="text-lg font-bold text-gray-200 tracking-widest uppercase flex items-center gap-2">
                    <FileJson size={20} className="text-emerald-500" /> Data Ingestion
                  </h2>
                  {hasActiveResults && (
                    <button onClick={() => setShowUploadModal(false)} className="text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 px-4 py-1.5 rounded-full text-xs font-bold uppercase transition-all border border-white/10 shadow-inner">Close</button>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                  {[
                    { id: 'currFollowing', name: 'New Following' },
                    { id: 'currFollowers', name: 'New Followers' },
                    { id: 'oldFollowing', name: 'Old Following' },
                    { id: 'oldFollowers', name: 'Old Followers' },
                    { id: 'pending', name: 'Pending Req' },
                    { id: 'recentRequests', name: 'Recent Req' },
                    { id: 'recentUnfollowed', name: 'Recent Unfollowed' },
                  ].map((fileConfig) => (
                    <FileUploadZone key={fileConfig.id} id={fileConfig.id} name={fileConfig.name} file={files[fileConfig.id]} setFile={handleSetFile} />
                  ))}
                </div>

                <div className="flex items-center gap-3">
                  <span className="h-px flex-1 bg-white/10" />
                  <span className="text-xs font-bold tracking-widest uppercase text-cyan-300 flex items-center gap-2"><ArrowRightLeft size={14} /> Following Comparison</span>
                  <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">(independent, old vs new)</span>
                  <span className="h-px flex-1 bg-white/10" />
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-7 gap-3">
                  {[
                    { id: 'compOldFollowing', name: 'Comp. Old Following' },
                    { id: 'compNewFollowing', name: 'Comp. New Following' },
                  ].map((fileConfig) => (
                    <FileUploadZone key={fileConfig.id} id={fileConfig.id} name={fileConfig.name} file={files[fileConfig.id]} setFile={handleSetFile} />
                  ))}
                </div>
                <button onClick={handleProcess} disabled={isProcessing} className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-600 to-emerald-600 font-bold hover:from-cyan-500 hover:to-emerald-500 shadow-lg shadow-cyan-900/10 hover:shadow-cyan-500/20 hover:-translate-y-0.5 transition-all active:translate-y-0 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 text-lg">
                  {isProcessing ? 'Compiling...' : (hasActiveResults ? <><ArrowRightLeft size={20} /> Update Analysis</> : 'Analyze Selection')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- LANDING PAGE COMPONENT ---
function LandingPage({ onStart }) {
  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center max-w-5xl mx-auto space-y-10 relative z-10">
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
  const colorMap = {
    cyan: "text-cyan-400",
    emerald: "text-emerald-400",
    purple: "text-purple-400"
  };
  return (
    <div className="bg-white/5 border border-white/10 backdrop-blur-3xl rounded-3xl p-6 shadow-2xl hover:bg-white/10 hover:border-white/20 transition-all duration-300 hover:-translate-y-1 group">
      <div className={`w-12 h-12 rounded-2xl bg-black/20 border border-white/10 shadow-inner flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}>
        <Icon size={24} className={`${colorMap[color]} drop-shadow-md`} />
      </div>
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
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
      className={`relative border border-dashed rounded-3xl p-3 transition-all duration-300 ease-out flex flex-col justify-center items-center h-28 overflow-hidden group ${isDragging
        ? 'border-white/50 bg-white/20 scale-[1.02] z-10 shadow-2xl shadow-black/50 backdrop-blur-3xl'
        : file
          ? 'border-emerald-500/50 bg-emerald-500/20 shadow-lg backdrop-blur-2xl'
          : 'border-white/10 bg-black/20 hover:border-white/30 hover:bg-black/10 shadow-inner'
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
    <button onClick={() => set(id)} className={`relative flex items-center p-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap z-10 overflow-hidden ${isActive ? 'text-white' : 'text-gray-500 hover:text-white'}`}>
      {isActive && <motion.div layoutId="activeTabIndicator" className="absolute inset-0 bg-white/10 rounded-xl -z-10 shadow-inner border border-white/10" transition={{ type: "tween", ease: "easeInOut", duration: 0.2 }} />}
      <div className="flex-shrink-0 z-10 relative">{icon}</div>
      <div className="max-w-0 opacity-0 overflow-hidden group-hover:max-w-[150px] group-hover:opacity-100 transition-all duration-300 ease-out flex-shrink-0 flex items-center">
        <span className="pl-3">{label}</span>
      </div>
    </button>
  );
}

function EmptyState({ icon: Icon, title, message, color }) {
  const colorMap = {
    rose: "bg-white/10 text-white border-white/20 shadow-2xl backdrop-blur-2xl",
    cyan: "bg-white/10 text-white border-white/20 shadow-2xl backdrop-blur-2xl",
    emerald: "bg-white/10 text-white border-white/20 shadow-2xl backdrop-blur-2xl",
    teal: "bg-white/10 text-white border-white/20 shadow-2xl backdrop-blur-2xl",
    orange: "bg-white/10 text-white border-white/20 shadow-2xl backdrop-blur-2xl",
    purple: "bg-white/10 text-white border-white/20 shadow-2xl backdrop-blur-2xl"
  };

  return (
    <div className={`border rounded-3xl p-6 h-[500px] flex flex-col items-center justify-center text-center ${colorMap[color]}`}>
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 bg-black/20 shadow-inner border border-white/10"><Icon size={28} className="opacity-80" /></div>
      <h3 className="font-bold text-lg mb-2 text-white">{title}</h3>
      <p className="text-sm opacity-70 max-w-[200px]">{message}</p>
    </div>
  );
}

function StandardCard({ title, icon: Icon, data, sort, onSort, color, links }) {
  const styles = {
    rose: "bg-white/10 text-white border-white/20 shadow-2xl backdrop-blur-2xl hover:border-white/30 hover:bg-white/[0.12]",
    cyan: "bg-white/10 text-white border-white/20 shadow-2xl backdrop-blur-2xl hover:border-white/30 hover:bg-white/[0.12]",
    emerald: "bg-white/10 text-white border-white/20 shadow-2xl backdrop-blur-2xl hover:border-white/30 hover:bg-white/[0.12]",
    teal: "bg-white/10 text-white border-white/20 shadow-2xl backdrop-blur-2xl hover:border-white/30 hover:bg-white/[0.12]",
    orange: "bg-white/10 text-white border-white/20 shadow-2xl backdrop-blur-2xl hover:border-white/30 hover:bg-white/[0.12]"
  };

  const getSortBadgeLabel = () => sort.type === 'alpha' ? (sort.dir === 'asc' ? 'A-Z' : 'Z-A') : (sort.dir === 'asc' ? 'Oldest' : 'Newest');

  const sortedItems = useMemo(() => {
    return [...data].sort((a, b) => {
      if (sort.type === 'alpha') return sort.dir === 'asc' ? a.username.localeCompare(b.username) : b.username.localeCompare(a.username);
      return sort.dir === 'asc' ? b.fileIndex - a.fileIndex : a.fileIndex - b.fileIndex;
    });
  }, [data, sort]);

  const renderRow = (item, index) => {
    if (!item) return null;
    return (
      <div className="py-1 h-full">
        <div className="flex justify-between items-center h-full bg-black/20 hover:bg-white/10 px-3.5 rounded-2xl border border-white/5 hover:border-white/20 hover:shadow-lg transition-all duration-300 ease-out group">
          <a href={links[item.username] || `https://instagram.com/${item.username}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium tracking-tight text-gray-400 group-hover:text-white group-hover:translate-x-1 transform transition-all duration-200 truncate max-w-[70%]">
            @{item.username}
          </a>
          <button onClick={() => navigator.clipboard.writeText(item.username)} className="opacity-0 group-hover:opacity-100 p-1.5 bg-white/5 hover:bg-white/10 active:scale-90 rounded-lg text-gray-400 hover:text-white transition-all shadow-sm border border-white/5">
            <Copy size={13} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className={`border rounded-3xl p-5 h-full flex flex-col min-h-0 transition-all duration-300 ease-out hover:-translate-y-1 ${styles[color]}`}>
      <div className="mb-5 flex items-center justify-between pb-4 border-b border-white/5 flex-shrink-0">
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

      <div className="flex-1 overflow-hidden pr-2 min-h-0">
        {data.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-30"><span className="text-sm font-medium text-white">List is empty</span></div>
        ) : (
          <VirtualList
            items={sortedItems}
            itemHeight={60}
            renderItem={renderRow}
            className="custom-scrollbar pr-2"
          />
        )}
      </div>
    </div>
  );
}

// --- NEW COMPONENT: Outbound Temporal Matrix ---
function GroupedPendingCard({ title, icon: Icon, data, sort, onSort, color, links, searchTerm }) {
  const styles = {
    purple: "bg-white/10 text-white border-white/20 shadow-2xl backdrop-blur-2xl hover:border-white/30 hover:bg-white/[0.12]"
  };

  const getSortBadgeLabel = () => sort.type === 'alpha' ? (sort.dir === 'asc' ? 'A-Z' : 'Z-A') : (sort.dir === 'asc' ? 'Oldest First' : 'Newest First');

  const { flattenedData, totalCount, stickyIndices } = useMemo(() => {
    const filtered = data.filter(item => item.searchString.includes(searchTerm));

    const groups = filtered.reduce((acc, item) => {
      if (!acc[item.isoDate]) {
        acc[item.isoDate] = { prettyDate: item.prettyDate, timestamp: item.timestamp, items: [] };
      }
      acc[item.isoDate].items.push(item);
      return acc;
    }, {});

    const sortedGroupKeys = Object.keys(groups).sort((a, b) => {
      const timeA = groups[a].timestamp;
      const timeB = groups[b].timestamp;
      return sort.type === 'time' && sort.dir === 'asc' ? timeA - timeB : timeB - timeA;
    });

    sortedGroupKeys.forEach(key => {
      groups[key].items.sort((a, b) => {
        if (sort.type === 'alpha') return sort.dir === 'asc' ? a.username.localeCompare(b.username) : b.username.localeCompare(a.username);
        return sort.dir === 'asc' ? a.timestamp - b.timestamp : b.timestamp - a.timestamp;
      });
    });

    const flat = [];
    const stickyIndices = [];
    sortedGroupKeys.forEach(key => {
      const group = groups[key];
      stickyIndices.push(flat.length);
      flat.push({ type: 'header', prettyDate: group.prettyDate, count: group.items.length, dateKey: key });
      group.items.forEach(item => {
        flat.push({ type: 'item', ...item });
      });
    });

    return { flattenedData: flat, totalCount: filtered.length, stickyIndices };
  }, [data, sort, searchTerm]);

  const renderRow = (dataItem, index) => {
    if (!dataItem) return null;

    if (dataItem.type === 'header') {
      return (
        <div className="py-1 h-full">
          <div className="bg-black/40 backdrop-blur-3xl h-full px-4 rounded-xl border border-white/10 flex justify-between items-center shadow-lg">
            <div className="flex items-center gap-2">
              <Calendar size={12} className="text-purple-500" />
              <span className="text-xs font-bold text-purple-400 uppercase tracking-widest">{dataItem.prettyDate}</span>
            </div>
            <span className="text-[10px] text-gray-500 font-semibold bg-white/5 px-2 py-0.5 rounded-md">{dataItem.count} requests</span>
          </div>
        </div>
      );
    }

    return (
      <div className="py-1 h-full">
        <div className="flex justify-between items-center h-full bg-black/20 hover:bg-white/10 px-4 rounded-2xl border border-white/5 hover:border-white/20 hover:shadow-lg transition-all duration-300 group">
          <a href={links[dataItem.username] || `https://instagram.com/${dataItem.username}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium tracking-tight text-gray-400 group-hover:text-white group-hover:translate-x-1 transform transition-all duration-200 truncate max-w-[70%]">
            @{dataItem.username}
          </a>
          <div className="flex items-center gap-2">
            <div className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 px-2 py-1 rounded-md border ${dataItem.daysAgo > 180 ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-white/5 text-gray-400 border-white/10'}`}>
              <Clock size={10} /> {dataItem.daysAgo}d
            </div>
            <button onClick={() => navigator.clipboard.writeText(dataItem.username)} className="opacity-0 group-hover:opacity-100 p-1.5 bg-white/5 hover:bg-white/10 active:scale-90 rounded-lg text-gray-400 hover:text-white transition-all border border-white/5">
              <Copy size={13} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`border rounded-3xl p-5 h-full flex flex-col min-h-0 transition-all duration-300 ease-out hover:-translate-y-1 ${styles[color] || styles.purple}`}>
      <div className="mb-5 flex items-center justify-between pb-4 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-white/5 shadow-inner transition-transform duration-300 hover:scale-105">
            <Icon size={18} />
          </div>
          <div>
            <span className="font-bold text-lg text-white tracking-tight block leading-none">{title}</span>
            <span className="text-[11px] font-semibold text-gray-500 tracking-wider uppercase mt-1 block">{totalCount} Total Requests</span>
          </div>
        </div>
        <button onClick={onSort} className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 active:scale-95 px-3 py-1.5 rounded-xl transition-all text-[10px] font-bold tracking-wider uppercase text-white shadow-inner border border-white/[0.02]">
          <span>{getSortBadgeLabel()}</span><ArrowUpDown size={12} className="opacity-60" />
        </button>
      </div>

      <div className="flex-1 overflow-hidden pr-2 min-h-0">
        {flattenedData.length > 0 ? (
          <VirtualList
            items={flattenedData}
            itemHeight={64}
            renderItem={renderRow}
            className="custom-scrollbar pr-2"
            stickyIndices={stickyIndices}
          />
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