import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Download, Search, Users, UserMinus, Heart, Copy, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [files, setFiles] = useState({ following: null, followers: null });
  const [results, setResults] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [userLinks, setUserLinks] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState(null);

  const triggerToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const handleDrop = (e, type) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) setFiles(prev => ({ ...prev, [type]: file }));
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
      triggerToast('Analysis complete!');
    } catch { triggerToast('Error: Invalid JSON files.'); }
    finally { setIsProcessing(false); }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white p-6 md:p-12 font-sans selection:bg-cyan-500/20">
      {/* Toast */}
      <AnimatePresence>
        {toast && <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="fixed top-5 right-5 bg-cyan-600 px-6 py-3 rounded-2xl shadow-2xl z-50 font-medium flex items-center gap-2"><CheckCircle2 size={18} />{toast}</motion.div>}
      </AnimatePresence>

      <div className="max-w-6xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-5xl font-extrabold tracking-tighter bg-gradient-to-br from-white to-gray-500 bg-clip-text text-transparent">Network Insights</h1>
          <p className="text-gray-400">Professional analysis for your social connections.</p>
        </div>

        {/* Upload Zone */}
        <div className="grid md:grid-cols-2 gap-4">
          {['following', 'followers'].map((type) => (
            <div key={type} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, type)} className="border-2 border-dashed border-white/10 rounded-3xl p-8 bg-white/5 hover:bg-white/10 transition-all text-center flex flex-col items-center gap-4">
              <Upload className="text-cyan-500" size={32} />
              <div>
                <p className="font-bold capitalize">{type}.json</p>
                <p className="text-xs text-gray-500">{files[type] ? files[type].name : 'Drag & drop file here'}</p>
              </div>
            </div>
          ))}
        </div>

        <button onClick={handleProcess} className="w-full py-5 rounded-2xl bg-cyan-600 hover:bg-cyan-500 font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-900/20">
          {isProcessing ? 'Analyzing...' : 'Generate Report'}
        </button>

        {/* Results Dashboard */}
        {results && (
          <div className="space-y-6">
            <input type="text" placeholder="Search usernames..." onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-cyan-500 transition-all" />

            <div className="grid md:grid-cols-3 gap-6">
              <Card title="Not Following" count={results.notFollowingBack.length} data={results.notFollowingBack.filter(u => u.includes(searchTerm))} links={userLinks} icon={<UserMinus className="text-rose-400" />} color="rose" />
              <Card title="Fans" count={results.fans.length} data={results.fans.filter(u => u.includes(searchTerm))} links={userLinks} icon={<Heart className="text-cyan-400" />} color="cyan" />
              <Card title="Mutuals" count={results.mutuals.length} data={results.mutuals.filter(u => u.includes(searchTerm))} links={userLinks} icon={<Users className="text-emerald-400" />} color="emerald" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ title, count, data, links, icon, color }) {
  return (
    <div className={`bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col h-[500px]`}>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2 font-bold text-lg">{icon} {title}</div>
        <span className={`bg-${color}-500/10 text-${color}-400 px-3 py-1 rounded-full text-xs font-bold`}>{count}</span>
      </div>
      <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-2">
        {data.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-600 gap-2"><p>Empty</p></div>
        ) : (
          data.map(u => (
            <div key={u} className="flex justify-between items-center bg-white/5 p-3 rounded-xl group hover:bg-white/10 transition-all">
              <a href={links[u]} target="_blank" className="text-sm font-medium">@{u}</a>
              <button onClick={() => navigator.clipboard.writeText(u)} className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-white/20 rounded-lg"><Copy size={14} /></button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}