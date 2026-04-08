import React from "react";
import { BookOpen, CalendarClock, Flame, House, LayoutGrid, LogOut, MoonStar, Search, Sparkles, SunMedium, UserRound } from "lucide-react";
import { BgmPlayer } from "../BgmPlayer";
import { UserProfile } from "../../sync/userStateSync";

type Page = "home" | "kanji" | "verbs" | "vocabulary" | "lookup";

type AppHeaderProps = {
  logoTapCount: number;
  onTapLogo: () => void;
  layoutMode: "full" | "compact";
  onToggleLayout: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  profileMenuRef: React.RefObject<HTMLDivElement>;
  profile: UserProfile | null;
  getAvatarFallback: (profile: UserProfile | null) => string;
  profileMenuOpen: boolean;
  onToggleProfileMenu: () => void;
  onCloseProfileMenu: () => void;
  onOpenProfile: () => void;
  onSignOut: () => void;
  jlptCurrentLevel: string;
  studyGroupLabel: string;
  learningStreakDays: number;
  jlptDaysLeft: number;
  onGoVocabulary: () => void;
  onGoKanji: () => void;
  currentPage: Page;
  onGoHome: () => void;
  onGoVerbs: () => void;
  onGoLookup: () => void;
  onPrefetchKanji: () => void;
  compactOnStudy: boolean;
};

