import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Globe, 
  Search, 
  Filter, 
  Plus, 
  TrendingUp, 
  Clock, 
  Briefcase,
  ChevronRight,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Zap,
  Settings,
  Trash2,
  Wrench,
  Bell,
  BellOff,
  Link as LinkIcon,
  CheckCircle2,
  AlertCircle,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Opportunity, analyzeOpportunity, CompanyService, scrapeOpportunitiesFromUrl, Source } from './services/gemini';

const DEFAULT_PROFILE = "Full-stack IT services company specializing in Cloud Migration, AI/ML, and Enterprise Software Development.";

const INITIAL_SERVICES: CompanyService[] = [
  { id: '1', name: 'Cloud Migration', description: 'Migrating legacy systems to AWS, Azure, or GCP.' },
  { id: '2', name: 'AI/ML Development', description: 'Building custom AI solutions and LLM integrations.' },
  { id: '3', name: 'Web Development', description: 'Modern full-stack web applications using React and Node.js.' }
];

interface Notification {
  id: string;
  message: string;
  type: 'success' | 'info' | 'error';
  opportunityId?: string;
  sourceName?: string;
}

export default function App() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [services, setServices] = useState<CompanyService[]>(INITIAL_SERVICES);
  const [sources, setSources] = useState<Source[]>([]);
  const [companyProfile, setCompanyProfile] = useState(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(true);
  const [isScraping, setIsScraping] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTab, setSelectedTab] = useState<'all' | 'urgent' | 'matched' | 'services' | 'sources'>('all');
  const [isAddingPortal, setIsAddingPortal] = useState(false);
  const [portalUrls, setPortalUrls] = useState(['', '', '']);
  const [newService, setNewService] = useState({ name: '', description: '' });
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotificationCenter, setShowNotificationCenter] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchOpportunities();
    fetchSources();
  }, []);

  const addNotification = (message: string, type: 'success' | 'info' | 'error' = 'info', opportunityId?: string, sourceName?: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newNotif = { id, message, type, opportunityId, sourceName };
    setNotifications(prev => [newNotif, ...prev]);
    setUnreadCount(prev => prev + 1);
    
    // Auto-remove from toast after 5s, but keep in notification center
    setTimeout(() => {
      // We don't remove from the list, just the "toast" view if we had one
      // But here notifications is the list for both. Let's keep them.
    }, 5000);
  };

  const fetchOpportunities = async () => {
    try {
      const res = await fetch('/api/opportunities');
      const data = await res.json();
      setOpportunities(data);
    } catch (err) {
      console.error("Failed to fetch opportunities", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSources = async () => {
    try {
      const res = await fetch('/api/sources');
      const data = await res.json();
      setSources(data);
    } catch (err) {
      console.error("Failed to fetch sources", err);
    }
  };

  const handleAnalyze = async (opp: Opportunity) => {
    try {
      const analysis = await analyzeOpportunity(opp, companyProfile, services);
      
      // Update backend
      await fetch(`/api/opportunities/${opp.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...analysis, status: opp.status })
      });

      setOpportunities(prev => prev.map(o => 
        o.id === opp.id ? { ...o, ...analysis } : o
      ));
      addNotification(`AI analysis complete for: ${opp.title}`, 'success');
    } catch (err) {
      console.error("Analysis failed", err);
      addNotification("Analysis failed", 'error');
    }
  };

  const handleScrape = async () => {
    const activeUrls = portalUrls.filter(url => url.trim() !== '');
    if (activeUrls.length === 0) return;
    
    setIsScraping(true);
    let totalFound = 0;
    
    try {
      for (const url of activeUrls) {
        try {
          // 1. Save to sources database
          await fetch('/api/sources', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
          });
          
          // 2. Scrape
          const newOpps = await scrapeOpportunitiesFromUrl(url);
          const oppsWithId = newOpps.map((o: any, i: number) => ({
            ...o,
            id: `scraped-${Date.now()}-${i}-${Math.random()}`,
            source: new URL(url).hostname,
            status: 'open',
            url: o.url || url
          }));
          
          // 3. Save to backend database
          for (const opp of oppsWithId) {
            await fetch('/api/opportunities', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(opp)
            });
          }
          
          setOpportunities(prev => [...oppsWithId, ...prev]);
          totalFound += newOpps.length;
          
          if (newOpps.length > 0) {
            addNotification(`Found ${newOpps.length} new opportunities from ${new URL(url).hostname}`, 'success', undefined, new URL(url).hostname);
          }
        } catch (err) {
          console.error(`Failed to process ${url}`, err);
          addNotification(`Failed to process ${url}`, 'error');
        }
      }
      
      fetchSources(); // Refresh sources list
      setIsAddingPortal(false);
      setPortalUrls(['', '', '']);
    } catch (err) {
      console.error("Scraping failed", err);
    } finally {
      setIsScraping(false);
    }
  };

  const toggleSubscription = async (source: Source) => {
    const isSubscribing = !source.is_subscribed;
    
    if (isSubscribing) {
      const subscribedCount = sources.filter(s => s.is_subscribed).length;
      if (subscribedCount >= 10) {
        addNotification("Maximum of 10 subscribed sources allowed.", 'error');
        return;
      }
    }

    try {
      const res = await fetch(`/api/sources/${source.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_subscribed: isSubscribing })
      });
      
      if (!res.ok) {
        const error = await res.json();
        addNotification(error.error || "Failed to update subscription", 'error');
        return;
      }

      fetchSources();
      addNotification(
        isSubscribing ? `Subscribed to ${source.name}` : `Unsubscribed from ${source.name}`,
        'info'
      );
    } catch (err) {
      addNotification("Failed to update subscription", 'error');
    }
  };

  const checkSubscribedUpdates = async () => {
    const subscribed = sources.filter(s => s.is_subscribed);
    if (subscribed.length === 0) {
      addNotification("No subscribed sources to check", "info");
      return;
    }
    
    setIsScraping(true);
    addNotification(`Checking ${subscribed.length} subscribed sources for updates...`, "info");
    
    let newFoundCount = 0;
    
    try {
      for (const source of subscribed) {
        try {
          const newOpps = await scrapeOpportunitiesFromUrl(source.url);
          // In a real app, we'd filter out ones we already have
          // For this demo, we'll just take the first one as "new" if it exists
          if (newOpps.length > 0) {
            const mockNew: Opportunity = {
              ...newOpps[0],
              id: `update-${Date.now()}-${Math.random()}`,
              source: source.name,
              status: 'urgent',
              url: newOpps[0].url || source.url
            };

            // Save to backend
            await fetch('/api/opportunities', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(mockNew)
            });

            setOpportunities(prev => [mockNew, ...prev]);
            addNotification(`New opportunity posted on ${source.name}: ${mockNew.title}`, 'success', mockNew.id, source.name);
            newFoundCount++;
          }
        } catch (err) {
          console.error(`Update check failed for ${source.name}`, err);
        }
      }
      
      if (newFoundCount === 0) {
        addNotification("No new updates found on your subscribed sources.", "info");
      }
    } catch (err) {
      console.error("Update check failed", err);
    } finally {
      setIsScraping(false);
    }
  };

  const removeSource = async (id: number) => {
    try {
      await fetch(`/api/sources/${id}`, { method: 'DELETE' });
      fetchSources();
      addNotification("Source removed", 'info');
    } catch (err) {
      addNotification("Failed to remove source", 'error');
    }
  };

  const addService = () => {
    if (!newService.name || !newService.description) return;
    setServices(prev => [...prev, { ...newService, id: Date.now().toString() }]);
    setNewService({ name: '', description: '' });
    addNotification("Service added", 'success');
  };

  const removeService = (id: string) => {
    setServices(prev => prev.filter(s => s.id !== id));
    addNotification("Service removed", 'info');
  };

  const syncSystem = async () => {
    try {
      const res = await fetch('/api/system/sync', { method: 'POST' });
      const data = await res.json();
      addNotification(data.message, 'success');
      fetchSources();
      fetchOpportunities();
    } catch (err) {
      addNotification("Sync failed", 'error');
    }
  };

  const filteredOpportunities = opportunities.filter(opp => {
    const matchesSearch = opp.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         opp.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (selectedTab === 'urgent') return matchesSearch && opp.status === 'urgent';
    if (selectedTab === 'matched') return matchesSearch && (opp.matchScore || 0) > 70;
    return matchesSearch;
  });

  const activeSources = sources.filter(s => s.is_subscribed === 1);
  const historySources = sources.filter(s => s.is_subscribed === 0);

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-[#E5E7EB] z-20 hidden lg:block">
        <div className="p-6 border-b border-[#E5E7EB]">
          <div className="flex items-center gap-2 text-[#2563EB] font-bold text-xl">
            <ShieldCheck className="w-8 h-8" />
            <span>Scout AI</span>
          </div>
        </div>
        
        <nav className="p-4 space-y-2">
          <NavItem 
            icon={<Zap size={20} />} 
            label="New Analysis" 
            active={isAddingPortal} 
            onClick={() => setIsAddingPortal(true)}
          />
          <NavItem 
            icon={<LayoutDashboard size={20} />} 
            label="Dashboard" 
            active={['all', 'urgent', 'matched'].includes(selectedTab) && !isAddingPortal} 
            onClick={() => { setSelectedTab('all'); setIsAddingPortal(false); }}
          />
          <NavItem 
            icon={<Globe size={20} />} 
            label="Sources & Subscriptions" 
            active={selectedTab === 'sources'} 
            onClick={() => setSelectedTab('sources')}
          />
          <NavItem 
            icon={<Wrench size={20} />} 
            label="Our Services" 
            active={selectedTab === 'services'} 
            onClick={() => setSelectedTab('services')}
          />
          <NavItem icon={<Briefcase size={20} />} label="My Bids" />
        </nav>

        <div className="absolute bottom-0 left-0 w-full p-4 border-t border-[#E5E7EB] space-y-4">
          <button 
            onClick={syncSystem}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl border border-[#E5E7EB] text-xs font-bold text-[#4B5563] hover:bg-[#F9FAFB] transition-all"
          >
            <Clock size={14} />
            Sync & Cleanup (7d)
          </button>

          <div className="bg-[#EFF6FF] p-4 rounded-xl">
            <p className="text-xs font-semibold text-[#2563EB] uppercase tracking-wider mb-1">Company Profile</p>
            <textarea 
              className="text-xs text-[#4B5563] bg-transparent border-none w-full resize-none focus:ring-0 p-0"
              rows={3}
              value={companyProfile}
              onChange={(e) => setCompanyProfile(e.target.value)}
            />
          </div>
        </div>
      </aside>

      {/* Header with Notification Bell */}
      <header className="fixed top-0 right-0 left-0 lg:left-64 h-16 bg-white border-b border-[#E5E7EB] z-30 flex items-center justify-end px-8 gap-4">
        <button 
          onClick={checkSubscribedUpdates}
          disabled={isScraping}
          className="flex items-center gap-2 text-sm font-semibold text-[#4B5563] hover:text-[#2563EB] transition-colors disabled:opacity-50"
          title="Check subscribed sources for updates"
        >
          {isScraping ? (
            <div className="w-4 h-4 border-2 border-[#2563EB]/30 border-t-[#2563EB] rounded-full animate-spin" />
          ) : (
            <TrendingUp size={18} />
          )}
          <span className="hidden sm:inline">Check Updates</span>
        </button>

        <div className="w-px h-6 bg-[#E5E7EB] mx-2" />

        <div className="relative">
          <button 
            onClick={() => {
              setShowNotificationCenter(!showNotificationCenter);
              setUnreadCount(0);
            }}
            className="p-2 text-[#4B5563] hover:bg-[#F3F4F6] rounded-full transition-colors relative"
          >
            <Bell size={22} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white">
                {unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {showNotificationCenter && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotificationCenter(false)} />
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-80 bg-white rounded-2xl border border-[#E5E7EB] shadow-2xl z-50 overflow-hidden"
                >
                  <div className="p-4 border-b border-[#E5E7EB] flex justify-between items-center bg-[#F9FAFB]">
                    <h3 className="font-bold text-sm">Notifications</h3>
                    <button 
                      onClick={() => setNotifications([])}
                      className="text-xs text-[#2563EB] font-medium hover:underline"
                    >
                      Clear all
                    </button>
                  </div>
                  <div className="max-h-[400px] overflow-y-auto">
                    {notifications.length > 0 ? (
                      notifications.map(n => (
                        <div key={n.id} className="p-4 border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors cursor-pointer">
                          <div className="flex gap-3">
                            <div className={`mt-1 p-1.5 rounded-lg ${
                              n.type === 'success' ? 'bg-green-50 text-green-600' :
                              n.type === 'error' ? 'bg-red-50 text-red-600' :
                              'bg-blue-50 text-blue-600'
                            }`}>
                              {n.type === 'success' ? <CheckCircle2 size={14} /> : 
                               n.type === 'error' ? <AlertCircle size={14} /> : <Zap size={14} />}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm text-[#111827] leading-tight mb-1">{n.message}</p>
                              {n.sourceName && (
                                <span className="text-[10px] font-bold text-[#2563EB] uppercase tracking-wider">Source: {n.sourceName}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-center">
                        <BellOff size={32} className="mx-auto text-[#D1D5DB] mb-2" />
                        <p className="text-sm text-[#6B7280]">No new notifications</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
        <div className="w-8 h-8 bg-[#2563EB] text-white rounded-full flex items-center justify-center font-bold text-sm">
          IT
        </div>
      </header>

      {/* Main Content */}
      <main className="lg:ml-64 pt-24 p-8">
        {selectedTab === 'services' ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <header className="mb-8">
              <h1 className="text-3xl font-bold tracking-tight">Our Services</h1>
              <p className="text-[#6B7280]">Define what your company offers to improve AI matching accuracy</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-sm">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Plus size={20} className="text-[#2563EB]" />
                  Add New Service
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Service Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Cybersecurity Audit" 
                      className="w-full px-4 py-2 rounded-lg border border-[#E5E7EB] outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                      value={newService.name}
                      onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <textarea 
                      placeholder="Describe what you do in detail..." 
                      className="w-full px-4 py-2 rounded-lg border border-[#E5E7EB] outline-none focus:ring-2 focus:ring-[#2563EB]/20 h-32"
                      value={newService.description}
                      onChange={(e) => setNewService({ ...newService, description: e.target.value })}
                    />
                  </div>
                  <button 
                    onClick={addService}
                    className="w-full bg-[#2563EB] text-white py-2 rounded-lg font-semibold hover:bg-[#1D4ED8] transition-colors"
                  >
                    Add Service
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Briefcase size={20} className="text-[#2563EB]" />
                  Active Services ({services.length})
                </h2>
                {services.map(service => (
                  <div key={service.id} className="bg-white p-4 rounded-xl border border-[#E5E7EB] flex justify-between items-start group">
                    <div>
                      <h3 className="font-bold text-[#111827]">{service.name}</h3>
                      <p className="text-sm text-[#6B7280] mt-1">{service.description}</p>
                    </div>
                    <button 
                      onClick={() => removeService(service.id)}
                      className="p-2 text-[#9CA3AF] hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        ) : selectedTab === 'sources' ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Sources & Subscriptions</h1>
                <p className="text-[#6B7280]">Manage active monitoring and view your 7-day browsing history</p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={syncSystem}
                  className="flex items-center gap-2 bg-white border border-[#E5E7EB] px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#F9FAFB] transition-all shadow-sm"
                >
                  <Clock size={16} className="text-[#2563EB]" />
                  Cleanup History
                </button>
                <button 
                  onClick={checkSubscribedUpdates}
                  disabled={isScraping}
                  className="flex items-center gap-2 bg-[#2563EB] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#1D4ED8] transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
                >
                  {isScraping ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <TrendingUp size={16} />
                  )}
                  Run AI Scan
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              {/* Left Column: Subscribed Sources */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <CheckCircle2 size={20} className="text-green-500" />
                    Active Subscriptions ({activeSources.length}/10)
                  </h2>
                </div>
                <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden shadow-sm">
                  <div className="max-h-[600px] overflow-y-auto">
                    {activeSources.length > 0 ? (
                      <table className="w-full text-left">
                        <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB] sticky top-0 z-10">
                          <tr>
                            <th className="px-4 py-3 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Source</th>
                            <th className="px-4 py-3 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Status</th>
                            <th className="px-4 py-3 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E5E7EB]">
                          {activeSources.map(source => (
                            <tr key={source.id} className="hover:bg-[#F9FAFB] transition-colors group">
                              <td className="px-4 py-4">
                                <div className="flex flex-col">
                                  <span className="font-bold text-sm text-[#111827]">{source.name}</span>
                                  <a href={source.url} target="_blank" className="text-[10px] text-[#2563EB] hover:underline flex items-center gap-1">
                                    {new URL(source.url).hostname} <ExternalLink size={8} />
                                  </a>
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-bold text-green-600 flex items-center gap-1">
                                    <Zap size={10} /> Monitoring
                                  </span>
                                  <span className="text-[9px] text-[#9CA3AF]">
                                    {source.last_checked ? `Last: ${new Date(source.last_checked).toLocaleTimeString()}` : 'Pending scan'}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-4 text-right">
                                <button 
                                  onClick={() => toggleSubscription(source)}
                                  className="text-[10px] font-bold text-red-500 hover:text-red-700 transition-colors"
                                >
                                  Unsubscribe
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="p-12 text-center">
                        <Globe size={32} className="mx-auto text-[#D1D5DB] mb-2" />
                        <p className="text-sm text-[#6B7280]">No active subscriptions</p>
                        <p className="text-xs text-[#9CA3AF] mt-1">Subscribe to sources from your history</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Browsing History */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <Clock size={20} className="text-blue-500" />
                    Browsing History (Last 7 Days)
                  </h2>
                </div>
                <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden shadow-sm">
                  <div className="max-h-[600px] overflow-y-auto">
                    {historySources.length > 0 ? (
                      <table className="w-full text-left">
                        <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB] sticky top-0 z-10">
                          <tr>
                            <th className="px-4 py-3 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Source</th>
                            <th className="px-4 py-3 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Visited</th>
                            <th className="px-4 py-3 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E5E7EB]">
                          {historySources.map(source => (
                            <tr key={source.id} className="hover:bg-[#F9FAFB] transition-colors group">
                              <td className="px-4 py-4">
                                <div className="flex flex-col">
                                  <span className="font-bold text-sm text-[#111827]">{source.name}</span>
                                  <span className="text-[10px] text-[#6B7280]">{new URL(source.url).hostname}</span>
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <span className="text-[10px] text-[#6B7280]">
                                  {new Date(source.created_at).toLocaleDateString()}
                                </span>
                              </td>
                              <td className="px-4 py-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button 
                                    onClick={() => toggleSubscription(source)}
                                    className="px-3 py-1 rounded-lg text-[10px] font-bold bg-[#2563EB] text-white hover:bg-[#1D4ED8] transition-all"
                                  >
                                    Subscribe
                                  </button>
                                  <button 
                                    onClick={() => removeSource(source.id)}
                                    className="p-1.5 text-[#9CA3AF] hover:text-red-500 transition-colors"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="p-12 text-center">
                        <Search size={32} className="mx-auto text-[#D1D5DB] mb-2" />
                        <p className="text-sm text-[#6B7280]">History is empty</p>
                        <p className="text-xs text-[#9CA3AF] mt-1">Analyze new links to build your history</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <>
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Market Opportunities</h1>
                <p className="text-[#6B7280]">Real-time tracking of IT bids and consultations</p>
              </div>
              
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsAddingPortal(true)}
                  className="flex items-center gap-2 bg-[#2563EB] text-white px-4 py-2 rounded-lg font-medium hover:bg-[#1D4ED8] transition-colors shadow-sm"
                >
                  <Plus size={18} />
                  Analyze Multiple Links
                </button>
              </div>
            </header>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <StatCard icon={<Globe className="text-blue-500" />} label="Active Sources" value={sources.length.toString()} change={`${sources.filter(s => s.is_subscribed).length}/10 Subscribed`} />
              <StatCard icon={<Zap className="text-amber-500" />} label="Urgent Bids" value={opportunities.filter(o => o.status === 'urgent').length.toString()} change="Requires action" />
              <StatCard icon={<Sparkles className="text-purple-500" />} label="AI Recommendations" value={opportunities.filter(o => (o.matchScore || 0) > 70).length.toString()} change="High match score" />
            </div>

            {/* Filters & Search */}
            <div className="bg-white p-4 rounded-xl border border-[#E5E7EB] mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 bg-[#F3F4F6] px-3 py-2 rounded-lg w-full md:w-96">
                <Search size={18} className="text-[#9CA3AF]" />
                <input 
                  type="text" 
                  placeholder="Search by technology, title, or source..." 
                  className="bg-transparent border-none outline-none text-sm w-full"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-1 p-1 bg-[#F3F4F6] rounded-lg">
                <TabButton active={selectedTab === 'all'} onClick={() => setSelectedTab('all')}>All</TabButton>
                <TabButton active={selectedTab === 'urgent'} onClick={() => setSelectedTab('urgent')}>Urgent</TabButton>
                <TabButton active={selectedTab === 'matched'} onClick={() => setSelectedTab('matched')}>AI Matched</TabButton>
              </div>
            </div>

            {/* Opportunities List */}
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {loading ? (
                  <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2563EB]"></div>
                  </div>
                ) : filteredOpportunities.length > 0 ? (
                  filteredOpportunities.map((opp) => (
                    <OpportunityCard key={opp.id} opp={opp} onAnalyze={() => handleAnalyze(opp)} />
                  ))
                ) : (
                  <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-[#E5E7EB]">
                    <Search size={48} className="mx-auto text-[#D1D5DB] mb-4" />
                    <h3 className="text-lg font-medium">No opportunities found</h3>
                    <p className="text-[#6B7280]">Try adjusting your search or adding more portals.</p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </>
        )}
      </main>

      {/* Add Portal Modal */}
      <AnimatePresence>
        {isAddingPortal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Multi-Link Analysis</h2>
                <button onClick={() => setIsAddingPortal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                  <X size={20} />
                </button>
              </div>
              <p className="text-sm text-[#6B7280] mb-6">Enter up to 3 URLs to analyze simultaneously. We'll extract opportunities and save these to your database.</p>
              
              <div className="space-y-4">
                {portalUrls.map((url, index) => (
                  <div key={index} className="bg-[#F9FAFB] p-4 rounded-xl border border-[#E5E7EB]">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-[#4B5563] uppercase tracking-wider flex items-center gap-2">
                        <div className="w-5 h-5 bg-[#2563EB] text-white rounded-full flex items-center justify-center text-[10px]">
                          {index + 1}
                        </div>
                        Portal Source URL
                      </label>
                      {url && <span className="text-[10px] text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-full">Ready</span>}
                    </div>
                    <div className="relative">
                      <LinkIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                      <input 
                        type="url" 
                        placeholder="https://example-portal.com/it-bids" 
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E5E7EB] outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-all bg-white"
                        value={url}
                        onChange={(e) => {
                          const newUrls = [...portalUrls];
                          newUrls[index] = e.target.value;
                          setPortalUrls(newUrls);
                        }}
                        disabled={isScraping}
                      />
                    </div>
                  </div>
                ))}

                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={() => setIsAddingPortal(false)}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-[#E5E7EB] font-semibold hover:bg-[#F9FAFB] transition-colors"
                    disabled={isScraping}
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleScrape}
                    disabled={isScraping || portalUrls.every(u => u.trim() === '')}
                    className="flex-[2] px-4 py-2.5 rounded-xl bg-[#2563EB] text-white font-semibold hover:bg-[#1D4ED8] disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-blue-200 transition-all"
                  >
                    {isScraping ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Processing Sources...
                      </>
                    ) : (
                      <>
                        <Zap size={18} />
                        Analyze All Links
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavItem({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-all ${
        active ? 'bg-[#EFF6FF] text-[#2563EB]' : 'text-[#4B5563] hover:bg-[#F3F4F6] hover:text-[#111827]'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function StatCard({ icon, label, value, change }: { icon: React.ReactNode, label: string, value: string, change: string }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 bg-[#F3F4F6] rounded-lg">
          {icon}
        </div>
        <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">{change}</span>
      </div>
      <p className="text-sm text-[#6B7280] font-medium">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

function TabButton({ children, active, onClick }: { children: React.ReactNode, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
        active ? 'bg-white text-[#111827] shadow-sm' : 'text-[#6B7280] hover:text-[#111827]'
      }`}
    >
      {children}
    </button>
  );
}

function OpportunityCard({ opp, onAnalyze }: { opp: Opportunity, onAnalyze: () => void | Promise<void>, key?: React.Key }) {
  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="group bg-white rounded-2xl border border-[#E5E7EB] p-6 hover:border-[#2563EB] transition-all hover:shadow-md cursor-pointer"
    >
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${
              opp.status === 'urgent' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
            }`}>
              {opp.status}
            </span>
            <span className="text-xs text-[#9CA3AF] flex items-center gap-1">
              <Globe size={12} />
              {opp.source}
            </span>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-xl font-bold group-hover:text-[#2563EB] transition-colors">{opp.title}</h3>
            {opp.url && (
              <a 
                href={opp.url} 
                target="_blank" 
                rel="noopener noreferrer" 
                onClick={(e) => e.stopPropagation()}
                className="text-[#9CA3AF] hover:text-[#2563EB] transition-colors"
                title="Open original portal"
              >
                <ExternalLink size={18} />
              </a>
            )}
          </div>
          <p className="text-[#4B5563] text-sm line-clamp-2 mb-4">{opp.description}</p>
          
          <div className="flex flex-wrap gap-2">
            {opp.tags.map(tag => (
              <span key={tag} className="text-xs bg-[#F3F4F6] text-[#4B5563] px-2.5 py-1 rounded-full font-medium">#{tag}</span>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-end gap-4 min-w-[200px]">
          <div className="text-right">
            <p className="text-xs text-[#9CA3AF] font-medium uppercase tracking-wider">Budget</p>
            <p className="text-lg font-bold text-[#111827]">{opp.budget}</p>
            <div className="flex items-center justify-end gap-1 text-xs text-[#6B7280] mt-1">
              <Clock size={12} />
              <span>Deadline: {opp.deadline}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full">
            {!opp.matchScore ? (
              <button 
                onClick={(e) => { e.stopPropagation(); onAnalyze(); }}
                className="flex-1 flex items-center justify-center gap-2 bg-[#F3F4F6] text-[#111827] px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#E5E7EB] transition-colors"
              >
                <Sparkles size={16} className="text-purple-500" />
                AI Analyze
              </button>
            ) : (
              <div className="flex-1 flex items-center gap-3 bg-[#F0FDF4] p-2 rounded-lg border border-green-100">
                <div className="flex flex-col">
                  <span className="text-[10px] text-green-600 font-bold uppercase">Match Score</span>
                  <span className="text-lg font-bold text-green-700">{opp.matchScore}%</span>
                </div>
                <div className="h-8 w-[1px] bg-green-200"></div>
                <p className="text-[10px] text-green-800 leading-tight flex-1 italic">"{opp.aiSummary}"</p>
              </div>
            )}
            <button className="p-2 bg-[#2563EB] text-white rounded-lg hover:bg-[#1D4ED8]">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
