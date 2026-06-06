import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Search, Users, UserMinus, Heart, Copy, CheckCircle2 } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

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
      triggerToast('Analysis complete!');
    } catch (e) { triggerToast('Error parsing files.'); console.error(e); }
    finally { setIsProcessing(false); }
  };

  const chartData = results ? [
    { name: 'Not Following Back', value: results.notFollowingBack.length, color: '#f43f5e' },
    { name: 'Fans', value: results.fans.length, color: '#06b6d4' },
    { name: 'Mutuals', value: results.mutuals.length, color: '#10b981' },
  ] : [];

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white p-6 md:p-12 font-sans">
      <AnimatePresence>
        {toast && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed top-5 right-5 bg-cyan-600 px-6 py-3 rounded-2xl z-50 flex items-center gap-2"><CheckCircle2 size={18} />{toast}</motion.div>}
      </AnimatePresence>

      <div className="max-w-6xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-extrabold tracking-tighter bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">Network Intelligence</h1>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {['following', 'followers'].map((type) => (
            <label key={type} className="border-2 border-dashed border-white/10 rounded-3xl p-8 bg-white/5 hover:border-cyan-500 transition-all cursor-pointer text-center">
              <input type="file" className="hidden" onChange={(e) => setFiles(prev => ({ ...prev, [type]: e.target.files[0] }))} />
              <p className="font-bold capitalize">{type}.json</p>
              <p className="text-xs text-gray-500 truncate">{files[type]?.name || 'Click to select'}</p>
            </label>
          ))}
        </div>

        <button onClick={handleProcess} className="w-full py-4 rounded-2xl bg-cyan-600 font-bold hover:bg-cyan-500 transition-all">Analyze Network</button>

        {results && (
          <div className="space-y-8">
            <div className="bg-white/5 p-6 rounded-3xl border border-white/10 h-64 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {chartData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#000', borderRadius: '12px' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <input type="text" placeholder="Search usernames..." onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-cyan-500" />

            <div className="grid md:grid-cols-3 gap-6">
              <StandardCard title="Not Following Back" data={results.notFollowingBack.filter(u => u.includes(searchTerm))} links={userLinks} color="rose" />
              <StandardCard title="Fans" data={results.fans.filter(u => u.includes(searchTerm))} links={userLinks} color="cyan" />
              <StandardCard title="Mutuals" data={results.mutuals.filter(u => u.includes(searchTerm))} links={userLinks} color="emerald" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StandardCard({ title, data, links, color }) {
  const styles = {
    rose: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    cyan: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
  };

  return (
    <div className={`border rounded-3xl p-6 h-[500px] flex flex-col ${styles[color]}`}>
      <div className="mb-4 font-bold text-lg flex items-center gap-2">{title} <span className="opacity-50">({data.length})</span></div>
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2">
        {data.map(u => (
          <div key={u} className="flex justify-between items-center bg-white/5 p-3 rounded-xl hover:bg-white/10 transition-all">
            <a href={links[u]} target="_blank" rel="noopener noreferrer" className="text-sm">@{u}</a>
            <button onClick={() => navigator.clipboard.writeText(u)}><Copy size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}