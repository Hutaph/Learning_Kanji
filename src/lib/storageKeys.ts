export const STORAGE_KEYS = {
  app: {
    layout: "kanji-layout",
    theme: "kanji-theme",
    studyGroup: "kanji-study-group",
    studyFocus: "kanji-study-focus",
    authJustSignedUp: "auth-just-signed-up"
  },
  jlpt: {
    activeLevel: "jlpt_activeLevel",
    subView: "jlpt_subView",
    lessonFilter: "jlpt_lessonFilter",
    wordScope: "jlpt_wordScope",
    testLesson: "jlpt_testLesson",
    testMode: "jlpt_testMode",
    hideLearned: "jlpt_hideLearned",
    learned: (level: string) => `jlpt-vocab-learned-${level}`,
    wrongReview: (level: string) => `jlpt-vocab-wrong-review-${level}`,
    shuffleEnabled: (level: string) => `jlpt_list_shuffle_enabled_${level}`,
    shuffleOrder: (level: string) => `jlpt_list_shuffle_order_${level}`
  },
  verb: {
    learnedMap: "verb_learned_map_v1",
    hideLearned: "verb_hide_learned_v1",
    shuffleEnabled: "verb_shuffle_enabled_v1",
    shuffleOrder: "verb_shuffle_order_v1",
    quizScope: "verb_quiz_scope_v1"
  },
  insights: {
    history: "learning_history_v1"
  }
} as const;
