import React, { useEffect, useState, useRef } from "react";

export function BgmPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.2);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch((e) => console.error("Audio block:", e));
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className="bgmPlayer">
      <audio ref={audioRef} loop src="https://stream.zeno.fm/0r0xa792kwzuv" />
      <button type="button" className={`toolbarBtn ${isPlaying ? "bgmActive" : ""}`} onClick={togglePlay} title="Lofi Radio">
        {isPlaying ? "⏸ Tạm dừng nhạc" : "🎵 Bật Lofi"}
      </button>
      {isPlaying && (
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="bgmVolume"
        />
      )}
    </div>
  );
}
