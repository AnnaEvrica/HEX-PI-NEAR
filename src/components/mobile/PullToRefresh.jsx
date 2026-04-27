import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';

export default function PullToRefresh({ isRefreshing, pullDistance }) {
  const rotateProgress = (pullDistance / 100) * 360;

  return (
    <motion.div
      className="flex justify-center items-center py-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: isRefreshing || pullDistance > 0 ? 1 : 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        animate={{ rotate: isRefreshing ? 360 : rotateProgress }}
        transition={{ duration: isRefreshing ? 1 : 0, repeat: isRefreshing ? Infinity : 0 }}
      >
        <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'text-accent' : 'text-secondary'}`} />
      </motion.div>
      <span className="ml-2 text-xs text-secondary">
        {isRefreshing ? 'Refreshing...' : pullDistance > 50 ? 'Release to refresh' : 'Pull to refresh'}
      </span>
    </motion.div>
  );
}