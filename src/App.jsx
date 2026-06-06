import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Search, Check, Copy, Clock, ArrowUpDown, History, Users } from 'lucide-react';
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

  const [sortConfig, setSortConfig] = useState({
    notFollowingBack: { type: 'alpha', dir: 'asc' },
    stillConnected: { type: 'alpha', dir: 'asc' },
    disconnected: { type: 'alpha', dir: 'asc' },
    pending: { type: 'time', dir: 'asc' }
  });

  const triggerToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const cycleSort = (key) => {
    setSortConfig(prev => ({
      ...prev,
      [key]: { type: prev[key].type, dir: prev[key].dir === 'asc' ? 'desc' : 'asc' }
    }));
  };

  const getSortedData = (data, key) => {
    const { type, dir } = sortConfig[key];
    return [...data].sort((a, b) => {
      if (type === 'time') return dir === 'asc' ? a.daysAgo - b.daysAgo : b.daysAgo - a.daysAgo;
      const nameA = a.username || a; const nameB = b.username || b;
      return dir === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    });
  };

  const processFile = (data, type) => {
    let users = [];
    const list = type.includes('following') ? (data.relationships_following || []) : (Array.isArray(data) ? data : []);
    users = list.map(item => (item.title || item.string_list_data?.[0]?.value)?.toLowerCase());
    return [...new Set(users.filter(u => u))];
  };

  const handleProcess = async () => {
    setIsProcessing(true);
    const readJson = (file) => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(JSON.parse(e.target.result));
      reader.readAsText(file);
    });

    try {
      const newResults = {};

      // 1. Process Current Lists
      const currFollowing = files.currFollowing ? processFile(await readJson(files.currFollowing), 'following') : [];
      const currFollowers = files.currFollowers ? processFile(await readJson(files.currFollowers), 'followers') : [];
      const currentCombined = new Set([...currFollowing, ...currFollowers]);

      // 2. Process Old Lists
      const oldFollowing = files.oldFollowing ? processFile(await readJson(files.oldFollowing), 'following') : [];
      const oldFollowers = files.oldFollowers ? processFile(await readJson(files.oldFollowers), 'followers') : [];
      const oldCombined = new Set([...oldFollowing, ...oldFollowers]);

      // 3. Comparisons
      if (files.currFollowing && files.currFollowers) {
        newResults.notFollowingBack = currFollowing.filter(u => !currFollowers.includes(u));
      }

      if (files.oldFollowing || files.oldFollowers) {
        newResults.stillConnected = [...oldCombined].filter(u => currentCombined.has(u));
        newResults.disconnected = [...oldCombined].filter(u => !currentCombined.has(u));
      }

      if (files.pending) {
        const pendingData = await readJson(files.pending);
        newResults.pending = pendingData.map(item => ({
          username: item.label_values?.find(l => l.label === 'Username')?.value?.toLowerCase(),
          daysAgo: Math.floor((Date.now() / 1000 - item.timestamp) / 86400)
        })).filter(u => u.username);
      }

      setResults(newResults);
      triggerToast('Comparison complete!');
    } catch (e) { console.error(e); triggerToast('Error parsing JSON.'); }
    finally { setIsProcessing(false); }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white p-6 md:p-12 font-sans">
      <div className="text-center space-y-4 mb-10">
        <img src={AppLogo} alt="Network Audit Logo" className="mx-auto w-32 h-32" />
        <h1 className="text-5xl font-extrabold tracking-tighter bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">Network Intelligence</h1>
      </div>

      <div className="grid md:grid-cols-5 gap-4 max-w-7xl mx-auto">
        {[
          { key: 'currFollowing', label: 'New Following' },
          { key: 'currFollowers', label: 'New Followers' },
          { key: 'oldFollowing', label: 'Old Following' },
          { key: 'oldFollowers', label: 'Old Followers' },
          { key: 'pending', label: 'Pending' }
        ].map((item) => (
          <label key={item.key} className={`border-2 border-dashed rounded-3xl p-4 bg-white/5 transition-all cursor-pointer text-center ${files[item.key] ? 'border-emerald-500/50' : 'border-white/10 hover:border-cyan-500'}`}>
            <input type="file" className="hidden" onChange={(e) => setFiles(prev => ({ ...prev, [item.key]: e.target.files[0] }))} />
            <div className="flex flex-col items-center gap-2">
              {files[item.key] ? <Check size={16} className="text-emerald-500" /> : <Upload size={16} className="text-gray-500" />}
              <p className="font-bold text-xs capitalize">{item.label}</p>
            </div>
          </label>
        ))}
      </div>

      <button onClick={handleProcess} className="max-w-7xl mx-auto w-full mt-8 py-4 rounded-2xl bg-cyan-600 font-bold hover:bg-cyan-500 transition-all">Analyze Intelligence</button>

      {results && (
        <div className="max-w-7xl mx-auto mt-8 space-y-8">
          <input type="text" placeholder="Search usernames..." onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4" />
          <div className="grid md:grid-cols-4 gap-4">
            {results.stillConnected && <StandardCard title="Still Connected" data={getSortedData(results.stillConnected.filter(u => u.includes(searchTerm)), 'stillConnected')} sort={sortConfig.stillConnected} onSort={() => cycleSort('stillConnected')} color="emerald" />}
            {results.disconnected && <StandardCard title="Disconnected" data={getSortedData(results.disconnected.filter(u => u.includes(searchTerm)), 'disconnected')} sort={sortConfig.disconnected} onSort={() => cycleSort('disconnected')} color="rose" />}
            {results.notFollowingBack && <StandardCard title="Not Following Back" data={getSortedData(results.notFollowingBack.filter(u => u.includes(searchTerm)), 'notFollowingBack')} sort={sortConfig.notFollowingBack} onSort={() => cycleSort('notFollowingBack')} color="orange" />}
            {results.pending && <StandardCard title="Pending" data={getSortedData(results.pending.filter(p => p.username.includes(searchTerm.toLowerCase())), 'pending')} sort={sortConfig.pending} onSort={() => cycleSort('pending')} color="purple" isPending={true} />}
          </div>
        </div>
      )}
    </div>
  );
}

function StandardCard({ title, data, color, isPending, sort, onSort }) {
  const styles = {
    rose: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    orange: "bg-orange-500/10 text-orange-400 border-orange-500/20"
  };
  return (
    <div className={`border rounded-3xl p-6 h-[500px] flex flex-col ${styles[color]}`}>
      <div className="mb-4 font-bold text-lg flex items-center justify-between">
        <div className="flex items-center gap-2">{title} <span className="text-xs opacity-50 bg-white/10 px-2 py-1 rounded-full">{data.length}</span></div>
        <button onClick={onSort} className="bg-white/5 hover:bg-white/10 px-2 py-1 rounded-lg text-[10px] uppercase">
          {sort.dir === 'asc' ? 'A-Z' : 'Z-A'} <ArrowUpDown size={10} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2">
        {data.map((item, i) => {
          const username = isPending ? item.username : item;
          return (
            <div key={i} className="flex justify-between items-center bg-white/5 p-3 rounded-xl hover:bg-white/10 transition-all">
              <span className="text-sm truncate mr-2">@{username}</span>
              {isPending && <div className="text-[10px] opacity-50"><Clock size={10} /> {item.daysAgo}d</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}