export function AppHeader({
  logoTapCount,
  onTapLogo,
  layoutMode,
  onToggleLayout,
  theme,
  onToggleTheme,
  profileMenuRef,
  profile,
  getAvatarFallback,
  profileMenuOpen,
  onToggleProfileMenu,
  onCloseProfileMenu,
  onOpenProfile,
  onSignOut,
  jlptCurrentLevel,
  studyGroupLabel,
  learningStreakDays,
  jlptDaysLeft,
  onGoVocabulary,
  onGoKanji,
  currentPage,
  onGoHome,
  onGoVerbs,
  onGoLookup,
  onPrefetchKanji,
  compactOnStudy
}: AppHeaderProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const collapseTimerRef = React.useRef<number | null>(null);
  const profileCloseTimerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (collapseTimerRef.current != null) {
        window.clearTimeout(collapseTimerRef.current);
      }
      if (profileCloseTimerRef.current != null) {
        window.clearTimeout(profileCloseTimerRef.current);
      }
    };
  }, []);

  const openCompactPanels = () => {
    if (collapseTimerRef.current != null) {
      window.clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
    setIsExpanded(true);
  };

  const closeCompactPanels = () => {
    if (collapseTimerRef.current != null) {
      window.clearTimeout(collapseTimerRef.current);
    }
    collapseTimerRef.current = window.setTimeout(() => {
      setIsExpanded(false);
      collapseTimerRef.current = null;
    }, 140);
  };

  const cancelProfileClose = () => {
    if (profileCloseTimerRef.current != null) {
      window.clearTimeout(profileCloseTimerRef.current);
      profileCloseTimerRef.current = null;
    }
  };

  const queueProfileClose = () => {
    cancelProfileClose();
    profileCloseTimerRef.current = window.setTimeout(() => {
      onCloseProfileMenu();
      profileCloseTimerRef.current = null;
    }, 260);
  };

  return (
    <header
      className={`appHeader ${compactOnStudy ? "isCompact" : ""} ${compactOnStudy && isExpanded ? "isExpanded" : ""}`}
      onMouseEnter={compactOnStudy ? openCompactPanels : undefined}
      onMouseLeave={compactOnStudy ? closeCompactPanels : undefined}
      onFocusCapture={compactOnStudy ? openCompactPanels : undefined}
      onBlurCapture={compactOnStudy ? closeCompactPanels : undefined}
    >
      <div className="brandRow">
        <div className="heroTitleBlock">
          <img
            className={`brandLogo ${logoTapCount > 0 ? "isTapHint" : ""}`}
            src="/logo.png"
            alt="Nihongo Studio"
            onClick={onTapLogo}
            title="Try tapping the logo..."
          />
          <div>
            <h1>Kulukulu Nihongo</h1>
            <p className="heroSubtitle">Tăng tốc ôn luyện, tự tin đỗ JLPT!</p>
          </div>
        </div>
        <div className="headerControls">
          <BgmPlayer />
          <button type="button" className="toolbarBtn" onClick={onToggleLayout}>
            <LayoutGrid size={16} />
            {layoutMode === "full" ? "Layout gọn" : "Layout rộng"}
          </button>
          <button type="button" className="toolbarBtn" onClick={onToggleTheme}>
            {theme === "light" ? <MoonStar size={16} /> : <SunMedium size={16} />}
            {theme === "light" ? "Giao diện tối" : "Giao diện sáng"}
          </button>
          <div
            className="profileMenuWrap"
            ref={profileMenuRef}
            onMouseEnter={cancelProfileClose}
            onMouseLeave={queueProfileClose}
          >
            <button type="button" className="profileChip" onClick={onToggleProfileMenu}>
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="profileAvatar" />
              ) : (
                <span className="profileAvatarFallback">{getAvatarFallback(profile)}</span>
              )}
              <span className="profileName">{profile?.full_name?.trim() || profile?.username || "Tài khoản"}</span>
            </button>
            {profileMenuOpen ? (
              <div className="profilePopover">
                <button type="button" className="profilePopoverBtn" onClick={onOpenProfile}>
                  <UserRound size={15} />
                  Thông tin
                </button>
                <button type="button" className="profilePopoverBtn danger" onClick={onSignOut}>
                  <LogOut size={15} />
                  Đăng xuất
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <div className={`headerFunCells ${compactOnStudy ? "compactPanel compactKpiPanel" : ""}`} aria-label="Quick insights">
        <div className="headerPets" aria-hidden="true">
          <span className="headerPet petA">🐶</span>
          <span className="headerPet petB">🐱</span>
          <span className="headerPet petC">🐹</span>
          <span className="headerPet petD">🐸</span>
          <span className="headerPet petE">🦈</span>
          <span className="headerPet petF">🐰</span>
          <span className="headerPet petG">🦊</span>
          <span className="headerPet petH">🐼</span>
          <span className="headerPet petI">🐥</span>
        </div>
        <button type="button" className="headerFunCell isAction" onClick={onGoVocabulary}>
          <div className="kpiTopLine">
            <span className="kpiIcon"><BookOpen size={15} /></span>
            <p className="headerFunLabel">Bài JLPT đang học</p>
          </div>
          <strong className="kpiValue">{jlptCurrentLevel}</strong>
        </button>
        <button type="button" className="headerFunCell isAction" onClick={onGoKanji}>
          <div className="kpiTopLine">
            <span className="kpiIcon"><Sparkles size={15} /></span>
            <p className="headerFunLabel">Bài Kanji đang học</p>
          </div>
          <strong className="kpiValue">{studyGroupLabel}</strong>
        </button>
        <div className="headerFunCell isStreak">
          <div className="kpiTopLine">
            <span className="kpiIcon"><Flame size={15} /></span>
            <p className="headerFunLabel">Streak học</p>
          </div>
          <strong className="kpiValue">🔥 {learningStreakDays} ngày</strong>
        </div>
        <a
          className="headerFunCell isImportant isLink"
          href="https://www.jlpt.jp/e/"
          target="_blank"
          rel="noreferrer"
          title="Mở trang JLPT chính thức"
          aria-label="Mở trang JLPT chính thức"
        >
          <div className="kpiTopLine">
            <span className="kpiIcon"><CalendarClock size={15} /></span>
            <p className="headerFunLabel">JLPT gần nhất</p>
          </div>
          <strong className="kpiValue">
            {jlptDaysLeft === 0 ? "Hôm nay" : `${jlptDaysLeft} ngày`}
          </strong>
        </a>
      </div>
      <nav className={`mainNav ${compactOnStudy ? "compactPanel compactNavPanel" : ""}`} aria-label="Điều hướng chính">
        <button type="button" className={currentPage === "home" ? "navPill isActive" : "navPill"} onClick={onGoHome}>
          <span className="navPillInner"><House size={16} />Trang chủ</span>
        </button>
        <button
          type="button"
          className={currentPage === "kanji" ? "navPill isActive" : "navPill"}
          onClick={onGoKanji}
          onMouseEnter={onPrefetchKanji}
          onFocus={onPrefetchKanji}
        >
          <span className="navPillInner"><span className="navGlyph" aria-hidden="true">漢</span>Học Kanji</span>
        </button>
        <button type="button" className={currentPage === "verbs" ? "navPill isActive" : "navPill"} onClick={onGoVerbs}>
          <span className="navPillInner"><span className="navGlyph" aria-hidden="true">行</span>Động từ</span>
        </button>
        <button type="button" className={currentPage === "vocabulary" ? "navPill isActive" : "navPill"} onClick={onGoVocabulary}>
          <span className="navPillInner"><BookOpen size={16} />Từ vựng JLPT</span>
        </button>
        <button type="button" className={currentPage === "lookup" ? "navPill isActive" : "navPill"} onClick={onGoLookup}>
          <span className="navPillInner"><Search size={16} />Tra cứu</span>
        </button>
      </nav>
    </header>
  );
}
