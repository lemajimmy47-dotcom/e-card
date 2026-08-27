import React, { useState } from 'react';
import { ShieldCheck, RefreshCw, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Server, MessageSquare, Smartphone } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DebugSection {
  title: string;
  icon: React.ReactNode;
  status: 'ok' | 'error' | 'skipped' | 'not_configured' | 'loading' | 'idle';
  message?: string;
  response?: any;
}

export const ConnectivityDebug: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const runDiagnostics = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/debug/connectivity');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      setResults(data);
    } catch (err: any) {
      setError(err.message || 'Failed to run diagnostics');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ok': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case 'error': return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'loading': return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'skipped':
      case 'not_configured': return <AlertCircle className="w-5 h-5 text-amber-500" />;
      default: return null;
    }
  };

  const sections: DebugSection[] = [
    {
      title: 'Database (Cloud SQL)',
      icon: <Server className="w-5 h-5" />,
      status: results?.database?.status || (loading ? 'loading' : 'idle'),
      message: results?.database?.message,
      response: results?.database
    },
    {
      title: 'WhatsApp (Meta API)',
      icon: <MessageSquare className="w-5 h-5" />,
      status: results?.whatsapp?.status || (loading ? 'loading' : 'idle'),
      message: results?.whatsapp?.message,
      response: results?.whatsapp
    },
    {
      title: 'SMS Gateway (Meseji)',
      icon: <Smartphone className="w-5 h-5" />,
      status: results?.sms?.status || (loading ? 'loading' : 'idle'),
      message: results?.sms?.message,
      response: results?.sms
    }
  ];

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="w-8 h-8 text-blue-600" />
            Connectivity Diagnostics
          </h2>
          <p className="text-gray-500 mt-1">Test your API connections and verify gateway health</p>
        </div>
        <button
          onClick={runDiagnostics}
          disabled={loading}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Running Tests...' : 'Run All Tests'}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
          <AlertCircle className="w-5 h-5" />
          <p>{error}</p>
        </div>
      )}

      <div className="grid gap-4">
        {sections.map((section) => (
          <div key={section.title} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <button
              onClick={() => setExpandedSection(expandedSection === section.title ? null : section.title)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-lg ${
                  section.status === 'ok' ? 'bg-emerald-50 text-emerald-600' :
                  section.status === 'error' ? 'bg-red-50 text-red-600' :
                  section.status === 'idle' ? 'bg-gray-50 text-gray-400' :
                  'bg-amber-50 text-amber-600'
                }`}>
                  {section.icon}
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-gray-900">{section.title}</h3>
                  {section.message && (
                    <p className={`text-sm ${section.status === 'error' ? 'text-red-500' : 'text-gray-500'}`}>
                      {section.message}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4">
                {getStatusIcon(section.status)}
                {expandedSection === section.title ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
              </div>
            </button>

            <AnimatePresence>
              {expandedSection === section.title && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  className="overflow-hidden bg-gray-50 border-t border-gray-100"
                >
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Raw JSON Response</span>
                      {section.response?.httpStatus && (
                        <span className={`text-xs px-2 py-1 rounded font-mono ${
                          section.response.httpStatus >= 200 && section.response.httpStatus < 300 
                          ? 'bg-emerald-100 text-emerald-700' 
                          : 'bg-red-100 text-red-700'
                        }`}>
                          HTTP {section.response.httpStatus}
                        </span>
                      )}
                    </div>
                    <pre className="bg-gray-900 text-blue-300 p-4 rounded-lg overflow-x-auto text-sm font-mono leading-relaxed max-h-[400px]">
                      {section.response ? JSON.stringify(section.response, null, 2) : '// No data available'}
                    </pre>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-6">
        <h4 className="font-bold text-blue-900 flex items-center gap-2 mb-2">
          <AlertCircle className="w-5 h-5" />
          Troubleshooting Tips
        </h4>
        <ul className="space-y-2 text-sm text-blue-800">
          <li>• <strong>WhatsApp:</strong> Ensure your Phone ID and Access Token are copied exactly from the Meta Developer Dashboard.</li>
          <li>• <strong>SMS:</strong> Check your Meseji.co.tz account balance. Messages cannot be sent if your balance is zero.</li>
          <li>• <strong>Templates:</strong> Make sure the template names in your Meta dashboard match exactly with "shukrani", "ukumbusho", or your custom template names.</li>
          <li>• <strong>Numbers:</strong> Ensure phone numbers start with country code (e.g., 255...) and contain no spaces.</li>
        </ul>
      </div>
    </div>
  );
};
