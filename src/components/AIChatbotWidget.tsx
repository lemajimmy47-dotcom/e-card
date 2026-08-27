import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Sparkles, MessageSquare, RefreshCw, ChevronDown } from 'lucide-react';

interface AIChatbotWidgetProps {
  eventId?: string;
  language?: 'sw' | 'en';
}

interface Message {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  time: string;
}

export const AIChatbotWidget: React.FC<AIChatbotWidgetProps> = ({ eventId, language = 'sw' }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: language === 'sw' 
        ? "Habari! Mimi ni **Msaidizi wa AI wa EVENTCARD** 🤖.\n\nNinaweza kuwasaidia **Wageni Waalikwa** na **Wanakamati**:\n• **Kwa Mgeni:** Niulize ukumbi ulipo, tarehe, mchango au jinsi ya kuthibitisha RSVP.\n• **Kwa Kamati:** Niulize kuhusu orodha ya wageni, ahadi (pledges), au bajeti ya sherehe!" 
        : "Hello! I am the **EVENTCARD AI Assistant** 🤖.\n\nI can assist both **Guests** and **Committee Members**:\n• **For Guests:** Ask about venue, date, contribution instructions, or RSVP.\n• **For Committee:** Ask about pledges, guest list, payments, or budget!",
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOpenEvent = () => setIsOpen(true);
    window.addEventListener('open-ai-chatbot', handleOpenEvent);
    return () => window.removeEventListener('open-ai-chatbot', handleOpenEvent);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || loading) return;

    const userMsg: Message = {
      id: 'msg-' + Date.now(),
      sender: 'user',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setLoading(true);

    try {
      const response = await fetch('/api/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, eventId })
      });

      const data = await response.json();
      
      const botReplyText = data.reply || (language === 'sw' 
        ? "Samahani, imetokea hitilafu ndogo wakati wa kuwasiliana na Msaidizi wa AI." 
        : "Sorry, an error occurred while connecting to the AI Assistant.");

      const botMsg: Message = {
        id: 'bot-' + Date.now(),
        sender: 'bot',
        text: botReplyText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      console.error('Failed to send AI chat message:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: 'err-' + Date.now(),
          sender: 'bot',
          text: language === 'sw'
            ? "⚠️ Tatizo la mtandao. Tafadhali jaribu tena baadaye."
            : "⚠️ Network connection issue. Please try again.",
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Render markdown bold text nicely
  const renderFormattedText = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, idx) => {
      // replace **text** with bold
      const parts = line.split(/(\*\*.*?\*\*)/g);
      const renderedParts = parts.map((part, pIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={pIdx} className="font-extrabold text-amber-300">{part.slice(2, -2)}</strong>;
        }
        return part;
      });

      return (
        <p key={idx} className={line.trim() === '' ? 'h-2' : 'mb-1 leading-relaxed'}>
          {renderedParts}
        </p>
      );
    });
  };

  return (
    <>
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          id="ai-chatbot-toggle-btn"
          className="fixed bottom-6 right-6 z-[99999] group flex items-center gap-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white p-3.5 pl-4 rounded-full shadow-[0_10px_35px_rgba(79,70,229,0.7)] hover:scale-105 active:scale-95 transition-all duration-300 border-2 border-amber-400/60 ring-4 ring-purple-500/30"
          title={language === 'sw' ? 'Msaidizi wa AI' : 'AI Assistant'}
        >
          <div className="relative">
            <Bot className="w-6 h-6 text-white" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-90"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-300"></span>
            </span>
          </div>
          <span className="font-extrabold text-xs tracking-wide text-white">
            {language === 'sw' ? 'Msaidizi wa AI' : 'AI Assistant'}
          </span>
          <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
        </button>
      )}

      {/* Chat Drawer/Modal */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 z-[99999] w-[92vw] sm:w-[420px] max-h-[85vh] h-[580px] bg-slate-900/98 backdrop-blur-2xl border-2 border-indigo-500/50 rounded-3xl shadow-[0_20px_70px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-300">
          
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-4 py-3.5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-white shadow-md border border-white/10">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-sm text-white tracking-wide">EVENTCARD AI</h3>
                  <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-extrabold px-1.5 py-0.2 rounded-full uppercase">
                    Active
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">
                  {language === 'sw' ? 'Msaidizi Wako wa Mfumo na Kamati' : 'Your Smart Event & Committee Assistant'}
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Action Suggestion Chips */}
          <div className="bg-slate-950/60 p-2 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto text-[11px] no-scrollbar">
            <button
              onClick={() => handleSendMessage(language === 'sw' ? 'Muhtasari wa michango na bajeti' : 'Pledge and budget summary')}
              className="px-2.5 py-1 rounded-full bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-300 whitespace-nowrap transition font-medium text-[10px]"
            >
              📊 {language === 'sw' ? 'Michango & Bajeti' : 'Pledges & Budget'}
            </button>
            <button
              onClick={() => handleSendMessage(language === 'sw' ? 'Hali ya wageni na waliolipa' : 'Guest list and payment status')}
              className="px-2.5 py-1 rounded-full bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 whitespace-nowrap transition font-medium text-[10px]"
            >
              👥 {language === 'sw' ? 'Wageni Waliolipa' : 'Guest Payments'}
            </button>
            <button
              onClick={() => handleSendMessage(language === 'sw' ? 'Hali ya RSVP na Kadi' : 'RSVP responses status')}
              className="px-2.5 py-1 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 whitespace-nowrap transition font-medium text-[10px]"
            >
              📩 {language === 'sw' ? 'RSVP Status' : 'RSVP Status'}
            </button>
            <button
              onClick={() => handleSendMessage(language === 'sw' ? 'Jinsi ya kutuma SMS na WhatsApp' : 'How to send SMS & WhatsApp')}
              className="px-2.5 py-1 rounded-full bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 whitespace-nowrap transition font-medium text-[10px]"
            >
              💬 SMS / WhatsApp
            </button>
          </div>

          {/* Chat Messages */}
          <div className="flex-grow p-4 overflow-y-auto space-y-3.5 text-xs bg-slate-950/40">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.sender === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`p-3.5 rounded-2xl max-w-[85%] shadow-md text-xs font-sans ${
                    msg.sender === 'user'
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-br-none border border-blue-400/20'
                      : 'bg-slate-800/90 text-slate-200 rounded-bl-none border border-slate-700/80'
                  }`}
                >
                  {renderFormattedText(msg.text)}
                  <div
                    className={`text-[9px] mt-1.5 font-mono ${
                      msg.sender === 'user' ? 'text-blue-200 text-right' : 'text-slate-400'
                    }`}
                  >
                    {msg.time}
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-slate-400 p-3 bg-slate-800/50 rounded-2xl max-w-[70%] border border-slate-700/50 animate-pulse">
                <Sparkles className="w-4 h-4 text-purple-400 animate-spin" />
                <span className="text-xs">{language === 'sw' ? 'Inafikiria...' : 'Thinking...'}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                language === 'sw'
                  ? 'Andika swali au omba ushauri wa AI...'
                  : 'Ask a question or request AI advice...'
              }
              className="flex-grow bg-slate-950 border border-slate-700/80 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
              disabled={loading}
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={!inputMessage.trim() || loading}
              className="p-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-md"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
