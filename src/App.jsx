import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function App() {
  const [followingFile, setFollowingFile] = useState(null);
  const [followersFile, setFollowersFile] = useState(null);
  const [results, setResults] = useState(null);
  const [searchTerm, setSearchTerm] = useState(''); // New search state
  const [userLinks, setUserLinks] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);

  const processFile = (data, type) => {
    const tempLinks = { ...userLinks };
    let users = [];

    if (type === 'following') {
      const list = data.relationships_following || [];
      users = list.map(item => {
        const username = item.title ? item.title.toLowerCase() : null;
        const url = item.string_list_data?.[0]?.href || '#';
        if (username) tempLinks[username] = url;
        return username;
      });
    } else {
      const list = Array.isArray(data) ? data : [];
      users = list.map(item => {
        const username = item.string_list_data?.[0]?.value?.toLowerCase();
        const url = item.string_list_data?.[0]?.href || '#';
        if (username) tempLinks[username] = url;
        return username;
      });
    }

    setUserLinks(prev => ({ ...prev, ...tempLinks }));
    return [...new Set(users.filter(u => u))];
  };

  const handleProcess = async () => {
    if (!followingFile || !followersFile) {
      alert('Please upload both files.');
      return;
    }

    setIsProcessing(true);
    setUserLinks({});

    const readJson = (file) => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(JSON.parse(e.target.result));
      reader.readAsText(file);
    });

    try {
      const followingData = await readJson(followingFile);
      const followersData = await readJson(followersFile);

      const followingList = processFile(followingData, 'following');
      const followersList = processFile(followersData, 'followers');

      const followingSet = new Set(followingList);
      const followersSet = new Set(followersList);

      setResults({
        notFollowingBack: followingList.filter(user => !followersSet.has(user)),
        fans: followersList.filter(user => !followingSet.has(user)),
        mutuals: followingList.filter(user => followersSet.has(user))
      });
    } catch (error) {
      console.error(error);
      alert('Error parsing files.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Helper to filter lists based on search term
  const filterList = (list) => list.filter(user => user.includes(searchTerm.toLowerCase()));

  return (
    <div className="min-h-screen p-8 font-sans bg-black text-white">
      <div className="max-w-5xl mx-auto space-y-12">
        <header className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">
            Network Analyzer
          </h1>
        </header>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="space-y-2">
              <label className="text-sm font-medium text-cyan-400 uppercase tracking-wider">following.json</label>
              <input type="file" onChange={(e) => setFollowingFile(e.target.files[0])} className="w-full text-sm text-gray-400 file:mr-4 file:py-3 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-white/10 file:text-cyan-400 hover:file:bg-white/20 transition-all cursor-pointer" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-blue-400 uppercase tracking-wider">followers_1.json</label>
              <input type="file" onChange={(e) => setFollowersFile(e.target.files[0])} className="w-full text-sm text-gray-400 file:mr-4 file:py-3 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-white/10 file:text-blue-400 hover:file:bg-white/20 transition-all cursor-pointer" />
            </div>
          </div>

          <button onClick={handleProcess} disabled={isProcessing} className="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold tracking-wide hover:from-cyan-500 hover:to-blue-500 transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] disabled:opacity-50">
            {isProcessing ? 'Processing Data...' : 'Analyze Network'}
          </button>
        </div>

        {results && (
          <div className="mb-8">
            <input
              type="text"
              placeholder="Search by username..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-6 py-4 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>
        )}

        <AnimatePresence>
          {results && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <ResultCard title="Not Following Back" data={filterList(results.notFollowingBack)} links={userLinks} accent="border-rose-500/50" textAccent="text-rose-400" />
              <ResultCard title="Fans" data={filterList(results.fans)} links={userLinks} accent="border-cyan-500/50" textAccent="text-cyan-400" />
              <ResultCard title="Mutuals" data={filterList(results.mutuals)} links={userLinks} accent="border-emerald-500/50" textAccent="text-emerald-400" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ResultCard({ title, data, links, accent, textAccent }) {
  return (
    <div className={`bg-white/5 backdrop-blur-lg border ${accent} rounded-2xl p-6 flex flex-col h-96`}>
      <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
        <h2 className="text-lg font-semibold tracking-wide">{title}</h2>
        <span className={`text-2xl font-bold ${textAccent}`}>{data.length}</span>
      </div>
      <div className="overflow-y-auto pr-2 space-y-2 custom-scrollbar">
        {data.length === 0 ? (
          <p className="text-gray-500 text-center italic">No users found.</p>
        ) : (
          data.map((user, idx) => (
            <a
              key={idx}
              href={links[user] || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-gray-300 bg-white/5 px-4 py-2 rounded-lg text-sm hover:bg-cyan-900/30 hover:text-cyan-300 transition-all"
            >
              @{user}
            </a>
          ))
        )}
      </div>
    </div>
  );
}