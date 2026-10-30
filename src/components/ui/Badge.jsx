import React from 'react';

const statusConfig = {
  Available:   { bg: 'bg-green-500/10 dark:bg-green-500/10',  text: 'text-green-700 dark:text-green-400',  dot: 'bg-green-500',  border: 'border-green-500/30'  },
  Rented:      { bg: 'bg-blue-500/10 dark:bg-blue-500/10',   text: 'text-blue-700 dark:text-blue-400',   dot: 'bg-blue-500',   border: 'border-blue-500/30'   },
  Maintenance: { bg: 'bg-orange-500/10 dark:bg-orange-500/10', text: 'text-orange-700 dark:text-orange-400', dot: 'bg-orange-500', border: 'border-orange-500/30' },
  Pending:     { bg: 'bg-yellow-500/10 dark:bg-yellow-500/10', text: 'text-yellow-700 dark:text-yellow-400', dot: 'bg-yellow-500', border: 'border-yellow-500/30' },
  Confirmed:   { bg: 'bg-blue-500/10 dark:bg-blue-500/10',   text: 'text-blue-700 dark:text-blue-400',   dot: 'bg-blue-500',   border: 'border-blue-500/30'   },
  Completed:   { bg: 'bg-green-500/10 dark:bg-green-500/10',  text: 'text-green-700 dark:text-green-400',  dot: 'bg-green-500',  border: 'border-green-500/30'  },
  Cancelled:   { bg: 'bg-red-500/10 dark:bg-red-500/10',    text: 'text-red-700 dark:text-red-400',    dot: 'bg-red-500',    border: 'border-red-500/30'    },
  Sedan:       { bg: 'bg-purple-500/10 dark:bg-purple-500/10', text: 'text-purple-700 dark:text-purple-400', dot: 'bg-purple-500', border: 'border-purple-500/30' },
  SUV:         { bg: 'bg-cyan-500/10 dark:bg-cyan-500/10',   text: 'text-cyan-700 dark:text-cyan-400',   dot: 'bg-cyan-500',   border: 'border-cyan-500/30'   },
  Hatchback:   { bg: 'bg-teal-500/10 dark:bg-teal-500/10',   text: 'text-teal-700 dark:text-teal-400',   dot: 'bg-teal-500',   border: 'border-teal-500/30'   },
  Luxury:      { bg: 'bg-amber-500/10 dark:bg-amber-500/10',  text: 'text-amber-700 dark:text-amber-400',  dot: 'bg-amber-500',  border: 'border-amber-500/30'  },
  Sports:      { bg: 'bg-red-500/10 dark:bg-red-500/10',    text: 'text-red-700 dark:text-red-400',    dot: 'bg-red-500',    border: 'border-red-500/30'    },
  Electric:    { bg: 'bg-green-500/10 dark:bg-green-500/10',  text: 'text-green-700 dark:text-green-400',  dot: 'bg-green-500',  border: 'border-green-500/30'  },
  Hypercar:    { bg: 'bg-amber-500/15 dark:bg-amber-500/15', text: 'text-amber-600 dark:text-amber-400 font-extrabold', dot: 'bg-amber-400', border: 'border-amber-500/40' },
  Supercar:    { bg: 'bg-rose-500/15 dark:bg-rose-500/15',   text: 'text-rose-600 dark:text-rose-400 font-extrabold',   dot: 'bg-rose-500',   border: 'border-rose-500/40'   },
};

export default function Badge({ status, showDot = true, className = '' }) {
  const config = statusConfig[status] || { bg: 'bg-gray-500/10', text: 'text-gray-700 dark:text-gray-400', dot: 'bg-gray-500', border: 'border-gray-500/20' };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${config.bg} ${config.text} ${config.border} ${className}`}>
      {showDot && <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />}
      {status}
    </span>
  );
}
