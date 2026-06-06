import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Search, Users, UserMinus, Heart, Copy, CheckCircle2, ChevronRight, X } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

export default function App() {
  const [files, setFiles] = useState({ following: null, followers: null });
  const [results, setResults] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [userLinks, setUserLinks] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState(null);

  const triggerToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

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
    } else {
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

  const handleProcess = async () => {
    if (!files.following || !files.followers) return triggerToast('Please upload both files.');
    setIsProcessing(true);
    const readJson = (file) => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(JSON.parse(e.target.result));
      reader.readAsText(file);
    });

    try {
      const followingData = await readJson(files.following);
      const followersData = await readJson(files.followers);
      const followingList = processFile(followingData, 'following');
      const followersList = processFile(followersData, 'followers');
      const followingSet = new Set(followingList);
      const followersSet = new Set(followersList);
      setResults({
        notFollowingBack: followingList.filter(u => !followersSet.has(u)),
        fans: followersList.filter(u => !followingSet.has(u)),
        mutuals: followingList.filter(u => followersSet.has(u))
      });
      triggerToast('Analysis Complete');
    } catch (e) { triggerToast('Invalid JSON format'); }
    finally { setIsProcessing(false); }
  };

  const chartData = results ? [
    { name: 'Non-Followers', value: results.notFollowingBack.length, color: '#f43f5e' },
    { name: 'Fans', value: results.fans.length, color: '#06b6d4' },
    { name: 'Mutuals', value: results.mutuals.length, color: '#10b981' },
  ] : [];

  return (
    <div className="min-h-screen bg-[#050505] text-gray-200 font-sans selection:bg-cyan-500/30">
      <AnimatePresence>
        {toast && <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-white text-black px-6 py-3 rounded-full shadow-2xl z-50 font-medium text-sm flex items-center gap-2"><CheckCircle2 size={16} />{toast}</motion.div>}
      </AnimatePresence>

      <main className="max-w-5xl mx-auto px-6 py-12 md:py-20">
        <header className="mb-16 text-center">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white mb-4">Network Insights</h1>
          <p className="text-gray-500 max-w-lg mx-auto">Analyze your Instagram connections with precision. A clean, professional audit of your social graph.</p>
        </header>

        {!results ? (
          <div className="grid md:grid-cols-2 gap-6">
            {['following', 'followers'].map((type) => (
              <label key={type} className="group relative border border-white/10 rounded-2xl p-8 bg-white/[0.02] hover:bg-white/[0.04] transition-all cursor-pointer">
                <input type="file" className="hidden" onChange={(e) => setFiles(prev => ({ ...prev, [type]: e.target.files[0] }))} />
                <div className="mb-4 text-cyan-500"><Upload size={24} /></div>
                <p className="font-semibold text-white capitalize">{type}.json</p>
                <p className="text-sm text-gray-500 mt-1 truncate">{files[type]?.name || 'Click to select file'}</p>
              </label>
            ))}
            <button onClick={handleProcess} disabled={isProcessing} className="md:col-span-2 w-full py-4 rounded-xl bg-white text-black font-bold hover:bg-gray-200 transition-colors flex items-center justify-center gap-2">
              {isProcessing ? 'Analyzing...' : 'Run Audit'}
            </button>
          </div>
        ) : (
          <div className="space-y-12">
            <div className="grid md:grid-cols-3 gap-6 items-center bg-white/[0.02] border border-white/10 rounded-3xl p-8">
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chartData} innerRadius={50} outerRadius={70} paddingAngle={8} dataKey="value">
                      {chartData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="md:col-span-2 grid grid-cols-3 gap-4">
                {chartData.map((d) => (
                  <div key={d.name} className="p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                    <p className="text-3xl font-bold text-white">{d.value}</p>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mt-1">{d.name}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={18} />
              <input type="text" placeholder="Filter by username..." onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-transparent border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white focus:border-white/30 transition-all outline-none" />
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <ResultSection title="Not Following Back" data={results.notFollowingBack} searchTerm={searchTerm} links={userLinks} color="red" />
              <ResultSection title="Fans" data={results.fans} searchTerm={searchTerm} links={userLinks} color="blue" />
              <ResultSection title="Mutuals" data={results.mutuals} searchTerm={searchTerm} links={userLinks} color="green" />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function ResultSection({ title, data, searchTerm, links, color }) {
  const filtered = data.filter(u => u.includes(searchTerm.toLowerCase()));
  const colors = { red: "text-red-500", blue: "text-cyan-500", green: "text-emerald-500" };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-400">{title}</h3>
        <span className={`text-xs px-2 py-1 rounded bg-white/5 ${colors[color]}`}>{filtered.length}</span>
      </div>
      <div className="space-y-2">
        {filtered.slice(0, 50).map(u => (
          <div key={u} className="flex items-center justify-between px-4 py-3 rounded-lg bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] transition-all group">
            <a href={links[u]} target="_blank" className="text-sm text-gray-300 hover:text-white transition-colors truncate">@{u}</a>
            <button onClick={() => navigator.clipboard.writeText(u)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded"><Copy size={12} /></button>
          </div>
        ))}
        {filtered.length > 50 && <p className="text-xs text-gray-600 text-center pt-2">And {filtered.length - 50} more...</p>}
      </div>
    </div>
  );
}