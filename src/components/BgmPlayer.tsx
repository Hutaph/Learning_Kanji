import React, { useEffect, useState, useRef } from "react";
import { Music2, Pause } from "lucide-react";

const STREAM_URL = "https://stream.zeno.fm/0r0xa792kwzuv";

export function BgmPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [volumePct, setVolumePct] = useState(55);
  const [streamVersion, setStreamVersion] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volumePct / 100;
    }
  }, [volumePct]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    // Warm up stream connection early so first click starts faster.
    audio.load();
  }, [streamVersion]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    const onPlay = () => setIsPlaying(true);
    const onPause = () => {
      setIsPlaying(false);
      setIsConnecting(false);
    };
    const onError = () => {
      setIsPlaying(false);
      setIsConnecting(false);
    };
    const onCanPlay = () => undefined;
    const onPlaying = () => setIsConnecting(false);
    const onWaiting = () => setIsConnecting(true);
    const onStalled = () => undefined;
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("error", onError);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("stalled", onStalled);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("stalled", onStalled);
    };
  }, []);

  const togglePlay = async () => {
    if (!audioRef.current) {
      return;
    }
    if (isPlaying) {
      audioRef.current.pause();
      return;
    }
    setIsConnecting(true);
    const maxRetries = 2;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        await audioRef.current.play();
        return;
      } catch (err) {
        if (attempt >= maxRetries) {
          console.error("Audio block:", err);
          setIsPlaying(false);
          setIsConnecting(false);
          return;
        }
        // Silent retry with a refreshed stream source.
        setStreamVersion((v) => v + 1);
        await new Promise((resolve) => window.setTimeout(resolve, 220));
      }
    }
  };

  return (
    <div className="bgmPlayer">
      <audio ref={audioRef} loop preload="auto" src={`${STREAM_URL}?v=${streamVersion}`} />
      <button type="button" className={`toolbarBtn ${isPlaying ? "bgmActive" : ""}`} onClick={togglePlay} title="Lofi Radio">
        {isPlaying ? <Pause size={15} className="bgmBtnIcon" /> : <Music2 size={15} className="bgmBtnIcon" />}
        {isPlaying ? "Dừng" : isConnecting ? "Đang kết nối..." : "Lofi"}
      </button>
      {isPlaying && (
        <>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={volumePct}
            onInput={(e) => setVolumePct(Number((e.target as HTMLInputElement).value))}
            onChange={(e) => setVolumePct(Number((e.target as HTMLInputElement).value))}
            className="bgmVolume"
          />
          <span className="bgmVolumeLabel">{volumePct}%</span>
        </>
      )}
    </div>
  );
}
