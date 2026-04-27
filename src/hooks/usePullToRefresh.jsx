import { useEffect, useRef, useState } from 'react';

export function usePullToRefresh(onRefresh) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef(0);
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let isScrolled = false;

    const handleTouchStart = (e) => {
      touchStartY.current = e.touches[0].clientY;
      isScrolled = container.scrollTop > 0;
    };

    const handleTouchMove = (e) => {
      if (isRefreshing || isScrolled) return;

      const touchY = e.touches[0].clientY;
      const distance = touchY - touchStartY.current;

      if (distance > 0 && container.scrollTop === 0) {
        e.preventDefault();
        setPullDistance(Math.min(distance, 100));
      }
    };

    const handleTouchEnd = async () => {
      if (pullDistance > 50 && !isRefreshing) {
        setIsRefreshing(true);
        setPullDistance(0);
        
        try {
          await onRefresh();
        } finally {
          setIsRefreshing(false);
        }
      } else {
        setPullDistance(0);
      }
    };

    container.addEventListener('touchstart', handleTouchStart, false);
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isRefreshing, pullDistance, onRefresh]);

  return { containerRef, isRefreshing, pullDistance };
}