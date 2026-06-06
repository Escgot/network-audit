import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Search, Check, Copy, Clock, ArrowUpDown } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

export default function App() {
  const [files, setFiles] = useState({ following: null, followers: null, pending: null });
  const [results, setResults] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [userLinks, setUserLinks] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState(null);

  // Sorting state for each card
  const [sortConfig, setSortConfig] = useState({
    notFollowingBack: 'asc',
    fans: 'asc',
    mutuals: 'asc',
    pending: 'oldest' // Default for pending is oldest first
  });

  const triggerToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const toggleSort = (key) => {
    setSortConfig(prev => ({
      ...prev,
      [key]: key === 'pending'
        ? (prev[key] === 'oldest' ? 'newest' : 'oldest')
        : (prev[key] === 'asc' ? 'desc' : 'asc')
    }));
  };

  // Sorting helper
  const getSortedData = (data, key) => {
    const order = sortConfig[key];
    if (key === 'pending') {
      return [...data].sort((a, b) => order === 'oldest' ? a.daysAgo - b.daysAgo : b.daysAgo - a.daysAgo);
    }
    return [...data].sort((a, b) => order === 'asc' ? a.localeCompare(b) : b.localeCompare(a));
  };

  const processFile = (data, type) => {
    const tempLinks = { ...userLinks };
    let users = [];
    if (type === 'following') {
      const list = data.relationships_following || [];
      users = list.map(item => {
        const username = item.title?.toLowerCase();
        if (username) tempLinks[username] = item.string_list_data?.[0]?.href || '#';
        return username;
      });
    } else if (type === 'followers') {
      const list = Array.isArray(data) ? data : [];
      users = list.map(item => {
        const username = item.string_list_data?.[0]?.value?.toLowerCase();
        if (username) tempLinks[username] = item.string_list_data?.[0]?.href || '#';
        return username;
      });
    }
    setUserLinks(prev => ({ ...prev, ...tempLinks }));
    return [...new Set(users.filter(u => u))];
  };

  const processPending = (data) => {
    return data.map(item => {
      const username = item.label_values?.find(l => l.label === 'Username')?.value?.toLowerCase();
      const daysAgo = Math.floor((Date.now() / 1000 - item.timestamp) / 86400);
      return { username, daysAgo };
    }).filter(u => u.username);
  };

  const handleProcess = async () => {
    if (!files.following && !files.followers && !files.pending) return triggerToast('Please upload at least one file.');
    setIsProcessing(true);

    const readJson = (file) => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(JSON.parse(e.target.result));
      reader.readAsText(file);
    });

    try {
      const newResults = {};
      if (files.following && files.followers) {
        const followingData = await readJson(files.following);
        const followersData = await readJson(files.followers);
        const followingList = processFile(followingData, 'following');
        const followersList = processFile(followersData, 'followers');
        const followingSet = new Set(followingList);
        const followersSet = new Set(followersList);

        newResults.notFollowingBack = followingList.filter(u => !followersSet.has(u));
        newResults.fans = followersList.filter(u => !followingSet.has(u));
        newResults.mutuals = followingList.filter(u => followersSet.has(u));
      }
      if (files.pending) {
        const pendingData = await readJson(files.pending);
        newResults.pending = processPending(pendingData);
      }
      setResults(newResults);
      triggerToast('Analysis complete!');
    } catch (e) { console.error(e); triggerToast('Error parsing JSON.'); }
    finally { setIsProcessing(false); }
  };

  const chartData = results ? [
    { name: 'Not Following Back', value: (results.notFollowingBack || []).length, color: '#f43f5e' },
    { name: 'Fans', value: (results.fans || []).length, color: '#06b6d4' },
    { name: 'Mutuals', value: (results.mutuals || []).length, color: '#10b981' },
  ].filter(c => c.value > 0) : [];

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white p-6 md:p-12 font-sans">
      <AnimatePresence>
        {toast && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed top-5 right-5 bg-cyan-600 px-6 py-3 rounded-2xl z-50 flex items-center gap-2"><Check size={18} />{toast}</motion.div>}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto space-y-8">
        <h1 className="text-center text-5xl font-extrabold tracking-tighter bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">Network Intelligence</h1>

        <div className="grid md:grid-cols-3 gap-4">
          {['following', 'followers', 'pending'].map((type) => (
            <label key={type} className={`border-2 border-dashed rounded-3xl p-8 bg-white/5 transition-all cursor-pointer text-center ${files[type] ? 'border-emerald-500/50' : 'border-white/10 hover:border-cyan-500'}`}>
              <input type="file" className="hidden" onChange={(e) => setFiles(prev => ({ ...prev, [type]: e.target.files[0] }))} />
              <div className="flex flex-col items-center gap-2">
                {files[type] ? <Check className="text-emerald-500" /> : <Upload className="text-gray-500" />}
                <p className="font-bold capitalize">{type}.json</p>
                <p className="text-xs text-gray-500 truncate max-w-[150px]">{files[type]?.name || 'Click to select'}</p>
              </div>
            </label>
          ))}
        </div>

        <button onClick={handleProcess} className="w-full py-4 rounded-2xl bg-cyan-600 font-bold hover:bg-cyan-500 transition-all active:scale-[0.99]">Analyze Selection</button>

        {results && (
          <div className="space-y-8">
            {chartData.length > 0 && (
              <div className="bg-white/5 p-6 rounded-3xl border border-white/10 h-64 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chartData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                      {chartData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#000', borderRadius: '12px', border: 'none' }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            <input type="text" placeholder="Search usernames..." onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-cyan-500" />

            <div className="grid md:grid-cols-4 gap-6">
              {results.notFollowingBack && <StandardCard title="Not Following Back" id="notFollowingBack" data={getSortedData(results.notFollowingBack.filter(u => u.includes(searchTerm)), 'notFollowingBack')} links={userLinks} color="rose" onSort={() => toggleSort('notFollowingBack')} />}
              {results.fans && <StandardCard title="Fans" id="fans" data={getSortedData(results.fans.filter(u => u.includes(searchTerm)), 'fans')} links={userLinks} color="cyan" onSort={() => toggleSort('fans')} />}
              {results.mutuals && <StandardCard title="Mutuals" id="mutuals" data={getSortedData(results.mutuals.filter(u => u.includes(searchTerm)), 'mutuals')} links={userLinks} color="emerald" onSort={() => toggleSort('mutuals')} />}
              {results.pending && <StandardCard title="Pending" id="pending" data={getSortedData(results.pending.filter(p => p.username.includes(searchTerm.toLowerCase())), 'pending')} links={userLinks} color="purple" isPending={true} onSort={() => toggleSort('pending')} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StandardCard({ title, data, links, color, isPending, onSort }) {
  const styles = {
    rose: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    cyan: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    purple: "bg-purple-500/10 text-purple-400 border-purple-500/20"
  };

  return (
    <div className={`border rounded-3xl p-6 h-[500px] flex flex-col ${styles[color]}`}>
      <div className="mb-4 font-bold text-lg flex items-center justify-between">
        <div className="flex items-center gap-2">
          {title} <span className="text-xs opacity-50 bg-white/10 px-2 py-1 rounded-full">{data.length}</span>
        </div>
        <button onClick={onSort} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"><ArrowUpDown size={14} className="opacity-70" /></button>
      </div>
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2">
        {data.map((item, i) => {
          const username = isPending ? item.username : item;
          return (
            <div key={i} className="flex justify-between items-center bg-white/5 p-3 rounded-xl hover:bg-white/10 transition-all group">
              <a href={links[username] || `https://instagram.com/${username}`} target="_blank" className="text-sm truncate mr-2">@{username}</a>
              {isPending ? (
                <div className={`text-[10px] flex items-center gap-1 px-2 py-1 rounded ${item.daysAgo > 365 ? 'bg-rose-500/20 text-rose-400' : 'opacity-50'}`}>
                  <Clock size={10} /> {item.daysAgo}d
                </div>
              ) : (
                <button onClick={() => navigator.clipboard.writeText(username)} className="opacity-0 group-hover:opacity-100 transition-opacity"><Copy size={14} /></button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}