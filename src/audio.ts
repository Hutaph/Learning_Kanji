let currentAudio: HTMLAudioElement | null = null;
let currentBlobUrl: string | null = null;

const LINGVA_INSTANCES = [
  "https://lingva.ml",
  "https://translate.plausibility.cloud",
  "https://lingva.garudalinux.org"
];

export async function speakJapanese(text: string) {
  if (!text) return;
  const cleanText = text.replace(/[\/\\]/g, " ");

  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }
  if (currentBlobUrl) {
    URL.revokeObjectURL(currentBlobUrl);
    currentBlobUrl = null;
  }

  let played = false;
  for (const instance of LINGVA_INSTANCES) {
    try {
      const res = await fetch(`${instance}/api/v1/audio/ja/${encodeURIComponent(cleanText)}`);
      if (!res.ok) continue;
      const data = await res.json();
      if (data.audio && data.audio.length > 0) {
        const uint8Array = new Uint8Array(data.audio);
        const blob = new Blob([uint8Array], { type: 'audio/mp3' });
        currentBlobUrl = URL.createObjectURL(blob);
        currentAudio = new Audio(currentBlobUrl);
        await currentAudio.play();
        played = true;
        break; /* Success */
      }
    } catch (e) {
      // Ignore and try next instance
    }
  }

  if (!played) {
    console.warn("All Lingva TTS instances failed. Falling back to local Web Speech API.");
    if (typeof window !== "undefined" && window.speechSynthesis) {
      const voices = window.speechSynthesis.getVoices();
      const jaVoice = voices.find(v => v.lang.includes("ja"));
      
      if (voices.length > 0 && !jaVoice) {
        alert("Lỗi phát âm: Các máy chủ âm thanh miễn phí đang từ chối kết nối và máy bạn chưa cài gói giọng nói tiếng Nhật. Vui lòng cài Japanese Language Pack trên Windows.");
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = "ja-JP";
      utterance.rate = 0.9;
      if (jaVoice) utterance.voice = jaVoice;
      
      window.speechSynthesis.speak(utterance);
    }
  }
}

