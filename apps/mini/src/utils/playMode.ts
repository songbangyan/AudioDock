import { useState } from 'react';

export type PlayMode = 'MUSIC' | 'AUDIOBOOK';

export const usePlayMode = () => {
  const [mode, setMode] = useState<PlayMode>('MUSIC');

  return {
    mode,
    setMode
  };
};
