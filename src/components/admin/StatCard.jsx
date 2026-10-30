import React from 'react';
import { motion } from 'framer-motion';

export default function StatCard({ title, value, icon: Icon, color = 'amber', subtitle }) {
  const colors = {
    amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: 'text-amber-500', text: 'text-amber-500' },
    green: { bg: 'bg-green-500/10', border: 'border-green-500/20', icon: 'text-green-500 dark:text-green-400', text: 'text-green-600 dark:text-green-400' },
    blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: 'text-blue-500 dark:text-blue-400', text: 'text-blue-600 dark:text-blue-400' },
    red: { bg: 'bg-red-500/10', border: 'border-red-500/20', icon: 'text-red-500 dark:text-red-400', text: 'text-red-600 dark:text-red-400' },
    purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/20', icon: 'text-purple-500 dark:text-purple-400', text: 'text-purple-600 dark:text-purple-400' },
  };
  const c = colors[color] || colors.amber;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-[#161616] border border-gray-200 dark:border-white/[0.08] rounded-2xl p-5 shadow-sm"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">{title}</p>
          <p className={`text-2xl font-black ${c.text}`}>{value}</p>
          {subtitle && <p className="text-gray-500 text-xs mt-1 font-medium">{subtitle}</p>}
        </div>
        <div className={`w-11 h-11 ${c.bg} border ${c.border} rounded-xl flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-5 h-5 ${c.icon}`} />
        </div>
      </div>
    </motion.div>
  );
}
