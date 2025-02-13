'use client';

import { useState, useEffect, useRef } from 'react';

const parseMarkdown = (text: string) => {
  if (!text) return '';
  
  // Sol tarafta ---### formatı için kontrol
  if (text.trim().startsWith('---###')) {
    const content = text.trim().slice(6);
    return `<div class="my-4 p-4 bg-[#1f1f1f] rounded-lg border-l-4 border-[#4C8636]"><h3 class="text-lg font-semibold text-[#4C8636]">${content}</h3></div>`;
  }
  
  if (text.trim().startsWith('###') && text.trim().endsWith('###')) {
    return `<h3 class="text-lg font-semibold my-2 text-[#4C8636]">${text.trim().slice(3, -3)}</h3>`;
  }
  
  if (text.trim().startsWith('---') && text.trim().endsWith('---')) {
    return `<div class="my-4 p-4 bg-[#1f1f1f] rounded-lg border-l-4 border-[#4C8636]">${text.trim().slice(3, -3)}</div>`;
  }
  
  // Normal işleme devam et
  return text
    .replace(/---###\s*(.*?)$/gm, '<div class="my-4 p-4 bg-[#1f1f1f] rounded-lg border-l-4 border-[#4C8636]"><h3 class="text-lg font-semibold text-[#4C8636]">$1</h3></div>')
    .replace(/###\s*(.*?)\s*###/g, '<h3 class="text-lg font-semibold my-2 text-[#4C8636]">$1</h3>')
    .replace(/---\s*(.*?)\s*---/g, '<div class="my-4 p-4 bg-[#1f1f1f] rounded-lg border-l-4 border-[#4C8636]">$1</div>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code class="bg-[#2b2b2b] px-1 py-0.5 rounded">$1</code>')
    .replace(/~~(.*?)~~/g, '<del>$1</del>')
    .split('\n').map(line => {
      if (line.startsWith('* ')) {
        return `<li>${line.substring(2)}</li>`;
      }
      return line;
    }).join('\n');
};

interface ChatSession {
  id: string;
  title: string;
  messages: { role: string; content: string; hasContext?: boolean }[];
  createdAt: Date;
  documentContext?: boolean;
}

interface ChatMessage {
  role: string;
  content: string;
  hasContext?: boolean;
  thoughts?: Array<{
    step: string;
    thought: string;
  }>;
  searchResults?: string;
  model?: string;
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isInputVisible, setIsInputVisible] = useState(false);
  const [browserOffset, setBrowserOffset] = useState(0);
  const [isAgentMode, setIsAgentMode] = useState(false);
  const [isAkilliAnaliz, setIsAkilliAnaliz] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [selectedModel, setSelectedModel] = useState('deepseek');
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const modelConfigs = {
    deepseek: 'deepseek/deepseek-r1:free',
    deepma: 'deepseek/deepseek-r1-distill-llama-70b:free',
    deepseekv3: 'deepseek/deepseek-chat:free',
    llama: 'meta-llama/llama-3.3-70b-instruct:free',
    llaman: 'nvidia/llama-3.1-nemotron-70b-instruct:free',
    gemini: 'gemini-2.0-flash',
    geminipro: 'google/gemini-2.0-pro-exp-02-05:free',
    qwen: 'qwen/qwen2.5-vl-72b-instruct:free',
    qwenplus: 'qwen/qwen-vl-plus:free',
    mistral: 'mistralai/mistral-7b-instruct:free',
    mistralnemo: 'mistralai/mistral-nemo:free',
    mistrals: 'mistralai/mistral-small-24b-instruct-2501:free'
  };

  const modelNames = {
    deepseek: 'DeepSeek R1',
    deepma: 'DeepSeek R1-L',
    deepseekv3: 'DeepSeek V3',
    llama: 'Llama 3.3',
    llaman: 'Llama 3.1-N',
    gemini: 'Gemini F. 2.0',
    geminipro: 'Gemini Pro 2.0',
    qwen: 'Qwen 2.5',
    qwenplus: 'Qwen VL Plus',
    mistral: 'Mistral 7B',
    mistralnemo: 'Mistral Nemo',
    mistrals: 'Mistral Small 3'
  };

  useEffect(() => {
    setMounted(true);
    // Tarayıcının dikey sekmelerinin genişliğini hesapla
    const calculateOffset = () => {
      // window.outerWidth: Tarayıcı penceresinin toplam genişliği (dikey sekmeler dahil)
      // window.innerWidth: İçerik alanının genişliği
      // Fark, dikey sekmelerin ve diğer tarayıcı UI elementlerinin genişliğini verir
      const verticalTabWidth = window.outerWidth - window.innerWidth;
      setBrowserOffset(verticalTabWidth);
    };

    calculateOffset();
    window.addEventListener('resize', calculateOffset);
    return () => window.removeEventListener('resize', calculateOffset);
  }, []);

  const createNewChat = () => {
    // Eğer devam eden bir istek varsa iptal et
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setActiveChatId(null);
    setChatHistory([]);
    setIsLoading(false);
  };

  const toggleAgentMode = () => {
    setIsAgentMode(!isAgentMode);
    // Diğer modları kapat
    setIsAkilliAnaliz(false);
    setShowSearchInput(false);
    
    // Eğer arama modundan çıkılıyorsa, searchQuery'yi message'a kopyala
    if (showSearchInput && searchQuery) {
      setMessage(searchQuery);
    }
  };

  const toggleAkilliAnaliz = () => {
    setIsAkilliAnaliz(!isAkilliAnaliz);
    // Diğer modları kapat
    setIsAgentMode(false);
    setShowSearchInput(false);
    
    // Eğer arama modundan çıkılıyorsa, searchQuery'yi message'a kopyala
    if (showSearchInput && searchQuery) {
      setMessage(searchQuery);
    }
  };

  const toggleSearchMode = () => {
    setShowSearchInput(!showSearchInput);
    // Diğer modları kapat
    setIsAgentMode(false);
    setIsAkilliAnaliz(false);
    
    // Eğer arama moduna geçiliyorsa, mevcut mesajı searchQuery'ye kopyala
    if (!showSearchInput && message) {
      setSearchQuery(message);
    }
    // Eğer arama modundan çıkılıyorsa, mevcut searchQuery'yi message'a kopyala
    else if (showSearchInput && searchQuery) {
      setMessage(searchQuery);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() && !searchQuery.trim()) return;

    setIsLoading(true);
    const userMessage = { 
      role: 'user', 
      content: showSearchInput ? searchQuery : message 
    };
    const updatedHistory = [...chatHistory, userMessage];
    setChatHistory(updatedHistory);
    
    setMessage('');
    setSearchQuery('');

    try {
      // Yeni bir AbortController oluştur
      abortControllerRef.current = new AbortController();

      const activeChat = chatSessions.find(chat => chat.id === activeChatId);
      const hasDocumentContext = activeChat?.documentContext || false;

      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          message: showSearchInput ? searchQuery : message,
          useContext: hasDocumentContext,
          useAkilliAnaliz: isAkilliAnaliz,
          searchQuery: showSearchInput ? searchQuery : null,
          model: modelConfigs[selectedModel as keyof typeof modelConfigs]
        }),
        signal: abortControllerRef.current.signal
      });

      const data = await response.json();
      const aiMessage = { 
        role: 'assistant', 
        content: data.reply,
        hasContext: data.hasContext,
        thoughts: data.thoughts,
        searchResults: data.searchResults,
        model: selectedModel
      };
      const finalHistory = [...updatedHistory, aiMessage];
      setChatHistory(finalHistory);
      
      if (!activeChatId) {
        const newChat: ChatSession = {
          id: Date.now().toString(),
          title: message.slice(0, 30) + '...',
          messages: finalHistory,
          createdAt: new Date(),
          documentContext: false
        };
        setChatSessions(prev => [newChat, ...prev]);
        setActiveChatId(newChat.id);
      } else {
        setChatSessions(prev => prev.map(chat => {
          if (chat.id === activeChatId) {
            return { ...chat, messages: finalHistory };
          }
          return chat;
        }));
      }
    } catch (error: any) {
      // AbortError'u kontrol et
      if (error.name === 'AbortError') {
        console.log('İstek iptal edildi');
        return;
      }
      console.error('Error:', error);
      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        content: 'Üzgünüm, bir hata oluştu.',
        hasContext: false 
      }]);
    } finally {
      setIsLoading(false);
      // AbortController'ı temizle
      abortControllerRef.current = null;
    }
  };

  const switchChat = (chatId: string) => {
    const chat = chatSessions.find(c => c.id === chatId);
    if (chat) {
      setActiveChatId(chatId);
      setChatHistory(chat.messages);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setIsUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:3001/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Yükleme başarısız');

      const data = await response.json();
      
      // Eğer aktif bir sohbet yoksa yeni bir sohbet oluştur
      if (!activeChatId) {
        const newChat: ChatSession = {
          id: Date.now().toString(),
          title: file.name,
          messages: [{
            role: 'assistant',
            content: 'Doküman başarıyla yüklendi ve indekslendi. Artık doküman içeriği hakkında sorular sorabilirsiniz.',
            hasContext: false
          }],
          createdAt: new Date(),
          documentContext: true
        };
        setChatSessions(prev => [newChat, ...prev]);
        setActiveChatId(newChat.id);
        setChatHistory(newChat.messages);
      } else {
        // Mevcut sohbete doküman bağlamını ekle
        setChatSessions(prev => prev.map(chat => {
          if (chat.id === activeChatId) {
            return {
              ...chat,
              documentContext: true,
              messages: [...chat.messages, {
                role: 'assistant',
                content: 'Doküman başarıyla yüklendi ve indekslendi. Artık doküman içeriği hakkında sorular sorabilirsiniz.',
                hasContext: false
              }]
            };
          }
          return chat;
        }));
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: 'Doküman başarıyla yüklendi ve indekslendi. Artık doküman içeriği hakkında sorular sorabilirsiniz.',
          hasContext: false
        }]);
      }
    } catch (error) {
      console.error('Upload error:', error);
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: 'Doküman yüklenirken bir hata oluştu.',
        hasContext: false
      }]);
    } finally {
      setIsUploading(false);
      setSelectedFile(null);
    }
  };

  const categorizeChats = (chats: ChatSession[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Bugünün başlangıcı
    
    const oneDay = 24 * 60 * 60 * 1000;
    const sevenDaysAgo = new Date(today.getTime() - 7 * oneDay);
    const thirtyDaysAgo = new Date(today.getTime() - 30 * oneDay);

    const todayChats = chats.filter(chat => {
      const chatDate = new Date(chat.createdAt);
      chatDate.setHours(0, 0, 0, 0);
      return chatDate.getTime() === today.getTime();
    });

    const last7DaysChats = chats.filter(chat => {
      const chatDate = new Date(chat.createdAt);
      chatDate.setHours(0, 0, 0, 0);
      return chatDate.getTime() < today.getTime() && chatDate.getTime() >= sevenDaysAgo.getTime();
    });

    const last30DaysChats = chats.filter(chat => {
      const chatDate = new Date(chat.createdAt);
      chatDate.setHours(0, 0, 0, 0);
      return chatDate.getTime() < sevenDaysAgo.getTime() && chatDate.getTime() >= thirtyDaysAgo.getTime();
    });

    return { todayChats, last7DaysChats, last30DaysChats };
  };

  const { todayChats, last7DaysChats, last30DaysChats } = categorizeChats(chatSessions);

  if (!mounted) {
    return null;
  }

  return (
    <div className="h-screen bg-[#0f0f0f] overflow-hidden">
      <div className="flex h-full">
        {/* Sol Panel */}
        <div 
          className={`fixed top-0 bottom-0 right-0 w-72 glass-effect-strong border-l border-[#2b2b2b] flex flex-col transition-all duration-300 ease-in-out z-[9999] ${
            isPanelOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {/* Header */}
          <div className="p-6 flex items-center justify-between border-b border-[#2b2b2b]">
            <div className="flex items-center gap-4">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-10 w-10 text-[#4C8636] pulse flex-shrink-0" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
                suppressHydrationWarning
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={1.5} 
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              <div>
                <h1 className="text-2xl font-bold text-[#4C8636]">AI Sohbet Botu</h1>
                <p className="text-sm mt-1 text-[#a3a3a3]">Gemini AI ile güçlendirilmiş deneyim</p>
              </div>
            </div>
          </div>

          {/* Yeni Sohbet Butonu */}
          <div className="p-6">
            <button
              onClick={() => chatSessions.length > 0 && createNewChat()}
              className="w-full flex items-center justify-center px-4 py-3 gap-2 rounded-xl transition-colors duration-200 bg-[#4C8636] text-[#e2e2e2] hover:bg-[#4C8636]/90"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H6l-4 4V6c0-1.1.9-2 2-2z" />
              </svg>
              <span className={`transition-all duration-300 ${isPanelOpen ? 'opacity-100' : 'opacity-0'}`}>
                Yeni Sohbet
              </span>
            </button>
          </div>

          {/* Sohbet Listesi */}
          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-6">
            {todayChats.length > 0 && (
              <div className="mb-4">
                <h3 className="text-[#4C8636] text-sm mb-3">Bugün</h3>
                {todayChats.map((chat) => (
                  <div
                    key={chat.id}
                    onClick={() => switchChat(chat.id)}
                    className={`w-full text-left p-4 rounded-xl mb-3 transition-colors duration-200 hover-scale cursor-pointer ${
                      activeChatId === chat.id
                        ? 'bg-[#2b2b2b] text-[#e2e2e2]'
                        : 'text-[#a3a3a3] hover:bg-[#1f1f1f]'
                    } ${!isPanelOpen ? 'opacity-0' : 'opacity-100'} relative group`}
                  >
                    {/* Başlık Düzenleme ve Görüntüleme */}
                    <div className="flex items-center justify-between">
                      <div className="flex-1 pr-2">
                        <span className={`text-sm font-medium ${
                          activeChatId === chat.id ? 'text-[#e2e2e2]' : 'text-[#a3a3a3]'
                        }`}>{chat.title}</span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const input = document.createElement('input');
                            input.value = chat.title;
                            input.className = 'w-full bg-transparent text-sm font-medium focus:outline-none text-[#e2e2e2]';
                            input.onblur = () => {
                              setChatSessions(prev => prev.map(c => {
                                if (c.id === chat.id) {
                                  return { ...c, title: input.value };
                                }
                                return c;
                              }));
                              input.parentElement?.replaceChild(
                                document.createTextNode(input.value),
                                input
                              );
                            };
                            const span = e.currentTarget.parentElement?.previousElementSibling?.firstChild;
                            if (span) {
                              span.parentElement?.replaceChild(input, span);
                              input.focus();
                            }
                          }}
                          className="p-1 hover:bg-[#363636] rounded transition-colors text-[#a3a3a3] hover:text-[#e2e2e2]"
                          title="Başlığı Düzenle"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setChatSessions(prev => prev.filter(c => c.id !== chat.id));
                            if (activeChatId === chat.id) {
                              setActiveChatId(null);
                              setChatHistory([]);
                            }
                          }}
                          className="p-1 hover:bg-[#363636] rounded transition-colors text-[#a3a3a3] hover:text-[#e2e2e2]"
                          title="Sohbeti Sil"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="text-xs text-[#a3a3a3] mt-1">
                      {new Date(chat.createdAt).toLocaleDateString('tr-TR')}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {last7DaysChats.length > 0 && (
              <div className="mb-4">
                <h3 className="text-[#4C8636] text-sm mb-3">Önceki 7 Gün</h3>
                {last7DaysChats.map((chat) => (
                  <div
                    key={chat.id}
                    onClick={() => switchChat(chat.id)}
                    className={`w-full text-left p-4 rounded-xl mb-3 transition-colors duration-200 hover-scale cursor-pointer ${
                      activeChatId === chat.id
                        ? 'bg-[#2b2b2b] text-[#e2e2e2]'
                        : 'text-[#a3a3a3] hover:bg-[#1f1f1f]'
                    } ${!isPanelOpen ? 'opacity-0' : 'opacity-100'} relative group`}
                  >
                    {/* Başlık Düzenleme ve Görüntüleme */}
                    <div className="flex items-center justify-between">
                      <div className="flex-1 pr-2">
                        <span className={`text-sm font-medium ${
                          activeChatId === chat.id ? 'text-[#e2e2e2]' : 'text-[#a3a3a3]'
                        }`}>{chat.title}</span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const input = document.createElement('input');
                            input.value = chat.title;
                            input.className = 'w-full bg-transparent text-sm font-medium focus:outline-none text-[#e2e2e2]';
                            input.onblur = () => {
                              setChatSessions(prev => prev.map(c => {
                                if (c.id === chat.id) {
                                  return { ...c, title: input.value };
                                }
                                return c;
                              }));
                              input.parentElement?.replaceChild(
                                document.createTextNode(input.value),
                                input
                              );
                            };
                            const span = e.currentTarget.parentElement?.previousElementSibling?.firstChild;
                            if (span) {
                              span.parentElement?.replaceChild(input, span);
                              input.focus();
                            }
                          }}
                          className="p-1 hover:bg-[#363636] rounded transition-colors text-[#a3a3a3] hover:text-[#e2e2e2]"
                          title="Başlığı Düzenle"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setChatSessions(prev => prev.filter(c => c.id !== chat.id));
                            if (activeChatId === chat.id) {
                              setActiveChatId(null);
                              setChatHistory([]);
                            }
                          }}
                          className="p-1 hover:bg-[#363636] rounded transition-colors text-[#a3a3a3] hover:text-[#e2e2e2]"
                          title="Sohbeti Sil"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="text-xs text-[#a3a3a3] mt-1">
                      {new Date(chat.createdAt).toLocaleDateString('tr-TR')}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {last30DaysChats.length > 0 && (
              <div className="mb-4">
                <h3 className="text-[#4C8636] text-sm mb-3">Önceki 30 Gün</h3>
                {last30DaysChats.map((chat) => (
                  <div
                    key={chat.id}
                    onClick={() => switchChat(chat.id)}
                    className={`w-full text-left p-4 rounded-xl mb-3 transition-colors duration-200 hover-scale cursor-pointer ${
                      activeChatId === chat.id
                        ? 'bg-[#2b2b2b] text-[#e2e2e2]'
                        : 'text-[#a3a3a3] hover:bg-[#1f1f1f]'
                    } ${!isPanelOpen ? 'opacity-0' : 'opacity-100'} relative group`}
                  >
                    {/* Başlık Düzenleme ve Görüntüleme */}
                    <div className="flex items-center justify-between">
                      <div className="flex-1 pr-2">
                        <span className={`text-sm font-medium ${
                          activeChatId === chat.id ? 'text-[#e2e2e2]' : 'text-[#a3a3a3]'
                        }`}>{chat.title}</span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const input = document.createElement('input');
                            input.value = chat.title;
                            input.className = 'w-full bg-transparent text-sm font-medium focus:outline-none text-[#e2e2e2]';
                            input.onblur = () => {
                              setChatSessions(prev => prev.map(c => {
                                if (c.id === chat.id) {
                                  return { ...c, title: input.value };
                                }
                                return c;
                              }));
                              input.parentElement?.replaceChild(
                                document.createTextNode(input.value),
                                input
                              );
                            };
                            const span = e.currentTarget.parentElement?.previousElementSibling?.firstChild;
                            if (span) {
                              span.parentElement?.replaceChild(input, span);
                              input.focus();
                            }
                          }}
                          className="p-1 hover:bg-[#363636] rounded transition-colors text-[#a3a3a3] hover:text-[#e2e2e2]"
                          title="Başlığı Düzenle"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setChatSessions(prev => prev.filter(c => c.id !== chat.id));
                            if (activeChatId === chat.id) {
                              setActiveChatId(null);
                              setChatHistory([]);
                            }
                          }}
                          className="p-1 hover:bg-[#363636] rounded transition-colors text-[#a3a3a3] hover:text-[#e2e2e2]"
                          title="Sohbeti Sil"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="text-xs text-[#a3a3a3] mt-1">
                      {new Date(chat.createdAt).toLocaleDateString('tr-TR')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Panel Açma/Kapama Butonu */}
        <button
          onClick={() => setIsPanelOpen(!isPanelOpen)}
          className={`fixed right-0 top-6 p-2 rounded-l-lg glass-effect-strong hover:bg-[#1f1f1f] transition-all duration-300 z-[9999] ${
            isPanelOpen ? 'translate-x-[-288px]' : 'translate-x-0'
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-6 w-6 text-[#e2e2e2] transition-transform duration-300 ${isPanelOpen ? 'rotate-0' : 'rotate-180'}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>

        {/* Ana İçerik */}
        <div 
          className={`flex-1 flex flex-col transition-all duration-300 ${chatHistory.length === 0 ? 'overflow-hidden' : ''}`}
          style={{
            marginRight: isPanelOpen ? '288px' : '0px',
            marginLeft: '32px'
          }}
        >
          {/* Messages Area */}
          <div className={`flex-1 ${chatHistory.length === 0 ? 'overflow-hidden' : 'overflow-y-auto'} pt-4 pb-52 z-[999] h-full`}>
            <div className="max-w-5xl mx-auto px-4 space-y-6">
              {chatHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)]">
                  <div className="w-full max-w-3xl mb-8 text-center">
                    <h2 className="text-[#e2e2e2] text-3xl font-semibold tracking-wide">Ne hakkında konuşmak istersin?</h2>
                  </div>
                  <div className="w-full max-w-3xl transform transition-all duration-500 ease-out">
                    <div className={`glass-effect rounded-2xl p-3 transition-colors duration-300`}>
                      <form onSubmit={handleSubmit} className="flex flex-col space-y-3">
                        {/* Mesaj Giriş Alanı */}
                        <div className="flex-1">
                          {showSearchInput ? (
                            <input
                              type="text"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              placeholder="Aramak istediğiniz konuyu yazın..."
                              className="w-full bg-transparent text-[#e2e2e2] placeholder-[#a3a3a3] px-4 py-3 focus:outline-none"
                            />
                          ) : isAgentMode ? (
                            <input
                              type="text"
                              value={message}
                              onChange={(e) => setMessage(e.target.value)}
                              placeholder="Ajanla sohbet edin..."
                              className="w-full bg-transparent text-[#e2e2e2] placeholder-[#a3a3a3] px-4 py-3 focus:outline-none"
                            />
                          ) : isAkilliAnaliz ? (
                            <input
                              type="text"
                              value={message}
                              onChange={(e) => setMessage(e.target.value)}
                              placeholder="Muhakeme et..."
                              className="w-full bg-transparent text-[#e2e2e2] placeholder-[#a3a3a3] px-4 py-3 focus:outline-none"
                            />
                          ) : (
                            <input
                              type="text"
                              value={message}
                              onChange={(e) => setMessage(e.target.value)}
                              placeholder="Mesajınızı yazın..."
                              className="w-full bg-transparent text-[#e2e2e2] placeholder-[#a3a3a3] px-4 py-3 focus:outline-none"
                            />
                          )}
                        </div>

                        {/* Butonlar */}
                        <div className="flex items-center justify-between px-4">
                          {/* Sol Taraftaki Butonlar */}
                          <div className="flex items-center gap-2">
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setShowModelDropdown(!showModelDropdown)}
                                className={`w-[160px] flex items-center justify-center px-3 py-1 bg-[#2B2B2B] text-[#a3a3a3] hover:bg-[#1f1f1f] hover:text-[#e2e2e2] rounded-full transition-colors duration-200`}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                                </svg>
                                <span className="text-xs tracking-wide capitalize">
                                  {modelNames[selectedModel as keyof typeof modelNames] || selectedModel}
                                </span>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 ml-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                              
                              {showModelDropdown && (
                                <div className="absolute bottom-full left-0 mb-1 w-[160px] bg-[#2B2B2B] border border-[#363636] rounded-xl shadow-lg py-1 z-50">
                                  {Object.keys(modelConfigs).map((model) => (
                                    <button
                                      key={model}
                                      onClick={() => {
                                        setSelectedModel(model);
                                        setShowModelDropdown(false);
                                      }}
                                      className={`w-full text-left px-4 py-2 text-xs ${
                                        selectedModel === model ? 'bg-[#363636] text-[#e2e2e2]' : 'text-[#a3a3a3]'
                                      } hover:bg-[#363636] hover:text-[#e2e2e2] transition-colors duration-200`}
                                    >
                                      {modelNames[model as keyof typeof modelNames]}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={toggleAgentMode}
                              className={`w-[90px] flex items-center justify-center px-3 py-1 ${
                                isAgentMode 
                                  ? 'bg-[#4C8636] text-[#e2e2e2] hover:bg-[#4C8636]/90' 
                                  : 'bg-[#2B2B2B] text-[#a3a3a3] hover:bg-[#1f1f1f] hover:text-[#e2e2e2]'
                              } rounded-full transition-colors duration-200`}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              <span className="text-xs tracking-wide">Ajan</span>
                            </button>
                            
                            <button
                              type="button"
                              onClick={toggleAkilliAnaliz}
                              className={`w-[120px] flex items-center justify-center px-3 py-1 ${
                                isAkilliAnaliz 
                                  ? 'bg-[#4C8636] text-[#e2e2e2] hover:bg-[#4C8636]/90' 
                                  : 'bg-[#2B2B2B] text-[#a3a3a3] hover:bg-[#1f1f1f] hover:text-[#e2e2e2]'
                              } rounded-full transition-colors duration-200`}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                              </svg>
                              <span className="text-xs tracking-wide">Muhakeme</span>
                            </button>

                            <button
                              type="button"
                              onClick={toggleSearchMode}
                              className={`w-[90px] flex items-center justify-center px-3 py-1 ${
                                showSearchInput 
                                  ? 'bg-[#4C8636] text-[#e2e2e2] hover:bg-[#4C8636]/90' 
                                  : 'bg-[#2B2B2B] text-[#a3a3a3] hover:bg-[#1f1f1f] hover:text-[#e2e2e2]'
                              } rounded-full transition-colors duration-200`}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                              </svg>
                              <span className="text-xs tracking-wide">Ara</span>
                            </button>
                          </div>

                          {/* Sağ Taraftaki Butonlar */}
                          <div className="flex items-center space-x-3">
                            <label className="inline-flex items-center justify-center p-3 text-[#4C8636] hover:text-[#4C8636] cursor-pointer transition-colors relative group">
                              <input
                                type="file"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                onChange={handleFileUpload}
                                accept=".txt,.pdf,.doc,.docx"
                                disabled={isUploading}
                              />
                              {isUploading ? (
                                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"/>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              )}
                            </label>
                            <button
                              type="submit"
                              disabled={isLoading || (!message.trim() && !searchQuery.trim())}
                              className="inline-flex items-center justify-center p-3 text-[#4C8636] hover:text-[#4C8636] disabled:opacity-50 disabled:cursor-not-allowed transition-colors relative group"
                            >
                              <svg 
                                xmlns="http://www.w3.org/2000/svg" 
                                className="h-6 w-6" 
                                fill="none" 
                                viewBox="0 0 24 24" 
                                stroke="currentColor"
                              >
                                <path 
                                  strokeLinecap="round" 
                                  strokeLinejoin="round" 
                                  strokeWidth={2} 
                                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                                />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              ) : (
                chatHistory.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex ${msg.role === 'user' ? 'justify-end pr-4' : 'justify-start'} group`}
                  >
                    <div className="flex items-start gap-2">
                      {msg.role === 'user' ? (
                        <>
                          <div className="flex flex-col items-end">
                            <div className={`bg-[#2b2b2b] text-[#e2e2e2] border border-[#363636] rounded-2xl ${!msg.content.includes('\n') && msg.content.length < 50 ? 'px-6 pr-12' : 'px-6'} py-3.5 max-w-[85%] backdrop-blur-none transition-colors duration-200`}>
                              <p 
                                className="text-[15px] leading-relaxed text-left"
                                dangerouslySetInnerHTML={{ __html: parseMarkdown(msg.content) }}
                              />
                            </div>
                            {/* Kullanıcı mesajı için butonlar */}
                            <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-2">
                              <button
                                onClick={() => navigator.clipboard.writeText(msg.content)}
                                className="p-1 hover:bg-[#2b2b2b] rounded-full transition-colors text-[#a3a3a3] hover:text-[#e2e2e2]"
                                title="Mesajı Kopyala"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => {
                                  setMessage(msg.content);
                                  const inputElement = document.querySelector('input[type="text"]') as HTMLInputElement;
                                  if (inputElement) {
                                    inputElement.focus();
                                  }
                                }}
                                className="p-1 hover:bg-[#2b2b2b] rounded-full transition-colors text-[#a3a3a3] hover:text-[#e2e2e2]"
                                title="Mesajı Düzenle"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex flex-col items-start">
                            <div className="text-[#e2e2e2] px-1 py-1 max-w-[85%]">
                              <p 
                                className="text-[15px] leading-relaxed text-left"
                                dangerouslySetInnerHTML={{ __html: parseMarkdown(msg.content) }}
                              />
                              
                              {/* Search Results */}
                              {msg.searchResults && (
                                <div className="mt-4 space-y-2">
                                  <div className="text-sm text-[#4C8636] font-medium">Arama Kaynakları:</div>
                                  <div className="text-sm bg-[#1f1f1f] rounded-lg p-3 text-[#a3a3a3]">
                                    <p>Bu sonuçlar {modelNames[msg.model as keyof typeof modelNames] || 'AI'} üzerinden elde edilmiştir.</p>
                                    <p className="mt-2">Kaynak: {modelNames[msg.model as keyof typeof modelNames] || 'AI'}</p>
                                  </div>
                                </div>
                              )}
                              
                              {/* DerinDüş düşünceleri */}
                              {msg.thoughts && (
                                <div className="mt-4 space-y-2">
                                  <div className="text-sm text-[#4C8636] font-medium">Muhakeme Adımları:</div>
                                  <div className="space-y-2">
                                    {msg.thoughts.map((thought, i) => (
                                      <div key={i} className="text-sm bg-[#1f1f1f] rounded-lg p-3">
                                        <div className="font-medium text-[#e2e2e2] mb-1">{thought.step}</div>
                                        <div 
                                          className="text-[#a3a3a3]"
                                          dangerouslySetInnerHTML={{ __html: parseMarkdown(thought.thought) }}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {msg.hasContext && (
                                <div className="mt-2 text-xs text-[#4C8636]/80 flex items-center">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"/>
                                  </svg>
                                  Doküman bilgisi kullanıldı
                                </div>
                              )}
                              {msg.model && (
                                <div className="mt-2 text-xs text-[#a3a3a3]/60">
                                  {modelNames[msg.model as keyof typeof modelNames]}
                                </div>
                              )}
                            </div>
                            {/* AI mesajı için butonlar */}
                            <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-2">
                              <button
                                onClick={() => {
                                  // Son kullanıcı mesajını bul
                                  const lastUserMessage = chatHistory.slice(0, index).reverse().find(m => m.role === 'user');
                                  if (lastUserMessage) {
                                    // AI'ın bu mesajını sil
                                    const newChatHistory = chatHistory.slice(0, index);
                                    setChatHistory(newChatHistory);
                                    
                                    // Yeni yanıt için yükleniyor durumuna geç
                                    setIsLoading(true);
                                    
                                    // Yeni yanıt al
                                    fetch('http://localhost:3001/api/chat', {
                                      method: 'POST',
                                      headers: {
                                        'Content-Type': 'application/json',
                                      },
                                      body: JSON.stringify({ 
                                        message: lastUserMessage.content,
                                        useContext: msg.hasContext 
                                      }),
                                    })
                                    .then(response => response.json())
                                    .then(data => {
                                      const aiMessage = { 
                                        role: 'assistant', 
                                        content: data.reply,
                                        hasContext: data.hasContext 
                                      };
                                      setChatHistory([...newChatHistory, aiMessage]);
                                    })
                                    .catch(error => {
                                      console.error('Error:', error);
                                      setChatHistory([...newChatHistory, { 
                                        role: 'assistant', 
                                        content: 'Üzgünüm, bir hata oluştu.',
                                        hasContext: false 
                                      }]);
                                    })
                                    .finally(() => {
                                      setIsLoading(false);
                                    });
                                  }
                                }}
                                className="p-1 hover:bg-[#2b2b2b] rounded-full transition-colors text-[#a3a3a3] hover:text-[#e2e2e2]"
                                title="Yeni Yanıt İste"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                              </button>
                              <button
                                onClick={() => navigator.clipboard.writeText(msg.content)}
                                className="p-1 hover:bg-[#2b2b2b] rounded-full transition-colors text-[#a3a3a3] hover:text-[#e2e2e2]"
                                title="Mesajı Kopyala"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
              {isLoading && (
                <div className="flex justify-center">
                  <div className={`flex items-center space-x-2 glass-effect rounded-full px-4 py-2`}>
                    <div className="w-2 h-2 bg-[#4C8636] rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-2 h-2 bg-[#4C8636] rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-2 h-2 bg-[#4C8636] rounded-full animate-bounce"></div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Input Area */}
          {chatHistory.length > 0 && (
            <div className="fixed bottom-0 left-0 right-0 bg-[#0f0f0f] py-6 transform transition-all duration-300 ease-in-out z-[9998]"
              style={{
                marginRight: isPanelOpen ? '288px' : '0px',
                marginLeft: '32px'
              }}
            >
              <div className="max-w-3xl mx-auto">
                <div className={`glass-effect backdrop-blur-xl rounded-2xl p-3 transition-all duration-300 ease-in-out z-5`}>
                  <form onSubmit={handleSubmit} className="flex flex-col space-y-3">
                    {/* Mesaj Giriş Alanı */}
                    <div className="flex-1">
                      {showSearchInput ? (
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Aramak istediğiniz konuyu yazın..."
                          className="w-full bg-transparent text-[#e2e2e2] placeholder-[#a3a3a3] px-4 py-3 focus:outline-none"
                        />
                      ) : isAgentMode ? (
                        <input
                          type="text"
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          placeholder="Ajanla sohbet edin..."
                          className="w-full bg-transparent text-[#e2e2e2] placeholder-[#a3a3a3] px-4 py-3 focus:outline-none"
                        />
                      ) : isAkilliAnaliz ? (
                        <input
                          type="text"
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          placeholder="Muhakeme et..."
                          className="w-full bg-transparent text-[#e2e2e2] placeholder-[#a3a3a3] px-4 py-3 focus:outline-none"
                        />
                      ) : (
                        <input
                          type="text"
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          placeholder="Mesajınızı yazın..."
                          className="w-full bg-transparent text-[#e2e2e2] placeholder-[#a3a3a3] px-4 py-3 focus:outline-none"
                        />
                      )}
                    </div>

                    {/* Butonlar */}
                    <div className="flex items-center justify-between px-4">
                      {/* Sol Taraftaki Butonlar */}
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setShowModelDropdown(!showModelDropdown)}
                            className={`w-[160px] flex items-center justify-center px-3 py-1 bg-[#2B2B2B] text-[#a3a3a3] hover:bg-[#1f1f1f] hover:text-[#e2e2e2] rounded-full transition-colors duration-200`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                            </svg>
                            <span className="text-xs tracking-wide capitalize">
                              {modelNames[selectedModel as keyof typeof modelNames] || selectedModel}
                            </span>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 ml-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          
                          {showModelDropdown && (
                            <div className="absolute bottom-full left-0 mb-1 w-[160px] bg-[#2B2B2B] border border-[#363636] rounded-xl shadow-lg py-1 z-50">
                              {Object.keys(modelConfigs).map((model) => (
                                <button
                                  key={model}
                                  onClick={() => {
                                    setSelectedModel(model);
                                    setShowModelDropdown(false);
                                  }}
                                  className={`w-full text-left px-4 py-2 text-xs ${
                                    selectedModel === model ? 'bg-[#363636] text-[#e2e2e2]' : 'text-[#a3a3a3]'
                                  } hover:bg-[#363636] hover:text-[#e2e2e2] transition-colors duration-200`}
                                >
                                  {modelNames[model as keyof typeof modelNames]}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={toggleAgentMode}
                          className={`w-[90px] flex items-center justify-center px-3 py-1 ${
                            isAgentMode 
                              ? 'bg-[#4C8636] text-[#e2e2e2] hover:bg-[#4C8636]/90' 
                              : 'bg-[#2B2B2B] text-[#a3a3a3] hover:bg-[#1f1f1f] hover:text-[#e2e2e2]'
                          } rounded-full transition-colors duration-200`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          <span className="text-xs tracking-wide">Ajan</span>
                        </button>
                        
                        <button
                          type="button"
                          onClick={toggleAkilliAnaliz}
                          className={`w-[120px] flex items-center justify-center px-3 py-1 ${
                            isAkilliAnaliz 
                              ? 'bg-[#4C8636] text-[#e2e2e2] hover:bg-[#4C8636]/90' 
                              : 'bg-[#2B2B2B] text-[#a3a3a3] hover:bg-[#1f1f1f] hover:text-[#e2e2e2]'
                          } rounded-full transition-colors duration-200`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                          <span className="text-xs tracking-wide">Muhakeme</span>
                        </button>

                        <button
                          type="button"
                          onClick={toggleSearchMode}
                          className={`w-[90px] flex items-center justify-center px-3 py-1 ${
                            showSearchInput 
                              ? 'bg-[#4C8636] text-[#e2e2e2] hover:bg-[#4C8636]/90' 
                              : 'bg-[#2B2B2B] text-[#a3a3a3] hover:bg-[#1f1f1f] hover:text-[#e2e2e2]'
                          } rounded-full transition-colors duration-200`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                          <span className="text-xs tracking-wide">Ara</span>
                        </button>
                      </div>

                      {/* Sağ Taraftaki Butonlar */}
                      <div className="flex items-center space-x-3">
                        <label className="inline-flex items-center justify-center p-3 text-[#4C8636] hover:text-[#4C8636] cursor-pointer transition-colors relative group">
                          <input
                            type="file"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            onChange={handleFileUpload}
                            accept=".txt,.pdf,.doc,.docx"
                            disabled={isUploading}
                          />
                          {isUploading ? (
                            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"/>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          )}
                        </label>
                        <button
                          type="submit"
                          disabled={isLoading || (!message.trim() && !searchQuery.trim())}
                          className="inline-flex items-center justify-center p-3 text-[#4C8636] hover:text-[#4C8636] disabled:opacity-50 disabled:cursor-not-allowed transition-colors relative group"
                        >
                          <svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            className="h-6 w-6" 
                            fill="none" 
                            viewBox="0 0 24 24" 
                            stroke="currentColor"
                          >
                            <path 
                              strokeLinecap="round" 
                              strokeLinejoin="round" 
                              strokeWidth={2} 
                              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
