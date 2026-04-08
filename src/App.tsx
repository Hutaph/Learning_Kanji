import React, { FormEvent, KeyboardEvent, Suspense, lazy, useCallback, useEffect, useMemo, useState, useRef } from "react";
import type { Session } from "@supabase/supabase-js";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle } from "lucide-react";
import { AppHeader } from "./components/app/AppHeader";
import { AppFooter } from "./components/app/AppFooter";
import { HomeInsightsPanel } from "./components/HomeInsightsPanel";
import { VocabularyLookupPage } from "./components/VocabularyLookupPage";
import { VocabularyList, formatMeaningLine } from "./components/VocabularyList";
import { FlashCard, ImportedKanjiRecord, VerbType, VerbLesson, KanjiProgress, VocabularyEntry } from "./types";
import {
  addGroup,
  addVocabulary,
  deleteGroup,
  deleteVocabularyById,
  exportDictionaryLocalState,
  findByKanjiCharacter,
  getAllVocabulary,
  getGroups,
  getKanjiCharacters,
  getKanjiProgressMap,
  importDictionaryLocalState,
  markKanjiKnown,
  markKanjiUnknown,
  suggestVocabularyByWordInput,
  toHanVietFromKanji,
  toReadingPreview
} from "./dictionary/lookup";
import { AuthGate } from "./auth/AuthGate";
import { hasSupabaseEnv, supabase } from "./lib/supabaseClient";
import { formatKanjiLessonLabel, getCurrentJlptStudyLabelFromStorage, getDailyInspiration, getNextJlptCountdown } from "./lib/appHelpers";
import { getJSON, getString, removeKey, setString } from "./lib/storage";
import { STORAGE_KEYS } from "./lib/storageKeys";
import { lookupVocabularyOnline, OnlineLookupResult } from "./dictionary/onlineLookup";
import { exportJlptLocalState, importJlptLocalState } from "./vocabulary/jlptProgress";
import { getCurrentSession, loadUserProfile, loadUserState, saveUserProfile, saveUserState, UserProfile, UserStatePayload } from "./sync/userStateSync";
import verbsPack from "./data/verbsConjugation.json";

const JlptVocabularyPage = lazy(() =>
  import("./components/JlptVocabularyPage").then((mod) => ({ default: mod.JlptVocabularyPage }))
);
const VerbStudyPanel = lazy(() =>
  import("./components/VerbStudyPanel").then((mod) => ({ default: mod.VerbStudyPanel }))
);

const BRAINROT_LINES = [
  "🚨 Não ping 9999ms, Kanji đang breakdance trên RAM của bạn.",
  "🧠💥 Bài học vừa crit damage, tim bạn đang combo 32 hit.",
  "🐸⚡ Trí nhớ bật turbo, chữ Hán đang drift qua võng mạc.",
  "💀📚 Bạn vừa enter vùng học quái vật, xin đừng nhìn lại phía sau.",
  "🦈🔥 Cá mập từ vựng đang cắn deadline, chạy đi còn kịp.",
  "👾🍜 Não bạn đang ăn mì gói, Kanji tự học thay chủ nhân.",
  "🤯🎯 Mỗi chữ Hán là một cú headshot vào sự trì hoãn.",
  "🫠💫 Ý chí tan chảy, nhưng streak học vẫn bay như tên lửa.",
  "🗿⚔️ Chế độ chiến thần mở khóa, ai ngáp là thua.",
  "🐶📈 Động lực điên cuồng, điểm nhớ từ đang pump không phanh."
] as const;

