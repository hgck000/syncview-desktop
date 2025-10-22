import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export function HotkeyHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const showTimer = setTimeout(() => {
      setVisible(true);
    }, 1000);

    const hideTimer = setTimeout(() => {
      setVisible(false);
    }, 8000); // Show for 7 seconds (1s delay + 7s visible)

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20, transition: { duration: 0.5 } }}
          transition={{ duration: 0.3 }}
          className="absolute top-4 right-4 bg-gray-800 text-white px-4 py-2 rounded-md shadow-lg pointer-events-none"
        >
          Press 'H' to show keymap
        </motion.div>
      )}
    </AnimatePresence>
  );
}