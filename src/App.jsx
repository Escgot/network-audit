import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Search, Users, UserMinus, Heart, Clock, ExternalLink, CheckCircle2 } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

export default function App() {
  const [files, setFiles] = useState({ following: null, followers: null, pending: null });
  const [results, setResults] = useState(null);
  const [activeTab, setActiveTab] = useState('notFollowingBack');
  const [searchTerm, setSearchTerm] = useState('');
  const [userLinks, setUserLinks] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);

  const processFile = (data, type) => {
    const tempLinks = { ...userLinks };
    let users = [];
    if (type === 'following') {
      const list = data.relationships_following || [];
      list.forEach(item => {
        const username = item.title?.toLowerCase();
        if (username) tempLinks[username] = item.string_list_data?.[0]?.href || '#';
        users.push(username);
      });
    } else if (type === 'followers') {
      const list = Array.isArray(data) ? data : [];
      list.forEach(item => {
        const username = item.string_list_data?.[0]?.value?.toLowerCase();
        if (username) tempLinks[username] = item.string_list_data?.[0]?.href || '#';
        users.push(username);
      });
    }
    setUserLinks(prev => ({ ...prev, ...tempLinks }));
    return [...new Set(users.filter(u => u))];
  };

  const processPending = (data) => {
    return data.map(item => {
      const usernameObj = item.label_values.find(l => l.label === 'Username');
      return {
        username: usernameObj?.value?.toLowerCase(),
        timestamp: item.timestamp
      };
    }).filter(u => u.username);
  };

  const handleProcess = async () => {
    if (!files.following || !files.followers || !files.pending) return;
    setIsProcessing(true);

    const readJson = (file) => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(JSON.parse(e.target.result));
      reader.readAsText(file);
    });

    const [followingData, followersData, pendingData] = await Promise.all([
      readJson(files.following),
      readJson(files.followers),
      readJson(files.pending)
    ]);

    const fList = processFile(followingData, 'following');
    const flwList = processFile(followersData, 'followers');
    const pendingList = processPending(pendingData);

    const fSet = new Set(fList);
    const flwSet = new Set(flwList);

    setResults({
      notFollowingBack: fList.filter(u => !flwSet.has(u)),
      fans: flwList.filter(u => !fSet.has(u)),
      mutuals: fList.filter(u => flwSet.has(u)),
      pending: pendingList
    });
    setIsProcessing(false);
  };

  const getDaysAgo = (timestamp) => {
    const diff = Math.floor((Date.now() / 1000 - timestamp) / 86400);
    return diff < 0 ? 0 : diff;
  };

  const filteredData = results
    ? (activeTab === 'pending'
      ? results.pending.filter(u => u.username.includes(searchTerm.toLowerCase()))
      : results[activeTab].filter(u => u.includes(searchTerm.toLowerCase())))
    : [];

  return (
    <div className="min-h-screen bg-[#090909] text-white font-sans">
      <nav className="border-b border-white/10 px-8 py-4 flex justify-between items-center bg-[#090909]/50 backdrop-blur-md sticky top-0 z-10">
        <h1 className="font-bold tracking-tight text-xl">Network<span className="text-indigo-500">Audit</span></h1>
      </nav>

      <main className="max-w-4xl mx-auto p-8">
        {!results ? (
          <div className="mt-20 space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold">Import your data</h2>
              <p className="text-gray-500">Upload Following, Followers, and Pending Requests files.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {['following', 'followers', 'pending'].map(type => (
                <label key={type} className="border-2 border-dashed border-white/10 rounded-xl p-6 bg-white/[0.02] hover:border-indigo-500/50 transition-all cursor-pointer">
                  <input type="file" className="hidden" onChange={(e) => setFiles(prev => ({ ...prev, [type]: e.target.files[0] }))} />
                  <p className="font-semibold text-white capitalize mb-1">{type}</p>
                  <p className="text-xs text-gray-600 truncate">{files[type]?.name || 'Select file'}</p>
                </label>
              ))}
            </div>
            <button onClick={handleProcess} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-medium transition-all">
              {isProcessing ? 'Processing...' : 'Start Audit'}
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {['notFollowingBack', 'fans', 'mutuals', 'pending'].map(key => (
                <button key={key} onClick={() => setActiveTab(key)} className={`p-4 rounded-2xl border transition-all ${activeTab === key ? 'bg-white/5 border-indigo-500/50' : 'bg-transparent border-white/5 hover:bg-white/[0.02]'}`}>
                  <p className="text-2xl font-bold">{results[key].length}</p>
                  <p className="text-[10px] uppercase tracking-widest text-gray-500">{key.replace(/([A-Z])/g, ' $1')}</p>
                </button>
              ))}
            </div>

            <div className="bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-white/10 flex items-center gap-4">
                <Search size={18} className="text-gray-500" />
                <input placeholder="Filter users..." onChange={(e) => setSearchTerm(e.target.value)} className="bg-transparent w-full focus:outline-none text-sm" />
              </div>
              <div className="max-h-[500px] overflow-y-auto">
                {filteredData.map((item, idx) => {
                  const username = item.username || item;
                  const daysAgo = item.timestamp ? getDaysAgo(item.timestamp) : null;
                  return (
                    <div key={idx} className="flex items-center justify-between p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                      <span className="font-medium text-sm">@{username}</span>
                      <div className="flex items-center gap-4">
                        {daysAgo !== null && <span className="text-xs text-gray-500">{daysAgo} days ago</span>}
                        <a href={userLinks[username] || `https://instagram.com/${username}`} target="_blank" className="text-indigo-400 hover:text-indigo-300 text-xs flex items-center gap-1">
                          Profile <ExternalLink size={12} />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}