function App() {
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [syncReady, setSyncReady] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileDraft, setProfileDraft] = useState<UserProfile | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const [layoutMode, setLayoutMode] = useState<"full" | "compact">(() => {
    const stored = getString(STORAGE_KEYS.app.layout);
    return stored === "compact" ? "compact" : "full";
  });
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const stored = getString(STORAGE_KEYS.app.theme);
    return stored === "dark" ? "dark" : "light";
  });
  const [queryInput, setQueryInput] = useState("");
  const [word, setWord] = useState("");
  const [reading, setReading] = useState("");
  const [meaningVi, setMeaningVi] = useState("");
  const [meaningEn, setMeaningEn] = useState("");
  const [selectedAddGroup, setSelectedAddGroup] = useState("Chung");
  const [newGroupName, setNewGroupName] = useState("");
  const [groupToDelete, setGroupToDelete] = useState("");
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [studyGroup, setStudyGroup] = useState(() => getString(STORAGE_KEYS.app.studyGroup) || "Tất cả");
  const [studyFocus, setStudyFocus] = useState<"priority" | "due" | "new">(() => {
    const stored = getString(STORAGE_KEYS.app.studyFocus);
    return stored === "due" || stored === "new" ? stored : "priority";
  });
  const [cardIndex, setCardIndex] = useState(0);
  const [showHanViet, setShowHanViet] = useState(false);
  const [revealedFields, setRevealedFields] = useState<Record<string, boolean>>({});
  const [progressMap, setProgressMap] = useState<Record<string, KanjiProgress>>(() => getKanjiProgressMap());
  const [refreshTick, setRefreshTick] = useState(0);
  const [isOnlineLookingUp, setIsOnlineLookingUp] = useState(false);
  const [onlineResult, setOnlineResult] = useState<OnlineLookupResult | null>(null);
  const [enterLookupReady, setEnterLookupReady] = useState(false);
  const [listGroup, setListGroup] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [verbTypeFilter, setVerbTypeFilter] = useState<"Tất cả" | VerbType>("Tất cả");
  const [logoTapCount, setLogoTapCount] = useState(0);
  const [easterEggOn, setEasterEggOn] = useState(false);
  const [rainState, setRainState] = useState<"off" | "running" | "stopping">("off");
  const [brainrotLine, setBrainrotLine] = useState<string>(BRAINROT_LINES[0]);
  const [importedRecords, setImportedRecords] = useState<ImportedKanjiRecord[]>([]);
  const [kanjiDataReady, setKanjiDataReady] = useState(false);
  const kanjiPrefetchStartedRef = useRef(false);
  const lastSavedPayloadRef = useRef("");
  const saveTimerRef = useRef<number | null>(null);

  const importedByKanji = useMemo(() => {
    const map: Record<string, ImportedKanjiRecord> = {};
    for (const item of importedRecords) {
      if (!map[item.kanji]) {
        map[item.kanji] = item;
      }
    }
    return map;
  }, [importedRecords]);
  const localVocabulary = useMemo(() => getAllVocabulary(), [refreshTick]);
  const allVocabulary = localVocabulary;
  const allGroups = useMemo(() => getGroups(), [refreshTick]);
  const deletableGroups = useMemo(
    () => allGroups.filter((group) => group !== "Chung"),
    [allGroups]
  );

  const readingPreview = useMemo(() => {
    return toReadingPreview(reading);
  }, [reading]);
  const hanVietPreview = useMemo(() => {
    if (!word.trim()) {
      return "-";
    }
    return renderHanViet(word, importedByKanji);
  }, [word, importedByKanji]);
  const localSuggestion = useMemo(() => {
    const source = queryInput.trim() || word.trim();
    return suggestVocabularyByWordInput(source, allVocabulary);
  }, [queryInput, word, allVocabulary]);
  const listEntries = useMemo(() => {
    if (!listGroup) {
      return [];
    }
    return allVocabulary.filter((item) => item.group === listGroup);
  }, [allVocabulary, listGroup]);

  const cards = useMemo(
    () => buildFlashCards(studyGroup, allVocabulary, importedRecords, importedByKanji),
    [studyGroup, allVocabulary, importedRecords, importedByKanji]
  );
  const scopedCards = useMemo(() => {
    if (studyFocus === "due") {
      const now = Date.now();
      return cards.filter((card) => {
        const progress = progressMap[card.kanji];
        return Boolean(progress?.known && progress.dueAt <= now);
      });
    }
    if (studyFocus === "new") {
      return cards.filter((card) => !progressMap[card.kanji]?.known);
    }
    return cards;
  }, [cards, progressMap, studyFocus]);
  const scheduledCards = useMemo(() => scheduleCards(scopedCards, progressMap), [scopedCards, progressMap]);
  const unknownCardsCount = useMemo(
    () => cards.filter((card) => !progressMap[card.kanji]?.known).length,
    [cards, progressMap]
  );
  const dueCardsCount = useMemo(() => {
    const now = Date.now();
    return cards.filter((card) => {
      const progress = progressMap[card.kanji];
      return Boolean(progress?.known && progress.dueAt <= now);
    }).length;
  }, [cards, progressMap]);
  const knownCardsCount = useMemo(() => cards.filter((card) => progressMap[card.kanji]?.known).length, [cards, progressMap]);
  const jlptCurrentLevel = useMemo(() => getCurrentJlptStudyLabelFromStorage(), [currentPath, refreshTick]);
  const nextJlptCountdown = useMemo(() => getNextJlptCountdown(new Date()), []);
  const currentCard = scheduledCards[cardIndex] || null;
  const dailyInspiration = useMemo(() => getDailyInspiration(new Date()), []);
  const jlptVerbs = useMemo(() => (verbsPack as { verbs: VerbLesson[] }).verbs || [], []);
  const learningStreakDays = useMemo(() => {
    const history = getJSON<Array<{ date?: unknown }>>(STORAGE_KEYS.insights.history, []);
    return calculateLearningStreak(history);
  }, [refreshTick, currentPath]);
  const filteredVerbs = useMemo(() => {
    return jlptVerbs.filter((verb) => {
      return verbTypeFilter === "Tất cả" || verb.type === verbTypeFilter;
    });
  }, [jlptVerbs, verbTypeFilter]);
  const currentPage = useMemo(() => {
    if (currentPath === "/study/kanji") {
      return "kanji";
    }
    if (currentPath === "/study/verbs") {
      return "verbs";
    }
    if (currentPath === "/study/vocabulary") {
      return "vocabulary";
    }
    if (currentPath === "/study/lookup") {
      return "lookup";
    }
    return "home";
  }, [currentPath]);

  const buildCloudPayload = useCallback((): UserStatePayload => {
    const dictionaryState = exportDictionaryLocalState();
    const jlptState = exportJlptLocalState();
    return {
      version: 1,
      data: {
        appSettings: {
          theme,
          layoutMode,
          studyGroup,
          studyFocus
        },
        kanjiProgress: dictionaryState.kanjiProgress,
        customVocabulary: dictionaryState.customVocabulary,
        customGroups: dictionaryState.customGroups,
        jlpt: jlptState
      }
    };
  }, [theme, layoutMode, studyGroup, studyFocus]);

  const buildEmptyCloudPayload = useCallback((): UserStatePayload => {
    const emptyLearned = { N5: {}, N4: {}, N3: {}, N2: {}, N1: {} };
    const emptyWrong = { N5: [], N4: [], N3: [], N2: [], N1: [] };
    return {
      version: 1,
      data: {
        appSettings: {
          theme: "light",
          layoutMode: "full",
          studyGroup: "Tất cả",
          studyFocus: "priority"
        },
        kanjiProgress: {},
        customVocabulary: [],
        customGroups: [],
        jlpt: {
          learned: emptyLearned,
          wrongReview: emptyWrong,
          settings: {}
        }
      }
    };
  }, []);

  const applyCloudPayload = useCallback((payload: UserStatePayload) => {
    importDictionaryLocalState({
      customVocabulary: payload.data.customVocabulary,
      customGroups: payload.data.customGroups,
      kanjiProgress: payload.data.kanjiProgress
    });
    importJlptLocalState(payload.data.jlpt);
    setTheme(payload.data.appSettings.theme);
    setLayoutMode(payload.data.appSettings.layoutMode);
    setStudyGroup(payload.data.appSettings.studyGroup || "Tất cả");
    setStudyFocus(payload.data.appSettings.studyFocus || "priority");
    setProgressMap(payload.data.kanjiProgress || {});
    setRefreshTick((prev) => prev + 1);
  }, []);

  const buildCloudPayloadFromStorage = useCallback((): UserStatePayload => {
    const dictionaryState = exportDictionaryLocalState();
    const jlptState = exportJlptLocalState();
    const themeStored = getString(STORAGE_KEYS.app.theme);
    const layoutStored = getString(STORAGE_KEYS.app.layout);
    const studyGroupStored = getString(STORAGE_KEYS.app.studyGroup);
    const studyFocusStored = getString(STORAGE_KEYS.app.studyFocus);
    return {
      version: 1,
      data: {
        appSettings: {
          theme: themeStored === "dark" ? "dark" : "light",
          layoutMode: layoutStored === "compact" ? "compact" : "full",
          studyGroup: studyGroupStored || "Tất cả",
          studyFocus: studyFocusStored === "due" || studyFocusStored === "new" ? studyFocusStored : "priority"
        },
        kanjiProgress: dictionaryState.kanjiProgress,
        customVocabulary: dictionaryState.customVocabulary,
        customGroups: dictionaryState.customGroups,
        jlpt: jlptState
      }
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      if (!hasSupabaseEnv || !supabase) {
        if (mounted) {
          setAuthReady(true);
        }
        return;
      }
      try {
        const current = await getCurrentSession();
        if (mounted) {
          setSession(current);
        }
      } catch (err) {
        if (mounted) {
          setSyncError(err instanceof Error ? err.message : "Không thể khởi tạo phiên đăng nhập.");
        }
      } finally {
        if (mounted) {
          setAuthReady(true);
        }
      }
    };
    void init();
    const { data } = supabase
      ? supabase.auth.onAuthStateChange((_event, nextSession) => {
          setSession(nextSession);
        })
      : { data: { subscription: { unsubscribe: () => undefined } } };
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      if (!session?.user?.id) {
        setSyncReady(false);
        lastSavedPayloadRef.current = "";
        return;
      }
      setSyncReady(false);
      setSyncError("");
      try {
        const cloudState = await loadUserState(session.user.id);
        if (cancelled) {
          return;
        }
        if (cloudState?.version === 1) {
          applyCloudPayload(cloudState);
          lastSavedPayloadRef.current = JSON.stringify(cloudState);
        } else {
          const justSignedUp = getString(STORAGE_KEYS.app.authJustSignedUp) === "1";
          if (justSignedUp) {
            removeKey(STORAGE_KEYS.app.authJustSignedUp);
            const emptyPayload = buildEmptyCloudPayload();
            applyCloudPayload(emptyPayload);
            await saveUserState(session.user.id, emptyPayload);
            lastSavedPayloadRef.current = JSON.stringify(emptyPayload);
          } else {
            const localPayload = buildCloudPayloadFromStorage();
            await saveUserState(session.user.id, localPayload);
            lastSavedPayloadRef.current = JSON.stringify(localPayload);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setSyncError(err instanceof Error ? err.message : "Không thể đồng bộ dữ liệu đám mây.");
        }
      } finally {
        if (!cancelled) {
          setSyncReady(true);
        }
      }
    };
    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, applyCloudPayload, buildCloudPayloadFromStorage, buildEmptyCloudPayload]);

  useEffect(() => {
    if (!session?.user?.id || !syncReady) {
      return;
    }
    const payload = buildCloudPayload();
    const serialized = JSON.stringify(payload);
    if (serialized === lastSavedPayloadRef.current) {
      return;
    }
    if (saveTimerRef.current != null) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      void saveUserState(session.user.id, payload)
        .then(() => {
          lastSavedPayloadRef.current = serialized;
        })
        .catch((err) => {
          setSyncError(err instanceof Error ? err.message : "Lưu cloud thất bại.");
        });
    }, 900);
    return () => {
      if (saveTimerRef.current != null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [session?.user?.id, syncReady, buildCloudPayload, refreshTick, progressMap, theme, layoutMode, studyGroup, studyFocus]);

  useEffect(() => {
    if (!profileMenuOpen) {
      return;
    }
    const onDocClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!profileMenuRef.current || !target) {
        return;
      }
      if (!profileMenuRef.current.contains(target)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [profileMenuOpen]);

  useEffect(() => {
    let cancelled = false;
    const loadProfileData = async () => {
      if (!session?.user?.id) {
        setProfile(null);
        return;
      }
      try {
        const remote = await loadUserProfile(session.user.id);
        if (cancelled) {
          return;
        }
        const email = session.user.email || "";
        const fallbackUsername = (session.user.user_metadata?.username as string | undefined) || "";
        const initial: UserProfile = remote || {
          username: fallbackUsername,
          email,
          full_name: "",
          gender: "",
          birth_date: "",
          avatar_url: ""
        };
        if (!initial.email) {
          initial.email = email;
        }
        if (!initial.username) {
          initial.username = fallbackUsername || email.split("@")[0] || "user";
        }
        setProfile(initial);
      } catch (err) {
        if (!cancelled) {
          setSyncError(err instanceof Error ? err.message : "Không thể tải hồ sơ người dùng.");
        }
      }
    };
    void loadProfileData();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, session?.user?.email, session?.user?.user_metadata]);

  useEffect(() => {
    const onPopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    setCardIndex(0);
    setShowHanViet(false);
    setRevealedFields({});
  }, [studyGroup, scheduledCards.length]);

  useEffect(() => {
    setEnterLookupReady(false);
  }, [queryInput]);

  useEffect(() => {
    setString(STORAGE_KEYS.app.theme, theme);
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    setString(STORAGE_KEYS.app.layout, layoutMode);
  }, [layoutMode]);

  useEffect(() => {
    setString(STORAGE_KEYS.app.studyGroup, studyGroup);
  }, [studyGroup]);

  useEffect(() => {
    setString(STORAGE_KEYS.app.studyFocus, studyFocus);
  }, [studyFocus]);

  useEffect(() => {
    if ((currentPage !== "kanji" && currentPage !== "lookup") || kanjiDataReady) {
      return;
    }
    let cancelled = false;
    import("./data/kanjiImported.json")
      .then((mod) => {
        if (cancelled) {
          return;
        }
        setImportedRecords(mod.default as ImportedKanjiRecord[]);
        setKanjiDataReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setImportedRecords([]);
          setKanjiDataReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [currentPage, kanjiDataReady]);

  const prefetchKanjiData = () => {
    if (kanjiDataReady || kanjiPrefetchStartedRef.current) {
      return;
    }
    kanjiPrefetchStartedRef.current = true;
    import("./data/kanjiImported.json")
      .then((mod) => {
        setImportedRecords(mod.default as ImportedKanjiRecord[]);
        setKanjiDataReady(true);
      })
      .catch(() => {
        kanjiPrefetchStartedRef.current = false;
      });
  };

  useEffect(() => {
    if (selectedAddGroup && !allGroups.includes(selectedAddGroup)) {
      setSelectedAddGroup("Chung");
    }
    if (studyGroup && studyGroup !== "Tất cả" && !allGroups.includes(studyGroup)) {
      setStudyGroup("Tất cả");
    }
    if (listGroup && !allGroups.includes(listGroup)) {
      setListGroup("");
    }
  }, [allGroups, selectedAddGroup, studyGroup, listGroup]);

  useEffect(() => {
    if (rainState !== "stopping") {
      return;
    }
    const timer = window.setTimeout(() => setRainState("off"), 20000);
    return () => window.clearTimeout(timer);
  }, [rainState]);

  useEffect(() => {
    if (logoTapCount < 7) {
      return;
    }
    setLogoTapCount(0);
    setEasterEggOn(true);
    setRainState("running");
    setBrainrotLine((prev) => {
      const choices = BRAINROT_LINES.filter((line) => line !== prev);
      return choices[Math.floor(Math.random() * choices.length)] || BRAINROT_LINES[0];
    });
  }, [logoTapCount]);

  const pickBrainrotLine = useCallback(() => {
    setBrainrotLine((prev) => {
      const choices = BRAINROT_LINES.filter((line) => line !== prev);
      return choices[Math.floor(Math.random() * choices.length)] || BRAINROT_LINES[0];
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.shiftKey && event.code === "KeyJ") {
        if (rainState === "running") {
          setEasterEggOn(false);
          setRainState("stopping");
        } else {
          setEasterEggOn(true);
          setRainState("running");
          pickBrainrotLine();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [rainState, pickBrainrotLine]);

  const saveVocabulary = () => {
    setError("");
    setNotice("");
    if (!word.trim() || !reading.trim() || (!meaningVi.trim() && !meaningEn.trim())) {
      setError("Vui lòng nhập từ, cách đọc và ít nhất một nghĩa.");
      return false;
    }
    addVocabulary(word.trim(), reading.trim(), meaningVi.trim(), meaningEn.trim(), selectedAddGroup);
    setQueryInput("");
    setWord("");
    setReading("");
    setMeaningVi("");
    setMeaningEn("");
    setOnlineResult(null);
    setEnterLookupReady(false);
    setNotice("Đã lưu từ vựng.");
    setRefreshTick((prev) => prev + 1);
    return true;
  };

  const handleAddVocabulary = (event: FormEvent) => {
    event.preventDefault();
    void saveVocabulary();
  };

  const handleAddGroup = () => {
    setError("");
    setNotice("");
    if (!newGroupName.trim()) {
      setError("Vui lòng nhập tên nhóm.");
      return;
    }
    addGroup(newGroupName);
    setSelectedAddGroup(newGroupName.trim());
    setNewGroupName("");
    setRefreshTick((prev) => prev + 1);
  };

  const handleDeleteGroup = () => {
    setError("");
    setNotice("");
    if (!groupToDelete) {
      setError("Vui lòng chọn nhóm cần xóa.");
      return;
    }
    if (groupToDelete === "Chung") {
      setError("Không thể xóa nhóm hệ thống.");
      return;
    }
    const ok = window.confirm(`Xóa nhóm "${groupToDelete}"? Từ vựng sẽ chuyển về "Chung".`);
    if (!ok) {
      return;
    }
    deleteGroup(groupToDelete);
    if (selectedAddGroup === groupToDelete) {
      setSelectedAddGroup("Chung");
    }
    if (studyGroup === groupToDelete) {
      setStudyGroup("Tất cả");
    }
    if (listGroup === groupToDelete) {
      setListGroup("");
    }
    setGroupToDelete("");
    setNotice(`Đã xóa nhóm "${groupToDelete}".`);
    setRefreshTick((prev) => prev + 1);
  };

  const handleNextCard = () => {
    if (scheduledCards.length === 0) {
      return;
    }
    setCardIndex((prev) => (prev + 1) % scheduledCards.length);
    setShowHanViet(false);
    setRevealedFields({});
  };

  const handlePrevCard = () => {
    if (scheduledCards.length === 0) {
      return;
    }
    setCardIndex((prev) => (prev - 1 + scheduledCards.length) % scheduledCards.length);
    setShowHanViet(false);
    setRevealedFields({});
  };

  const handleMarkKnown = () => {
    if (!currentCard) {
      return;
    }
    const next = markKanjiKnown(currentCard.kanji);
    setProgressMap(next);
    setNotice(`Đã đánh dấu "${currentCard.kanji}" là thuộc.`);
    handleNextCard();
  };

  const handleMarkUnknown = () => {
    if (!currentCard) {
      return;
    }
    const next = markKanjiUnknown(currentCard.kanji);
    setProgressMap(next);
    setNotice(`Đã đánh dấu "${currentCard.kanji}" là chưa thuộc.`);
    handleNextCard();
  };

  const toggleReveal = (key: string) => {
    setRevealedFields((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const performOnlineLookup = async (query: string) => {
    setError("");
    setNotice("");
    setOnlineResult(null);
    if (!query.trim()) {
      setError("Vui lòng nhập từ để tra cứu.");
      return false;
    }

    setIsOnlineLookingUp(true);
    try {
      const result = await lookupVocabularyOnline(query);
      if (!result) {
        setError("Không tìm thấy kết quả phù hợp.");
        return false;
      }
      setWord(result.word);
      setReading(result.reading);
      setMeaningVi(result.meaningVi || "");
      setMeaningEn(result.meaningEn || "");
      setOnlineResult(result);
      setNotice("Đã áp dụng kết quả tra cứu.");
      setEnterLookupReady(true);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tra cứu lúc này.");
      return false;
    } finally {
      setIsOnlineLookingUp(false);
    }
  };

  const handleLookupOnline = async () => {
    await performOnlineLookup(queryInput.trim());
  };

  const handleApplyLocalSuggestion = () => {
    setError("");
    setNotice("");
    if (!localSuggestion) {
      setError("Không có gợi ý phù hợp.");
      return;
    }
    setWord(localSuggestion.word);
    setReading(localSuggestion.reading);
    setMeaningVi((prev) => (prev.trim() ? prev : localSuggestion.meaningVi));
    setMeaningEn((prev) => (prev.trim() ? prev : localSuggestion.meaningEn));
    setNotice("Đã áp dụng gợi ý.");
  };

  const handleResetForm = () => {
    setError("");
    setNotice("");
    setQueryInput("");
    setWord("");
    setReading("");
    setMeaningVi("");
    setMeaningEn("");
    setOnlineResult(null);
    setEnterLookupReady(false);
  };

  const handleQueryKeyDown = async (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    if (isOnlineLookingUp) {
      return;
    }

    if (enterLookupReady) {
      void saveVocabulary();
      return;
    }

    await performOnlineLookup(queryInput.trim());
  };

  const handleDeleteVocabulary = (entryId: string) => {
    deleteVocabularyById(entryId);
    setNotice("Đã xóa từ vựng.");
    setRefreshTick((prev) => prev + 1);
  };

  const goToPage = (path: "/" | "/study/kanji" | "/study/verbs" | "/study/vocabulary" | "/study/lookup") => {
    if (window.location.pathname === path) {
      return;
    }
    window.history.pushState(null, "", path);
    setCurrentPath(path);
  };

  const handleSignOut = async () => {
    if (!supabase) {
      return;
    }
    await supabase.auth.signOut();
  };

  const openProfileModal = () => {
    if (!profile) {
      return;
    }
    setProfileDraft({
      ...profile,
      birth_date: formatBirthDateDisplay(profile.birth_date)
    });
    setProfileModalOpen(true);
    setProfileMenuOpen(false);
  };

  const saveProfileChanges = async () => {
    if (!session?.user?.id || !profileDraft || !profile) {
      return;
    }
    const normalizedBirthDate = normalizeBirthDateInput(profileDraft.birth_date);
    if (normalizedBirthDate === null) {
      setError("Ngày sinh không hợp lệ. Vui lòng nhập theo định dạng dd/mm/yyyy.");
      return;
    }
    setProfileSaving(true);
    try {
      const nextProfile: UserProfile = {
        ...profile,
        username: profile.username.trim().toLowerCase(),
        email: profile.email.trim().toLowerCase(),
        avatar_url: profileDraft.avatar_url,
        full_name: profileDraft.full_name.trim(),
        gender: profileDraft.gender.trim(),
        birth_date: normalizedBirthDate
      };
      await saveUserProfile(session.user.id, nextProfile);
      setProfile(nextProfile);
      setProfileModalOpen(false);
      setNotice("Đã cập nhật thông tin tài khoản.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu hồ sơ.");
    } finally {
      setProfileSaving(false);
    }
  };

  const onPickAvatar = async (file: File | null) => {
    if (!file || !profileDraft) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Vui lòng chọn file ảnh hợp lệ.");
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    setProfileDraft((prev) => (prev ? { ...prev, avatar_url: dataUrl } : prev));
  };

  if (!authReady) {
    return (
      <main className="appShell layoutCompact">
        <div className="container">
          <PageLoadingCard label="Đang kiểm tra phiên đăng nhập..." />
        </div>
      </main>
    );
  }

  if (!session) {
    return <AuthGate />;
  }

  return (
    <main
      className={`appShell ${layoutMode === "compact" ? "layoutCompact" : "layoutFull"} ${rainState !== "off" ? "shockMode" : ""}`}
      onClickCapture={() => {
        if (rainState === "running") {
          setEasterEggOn(false);
          setRainState("stopping");
        }
      }}
    >
      <div className="container enterpriseShell">
      <AppHeader
        logoTapCount={logoTapCount}
        onTapLogo={() => setLogoTapCount((c) => c + 1)}
        layoutMode={layoutMode}
        onToggleLayout={() => setLayoutMode((prev) => (prev === "full" ? "compact" : "full"))}
        theme={theme}
        onToggleTheme={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}
        profileMenuRef={profileMenuRef}
        profile={profile}
        getAvatarFallback={getAvatarFallback}
        profileMenuOpen={profileMenuOpen}
        onToggleProfileMenu={() => setProfileMenuOpen((prev) => !prev)}
        onCloseProfileMenu={() => setProfileMenuOpen(false)}
        onOpenProfile={openProfileModal}
        onSignOut={handleSignOut}
        jlptCurrentLevel={jlptCurrentLevel}
        studyGroupLabel={formatKanjiLessonLabel(studyGroup)}
        learningStreakDays={learningStreakDays}
        jlptDaysLeft={nextJlptCountdown.daysLeft}
        onGoVocabulary={() => goToPage("/study/vocabulary")}
        onGoKanji={() => goToPage("/study/kanji")}
        currentPage={currentPage}
        onGoHome={() => goToPage("/")}
        onGoVerbs={() => goToPage("/study/verbs")}
        onGoLookup={() => goToPage("/study/lookup")}
        onPrefetchKanji={prefetchKanjiData}
        compactOnStudy={currentPage !== "home"}
      />

      <AnimatePresence mode="wait">
      <motion.div
        key={currentPage}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
      {currentPage === "home" && (
      <section className="card inspirationCard">
        <div className="inspirationMain">
          <div className="inspirationKanjiWrap">
            <p className="resultLabel">Kanji hôm nay</p>
            <p className="inspirationKanji">{dailyInspiration.kanji}</p>
            <p className="inspirationMeta">
              Hán Việt: <strong>{dailyInspiration.hanViet}</strong> - {dailyInspiration.keyword}
            </p>
          </div>
          <div className="inspirationQuote">
            <p className="quoteJa">{dailyInspiration.quoteJa}</p>
            <p className="quoteReading">{dailyInspiration.reading}</p>
            <p className="quoteMeaning">{dailyInspiration.meaningVi}</p>
            <button type="button" className="ctaStudyButton btnPrimary" onClick={() => goToPage("/study/kanji")}>
              Bắt đầu học
            </button>
          </div>
        </div>
      </section>
      )}

      {error && <div className="error">{error}</div>}
      {syncError && <div className="error">{syncError}</div>}
      {notice && <div className="notice">{notice}</div>}
      {rainState !== "off" ? <EmojiRainPhysics state={rainState} onSettled={() => setRainState("off")} /> : null}
      {rainState === "running" && (
        <div className="easterEggBanner" role="status" aria-live="polite">
          <strong>CHẾ ĐỘ BRAINROT TỐI THƯỢNG</strong> - {brainrotLine}
        </div>
      )}
      {profileModalOpen && profileDraft ? (
        <div className="profileModalBackdrop" role="dialog" aria-modal="true">
          <section className="card profileModalCard">
            <h2>Thông tin tài khoản</h2>
            <p className="muted">Cập nhật hồ sơ cá nhân hiển thị trong ứng dụng.</p>
            <div className="profileAvatarHeroWrap">
              <div className="profileAvatarHero">
                {profileDraft.avatar_url ? (
                  <img src={profileDraft.avatar_url} alt="Avatar hồ sơ" />
                ) : (
                  <span className="profileAvatarHeroFallback">{getAvatarFallback(profileDraft)}</span>
                )}
              </div>
            </div>
            <div className="profileEditorGrid">
              <label>
                Tên đăng nhập
                <input
                  value={profileDraft.username}
                  disabled
                  placeholder="username"
                />
              </label>
              <label>
                Họ và tên
                <input
                  value={profileDraft.full_name}
                  onChange={(e) => setProfileDraft((prev) => (prev ? { ...prev, full_name: e.target.value } : prev))}
                  placeholder="Nguyễn Văn A"
                />
              </label>
              <label>
                Email
                <input value={profileDraft.email} disabled />
              </label>
              <label>
                Giới tính
                <select
                  value={profileDraft.gender}
                  onChange={(e) => setProfileDraft((prev) => (prev ? { ...prev, gender: e.target.value } : prev))}
                >
                  <option value="">Chọn giới tính</option>
                  <option value="male">Nam</option>
                  <option value="female">Nữ</option>
                  <option value="other">Khác</option>
                </select>
              </label>
              <label>
                Ngày sinh
                <input
                  type="text"
                  value={profileDraft.birth_date}
                  inputMode="numeric"
                  placeholder="dd/mm/yyyy"
                  onChange={(e) => setProfileDraft((prev) => (prev ? { ...prev, birth_date: e.target.value } : prev))}
                />
              </label>
              <label className="profileFieldWide">
                Ảnh đại diện
                <input type="file" accept="image/*" onChange={(e) => void onPickAvatar(e.target.files?.[0] || null)} />
              </label>
            </div>
            <div className="row gap profileModalActions">
              <button type="button" className="btnSecondary" onClick={() => setProfileModalOpen(false)} disabled={profileSaving}>
                Hủy
              </button>
              <button type="button" className="btnPrimary" onClick={() => void saveProfileChanges()} disabled={profileSaving}>
                {profileSaving ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {currentPage === "home" && (
        <>
          <HomeInsightsPanel
            dueCardsCount={dueCardsCount}
            unknownCardsCount={unknownCardsCount}
            knownCardsCount={knownCardsCount}
            totalVocabulary={allVocabulary.length}
            totalGroups={allGroups.length}
          />
        </>
      )}

      {currentPage === "kanji" && (
        <>
          <section className="card studyCard">
            <h2>Học Kanji</h2>
            <p className="muted studySubtitle">Ôn theo thẻ, theo nhóm và theo mức ưu tiên trong ngày.</p>
            <div className="toolbar toolbar-2">
              <label>
                Nhóm đang học
                <select value={studyGroup} onChange={(event) => setStudyGroup(event.target.value)}>
                  <option value="Tất cả">Tất cả</option>
                  {allGroups.map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Chế độ ôn
                <select value={studyFocus} onChange={(event) => setStudyFocus(event.target.value as "priority" | "due" | "new")}>
                  <option value="priority">Ưu tiên thông minh</option>
                  <option value="due">Chỉ thẻ đến hạn</option>
                  <option value="new">Chỉ thẻ chưa thuộc</option>
                </select>
              </label>
              <p className="muted cardCounter">
                Tiến độ thẻ: {scheduledCards.length === 0 ? 0 : cardIndex + 1}/{scheduledCards.length}
              </p>
            </div>
            <p className="muted">
              Hôm nay: {dueCardsCount} thẻ đến hạn · {unknownCardsCount} thẻ chưa thuộc
            </p>

            {!kanjiDataReady ? (
              <p className="muted">Đang tải dữ liệu Kanji...</p>
            ) : currentCard ? (
              <div className="flashcard">
                <div className="flashTopRow">
                  <div className="kanjiPanel">
                    <p className="resultLabel">Kanji</p>
                    <p className="flashKanji">{currentCard.kanji}</p>
                    <p className="resultLabel">Âm Hán Việt</p>
                    <button
                      type="button"
                      className={`blurRevealButton ${showHanViet ? "revealed" : ""}`}
                      onClick={() => setShowHanViet((prev) => !prev)}
                    >
                      {showHanViet ? currentCard.hanViet : "••••••"}
                    </button>
                  </div>
                  <div className="imagePanel">
                    {currentCard.image ? (
                      <img className="kanjiImage" src={currentCard.image} alt={`Minh họa ${currentCard.kanji}`} />
                    ) : (
                      <p className="muted">Chưa có ảnh minh họa.</p>
                    )}
                  </div>
                </div>

                <div className="vocabPanel">
                  <p className="resultLabel">Từ vựng liên quan</p>
                  {currentCard.vocabulary.length === 0 ? (
                    <p className="muted">Chưa có từ liên quan.</p>
                  ) : (
                    <div className="tableWrap">
                      <table className="vocabTable">
                        <thead>
                          <tr>
                            <th>Từ vựng</th>
                            <th>Hiragana</th>
                            <th>Nghĩa</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentCard.vocabulary.map((entry) => {
                            const readingKey = `${currentCard.kanji}-${entry.id}-reading`;
                            const meaningKey = `${currentCard.kanji}-${entry.id}-meaning`;
                            const showReading = Boolean(revealedFields[readingKey]);
                            const showMeaning = Boolean(revealedFields[meaningKey]);
                            return (
                              <tr key={`${currentCard.kanji}-${entry.id}`}>
                                <td>{entry.word}</td>
                                <td>
                                  <button
                                    type="button"
                                    className={`blurInline ${showReading ? "revealed" : ""}`}
                                    onClick={() => toggleReveal(readingKey)}
                                  >
                                    {showReading ? entry.reading : "••••••"}
                                  </button>
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className={`blurInline ${showMeaning ? "revealed" : ""}`}
                                    onClick={() => toggleReveal(meaningKey)}
                                  >
                                    {showMeaning ? formatMeaningLine(entry) : "••••••••"}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="row gap">
                  <button type="button" className="btnSecondary" onClick={handlePrevCard}>
                    Thẻ trước
                  </button>
                  <button type="button" className="btnSecondary" onClick={handleNextCard}>
                    Thẻ tiếp theo
                  </button>
                </div>
                <div className="row gap">
                  <button type="button" className="knownButton" onClick={handleMarkKnown}>
                    Đã thuộc
                  </button>
                  <button type="button" className="unknownButton" onClick={handleMarkUnknown}>
                    Chưa thuộc
                  </button>
                </div>
              </div>
            ) : (
              <p className="muted">
                {studyFocus === "due"
                  ? "Không có thẻ đến hạn trong bộ lọc hiện tại."
                  : studyFocus === "new"
                    ? "Không còn thẻ chưa thuộc trong bộ lọc hiện tại."
                    : "Nhóm này chưa có dữ liệu. Hãy thêm từ vựng để bắt đầu học."}
              </p>
            )}
          </section>
        </>
      )}

      {currentPage === "vocabulary" && (
        <Suspense fallback={<PageLoadingCard label="Đang tải tab Từ vựng JLPT..." />}>
          <JlptVocabularyPage />
        </Suspense>
      )}

      {currentPage === "verbs" && (
        <Suspense fallback={<PageLoadingCard label="Đang tải tab Động từ..." />}>
          <section className="card studyCard">
            <h2>Học Động Từ</h2>
            <p className="muted studySubtitle">Lọc theo nhóm động từ, ôn bảng chia và làm bài kiểm tra riêng.</p>
            <VerbStudyPanel
              verbs={filteredVerbs}
              typeFilter={verbTypeFilter}
              onTypeFilterChange={setVerbTypeFilter}
            />
          </section>
        </Suspense>
      )}

      {currentPage === "lookup" && (
        <VocabularyLookupPage
          allVocabulary={allVocabulary}
          verbs={jlptVerbs}
          kanjiRecords={importedRecords}
          kanjiReady={kanjiDataReady}
        />
      )}

      {currentPage === "kanji" && (
        <>
          <div className="sectionGrid">
            <section className="card">
              <h2>Quản Lý Nhóm Học</h2>
              <div className="row gap groupRow">
                <input value={newGroupName} onChange={(event) => setNewGroupName(event.target.value)} placeholder="Ví dụ: Bài 1" />
                <button type="button" className="btnSecondary" onClick={handleAddGroup}>
                  Tạo nhóm mới
                </button>
              </div>
              <div className="row gap groupRow">
                <select value={groupToDelete} onChange={(event) => setGroupToDelete(event.target.value)}>
                  <option value="">Chọn nhóm để xóa</option>
                  {deletableGroups.map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                </select>
                <button type="button" className="trashButton" onClick={handleDeleteGroup} disabled={!groupToDelete}>
                  Xóa nhóm
                </button>
              </div>
              <p className="muted">Khi xóa nhóm, từ vựng sẽ chuyển về "Chung".</p>
            </section>
            
            <section className="card">
              <h2>Thêm Từ Vựng</h2>
              <p className="muted">Tra cứu, chỉnh sửa và lưu từ mới.</p>
              <div className="lookupBar">
                <input
                  lang="ja"
                  value={queryInput}
                  onChange={(event) => setQueryInput(event.target.value)}
                  onKeyDown={handleQueryKeyDown}
                  placeholder="Nhập từ cần tra (romaji / hiragana / kanji)"
                />
                <button
                  type="button"
                  className="btnPrimary"
                  onClick={handleLookupOnline}
                  disabled={isOnlineLookingUp || !queryInput.trim()}
                >
                  {isOnlineLookingUp ? "Đang tra..." : "Tra cứu online"}
                </button>
                <button type="button" className="btnSecondary" onClick={handleApplyLocalSuggestion} disabled={!localSuggestion}>
                  Gợi ý cục bộ
                </button>
              </div>
              {localSuggestion && (
                <p className="hint">
                  Gợi ý local: {localSuggestion.word}（{localSuggestion.reading}） - {formatMeaningLine(localSuggestion)}
                </p>
              )}
              <form className="addForm" onSubmit={handleAddVocabulary}>
                <div className="field">
                  <label>Nhóm học</label>
                  <select value={selectedAddGroup} onChange={(event) => setSelectedAddGroup(event.target.value)}>
                    {allGroups.map((group) => (
                      <option key={group} value={group}>
                        {group}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>Tạo nhóm mới</label>
                  <div className="row gap compactRow">
                    <input value={newGroupName} onChange={(event) => setNewGroupName(event.target.value)} placeholder="Ví dụ: Bài 3" />
                    <button type="button" className="btnSecondary" onClick={handleAddGroup}>
                      Thêm
                    </button>
                  </div>
                </div>

                <div className="field">
                  <label>Từ vựng (Kanji / Japanese)</label>
                  <input
                    lang="ja"
                    value={word}
                    onChange={(event) => setWord(event.target.value)}
                    placeholder="Ví dụ: 学校 / 中学校"
                  />
                </div>

                <div className="field">
                  <label>Cách đọc (Hiragana / Romaji)</label>
                  <input
                    lang="ja"
                    value={reading}
                    onChange={(event) => setReading(event.target.value)}
                    placeholder="Ví dụ: がっこう / gakkou"
                  />
                  <p className="hint">Preview: {readingPreview || "-"}</p>
                </div>

                <div className="field">
                  <label>Nghĩa tiếng Việt</label>
                  <input value={meaningVi} onChange={(event) => setMeaningVi(event.target.value)} placeholder="Ví dụ: trường học" />
                </div>

                <div className="field">
                  <label>Nghĩa tiếng Anh</label>
                  <input value={meaningEn} onChange={(event) => setMeaningEn(event.target.value)} placeholder="Ví dụ: school" />
                </div>

                <div className="row gap actionsRow">
                  <button type="submit" className="btnPrimary">
                    Lưu từ vựng
                  </button>
                  <button type="button" className="btnSecondary" onClick={handleResetForm}>
                    Làm mới form
                  </button>
                </div>
              </form>
              {onlineResult && (
                <p className="hint">
                  Nguồn {onlineResult.source}: {onlineResult.word}（{onlineResult.reading}） · {onlineResult.meaningVi || onlineResult.meaningEn}
                </p>
              )}
              <p className="hint">Âm Hán: {hanVietPreview}</p>
            </section>
          </div>

          <section className="card">
            <h2>Danh Sách Từ Vựng</h2>
            <div className="row gap">
              <select value={listGroup} onChange={(event) => setListGroup(event.target.value)}>
                <option value="">Chọn nhóm để hiển thị danh sách từ</option>
                {allGroups.map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
              </select>
            </div>
            {listGroup ? (
              <VocabularyList entries={listEntries} emptyText="Nhóm này chưa có từ vựng." onDelete={handleDeleteVocabulary} />
            ) : (
              <p className="muted">Chọn nhóm để hiển thị danh sách.</p>
            )}
          </section>
        </>
      )}
      </motion.div>
      </AnimatePresence>
      <div className="floatingActions">
        {currentPage === "home" ? (
          <a
            className="zaloFab"
            href="https://zalo.me/"
            target="_blank"
            rel="noreferrer"
            aria-label="Liên hệ Zalo"
            title="Liên hệ Zalo"
          >
            <span className="zaloFabIcon" aria-hidden="true">
              <MessageCircle size={28} />
            </span>
          </a>
        ) : (
          <button type="button" className="btnSecondary" onClick={() => goToPage("/")}>
            Về trang chủ
          </button>
        )}
      </div>
      <AppFooter />
      </div>
    </main>
  );
}

function PageLoadingCard({ label }: { label: string }) {
  return (
    <section className="card pageLoadingCard" aria-live="polite" aria-busy="true">
      <div className="pageLoadingBar" />
      <p className="muted">{label}</p>
    </section>
  );
}

type RainMode = "running" | "stopping";

type EmojiParticle = {
  emoji: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  mass: number;
  rotation: number;
  vr: number;
};

function EmojiRainPhysics({ state, onSettled }: { state: RainMode; onSettled: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<EmojiParticle[]>([]);
  const spawnCarryRef = useRef(0);
  const settleFrameRef = useRef(0);
  const perfScoreRef = useRef(0);
  const lowQualityRef = useRef(false);
  const frameTickRef = useRef(0);
  const prevStateRef = useRef<RainMode>(state);
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;

  useEffect(() => {
    if (prevStateRef.current !== state && state === "running") {
      particlesRef.current = [];
      spawnCarryRef.current = 0;
      settleFrameRef.current = 0;
    }
    prevStateRef.current = state;
  }, [state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    let rafId = 0;
    let lastTs = performance.now();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const emojiPool = ["🔥", "💀", "🧠", "⚡", "🤯", "🐸", "🦈", "👾", "💥", "🫠", "🗿", "🍌"];

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const spawnParticle = () => {
      const size = 34 + Math.random() * 20;
      const r = size * 0.33;
      particlesRef.current.push({
        emoji: emojiPool[Math.floor(Math.random() * emojiPool.length)],
        x: r + Math.random() * (window.innerWidth - r * 2),
        y: -40 - Math.random() * 120,
        vx: (Math.random() - 0.5) * 180,
        vy: 40 + Math.random() * 120,
        r,
        mass: r * r,
        rotation: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 3.2
      });
    };

    const render = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const floorY = h - 8;
      let dt = (performance.now() - lastTs) / 1000;
      lastTs = performance.now();
      dt = Math.max(0.005, Math.min(dt, 0.033));
      frameTickRef.current += 1;

      if (dt > 0.0215) {
        perfScoreRef.current = Math.min(80, perfScoreRef.current + 1.4);
      } else {
        perfScoreRef.current = Math.max(0, perfScoreRef.current - 0.7);
      }
      if (perfScoreRef.current > 20) {
        lowQualityRef.current = true;
      } else if (perfScoreRef.current < 8) {
        lowQualityRef.current = false;
      }

      const isLowQuality = lowQualityRef.current;
      const maxParticles = isLowQuality ? 36 : 68;
      const spawnRate = isLowQuality ? 9 : 16;
      if (state === "running") {
        spawnCarryRef.current += dt * spawnRate;
        while (spawnCarryRef.current >= 1 && particlesRef.current.length < maxParticles) {
          spawnParticle();
          spawnCarryRef.current -= 1;
        }
      }

      const particles = particlesRef.current;
      if (particles.length > maxParticles) {
        particles.splice(0, particles.length - maxParticles);
      }
      const g = 2100;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.vy += g * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (!isLowQuality) {
          p.rotation += p.vr * dt;
        }

        if (p.x < p.r) {
          p.x = p.r;
          p.vx = Math.abs(p.vx) * 0.6;
        } else if (p.x > w - p.r) {
          p.x = w - p.r;
          p.vx = -Math.abs(p.vx) * 0.6;
        }

        if (p.y > floorY - p.r) {
          p.y = floorY - p.r;
          if (Math.abs(p.vy) > 80) {
            p.vy = -Math.abs(p.vy) * 0.34;
          } else {
            p.vy = 0;
          }
          p.vx *= 0.96;
          p.vr *= 0.97;
          if (Math.abs(p.vx) < 2) p.vx = 0;
          if (Math.abs(p.vr) < 0.03) p.vr = 0;
        }
      }

      // Broad-phase with spatial grid to avoid O(n^2) collision checks.
      const shouldResolveCollisions = !isLowQuality || frameTickRef.current % 2 === 0;
      if (shouldResolveCollisions) {
        const cellSize = isLowQuality ? 92 : 74;
        const grid = new Map<string, number[]>();
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          const cx = Math.floor(p.x / cellSize);
          const cy = Math.floor(p.y / cellSize);
          const key = `${cx},${cy}`;
          const bucket = grid.get(key);
          if (bucket) {
            bucket.push(i);
          } else {
            grid.set(key, [i]);
          }
        }

        for (let i = 0; i < particles.length; i++) {
          const a = particles[i];
          const cx = Math.floor(a.x / cellSize);
          const cy = Math.floor(a.y / cellSize);
          for (let ox = -1; ox <= 1; ox++) {
            for (let oy = -1; oy <= 1; oy++) {
              const bucket = grid.get(`${cx + ox},${cy + oy}`);
              if (!bucket) {
                continue;
              }
              for (let k = 0; k < bucket.length; k++) {
                const j = bucket[k];
                if (j <= i) {
                  continue;
                }
                const b = particles[j];
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const minDist = a.r + b.r;
                const distSq = dx * dx + dy * dy;
                if (distSq >= minDist * minDist || distSq < 1e-6) {
                  continue;
                }
                const dist = Math.sqrt(distSq);
                const nx = dx / dist;
                const ny = dy / dist;
                const overlap = minDist - dist;

                a.x -= nx * (overlap * 0.5);
                a.y -= ny * (overlap * 0.5);
                b.x += nx * (overlap * 0.5);
                b.y += ny * (overlap * 0.5);

                const rvx = b.vx - a.vx;
                const rvy = b.vy - a.vy;
                const velAlongNormal = rvx * nx + rvy * ny;
                if (velAlongNormal > 0) {
                  continue;
                }

                const restitution = isLowQuality ? 0.25 : 0.32;
                const invMassA = 1 / a.mass;
                const invMassB = 1 / b.mass;
                const impulse = (-(1 + restitution) * velAlongNormal) / (invMassA + invMassB);
                const ix = impulse * nx;
                const iy = impulse * ny;

                a.vx -= ix * invMassA;
                a.vy -= iy * invMassA;
                b.vx += ix * invMassB;
                b.vy += iy * invMassB;
              }
            }
          }
        }
      }

      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const size = p.r / 0.33;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.font = `${Math.round(size)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(p.emoji, 0, 0);
        ctx.restore();
      }

      if (state === "stopping") {
        let active = 0;
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          const onGround = p.y >= floorY - p.r - 0.5;
          if (!onGround || Math.abs(p.vx) > 8 || Math.abs(p.vy) > 8) {
            active += 1;
          }
        }
        if (active === 0) {
          settleFrameRef.current += 1;
        } else {
          settleFrameRef.current = 0;
        }
        if (settleFrameRef.current > 14) {
          onSettledRef.current();
          return;
        }
      }

      rafId = window.requestAnimationFrame(render);
    };

    rafId = window.requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", resize);
      window.cancelAnimationFrame(rafId);
    };
  }, [state]);

  return (
    <div className="emojiRain" aria-hidden="true">
      <canvas ref={canvasRef} className="emojiRainCanvas" />
    </div>
  );
}

function getAvatarFallback(profile: UserProfile | null): string {
  const source = (profile?.full_name || profile?.username || "User").trim();
  if (!source) {
    return "U";
  }
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 1).toUpperCase();
  }
  return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
}

function formatBirthDateDisplay(raw: string): string {
  const value = raw.trim();
  if (!value) {
    return "";
  }
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const [, year, month, day] = iso;
    return `${day}/${month}/${year}`;
  }
  return value;
}

function toDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function calculateLearningStreak(history: Array<{ date?: unknown }>): number {
  if (!Array.isArray(history) || history.length === 0) {
    return 0;
  }
  const dayKeys = history
    .map((item) => (typeof item?.date === "string" ? item.date : ""))
    .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value));
  if (dayKeys.length === 0) {
    return 0;
  }
  const uniqueSorted = Array.from(new Set(dayKeys)).sort();
  const lastKey = uniqueSorted[uniqueSorted.length - 1];
  const todayKey = toDayKey(new Date());
  const yesterdayKey = toDayKey(new Date(Date.now() - 86400000));
  if (lastKey !== todayKey && lastKey !== yesterdayKey) {
    return 0;
  }
  let streak = 0;
  let cursor = new Date(`${lastKey}T00:00:00`);
  const keySet = new Set(uniqueSorted);
  while (true) {
    const key = toDayKey(cursor);
    if (!keySet.has(key)) {
      break;
    }
    streak += 1;
    cursor = new Date(cursor.getTime() - 86400000);
  }
  return streak;
}

function normalizeBirthDateInput(raw: string): string | null {
  const value = raw.trim();
  if (!value) {
    return "";
  }
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    return value;
  }
  const dmy = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!dmy) {
    return null;
  }
  const day = Number(dmy[1]);
  const month = Number(dmy[2]);
  const year = Number(dmy[3]);
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) {
    return null;
  }
  const testDate = new Date(Date.UTC(year, month - 1, day));
  if (
    testDate.getUTCFullYear() !== year ||
    testDate.getUTCMonth() !== month - 1 ||
    testDate.getUTCDate() !== day
  ) {
    return null;
  }
  const dd = String(day).padStart(2, "0");
  const mm = String(month).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Không thể đọc file ảnh."));
    reader.readAsDataURL(file);
  });
}


function buildFlashCards(
  studyGroup: string,
  vocabulary: VocabularyEntry[],
  importedRecords: ImportedKanjiRecord[],
  importedByKanji: Record<string, ImportedKanjiRecord>
): FlashCard[] {
  const scopedVocabulary = studyGroup === "Tất cả" ? vocabulary : vocabulary.filter((item) => item.group === studyGroup);
  const kanjiSet = new Set<string>();

  if (studyGroup === "Tất cả") {
    for (const item of importedRecords) {
      kanjiSet.add(item.kanji);
    }
  }

  for (const item of scopedVocabulary) {
    for (const kanji of getKanjiCharacters(item.word)) {
      kanjiSet.add(kanji);
    }
  }

  return Array.from(kanjiSet)
    .sort((a, b) => a.localeCompare(b))
    .map((kanji) => {
    const imported = importedByKanji[kanji];
    return {
      kanji,
      hanViet: renderHanViet(kanji, importedByKanji),
      image: imported?.image || "",
      vocabulary: findByKanjiCharacter(kanji, scopedVocabulary)
    };
  });
}

function renderHanViet(word: string, importedByKanji: Record<string, ImportedKanjiRecord>): string {
  const parts: string[] = [];
  for (const ch of word) {
    if (!/\p{Script=Han}/u.test(ch)) {
      continue;
    }
    const imported = importedByKanji[ch]?.hanViet?.trim();
    if (imported) {
      parts.push(imported);
      continue;
    }
    const fallback = toHanVietFromKanji(ch);
    if (fallback && fallback !== "Không tìm thấy chữ Kanji hợp lệ.") {
      parts.push(fallback);
    }
  }
  if (parts.length === 0) {
    return "Không tìm thấy chữ Kanji hợp lệ.";
  }
  return parts.join(" ");
}

function scheduleCards(cards: FlashCard[], progressMap: Record<string, KanjiProgress>): FlashCard[] {
  const now = Date.now();
  return [...cards].sort((a, b) => {
    const pa = progressMap[a.kanji];
    const pb = progressMap[b.kanji];
    const wa = getPriorityWeight(pa, now);
    const wb = getPriorityWeight(pb, now);
    if (wa !== wb) {
      return wa - wb;
    }
    const da = pa?.dueAt || 0;
    const db = pb?.dueAt || 0;
    if (da !== db) {
      return da - db;
    }
    return a.kanji.localeCompare(b.kanji);
  });
}

function getPriorityWeight(progress: KanjiProgress | undefined, now: number): number {
  if (!progress) {
    return 0;
  }
  if (!progress.known) {
    return 0;
  }
  if (progress.dueAt <= now) {
    return 1;
  }
  return 2;
}

export default App;
