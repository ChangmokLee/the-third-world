// Shared bilingual (English / Korean) dictionary + tiny i18n engine.
// Every page loads this file. Mark translatable text with:
//   <p data-i18n="home.cta">…</p>            → sets textContent
//   <input data-i18n-placeholder="join.code"> → sets placeholder
// Then call applyTranslations() (done automatically on DOMContentLoaded and
// whenever the language changes). The current language is remembered in
// localStorage under "ttw-lang" so it stays consistent across all pages.

(function () {
  const STRINGS = {
    en: {
      // --- Sign-in (index.html) ---
      'signin.subtitle': 'Cast it on the TV, play together with your phones — a D&D party game',
      'signin.prompt': 'Sign in with Google to begin.',
      'signin.google': 'Sign in with Google',
      'signin.note': 'Both hosts and players need to sign in with Google.',
      'signin.notConfigured': '⚠ Google login is not configured yet. Set up .env as described in the README.',

      // --- Home (home.html) ---
      'home.subtitle': 'What would you like to do?',
      'home.host': '📺 Start a new game on TV (Host)',
      'home.join': '📱 Join with a room code',
      'home.logout': 'Log out',

      // --- Host (host.html) ---
      'host.lobbyHint': 'Scan the QR code or enter the room code on your phone to join',
      'host.scanHint': 'Scan with your phone camera',
      'host.orCode': 'Or enter the room code',
      'host.startNeed': 'Start game (need 1+ players)',
      'host.start': 'Start game',
      'host.back': 'Back',
      'host.forkTitle': 'The Fork',
      'host.forkSubtitle': 'Two paths emerge from the darkness. Which way?',
      'host.makeChoice': 'Make your choice on your phone…',
      'host.results': 'Results',
      'host.nextRound': 'Next round',
      'host.alignmentsDealt': 'Alignments dealt',
      'host.good': 'Good',
      'host.evil': 'Evil',
      'host.rolesSecret': '(roles are secret)',
      'host.allConfirmed': 'All {total} players confirmed their roles ✓',
      'host.confirming': 'Confirming roles… {confirmed}/{total} ready',
      'host.votes': 'votes',
      'host.leftPath': 'Left path',
      'host.rightPath': 'Right path',

      // --- Controller (controller.html) ---
      'join.codeHint': 'Enter the 4-letter room code shown on the TV',
      'join.codePlaceholder': 'ABCD',
      'join.namePlaceholder': 'Nickname',
      'join.join': 'Join',
      'join.back': 'Back',
      'join.bothRequired': 'Please enter both the room code and a nickname.',
      'join.errRoomNotFound': 'Room not found. Check the code.',
      'join.errRoomFull': 'The room is full.',
      'join.errNameRequired': 'Please enter a nickname.',
      'join.errGeneric': 'Failed to join.',
      'wait.title': "You're in!",
      'wait.room': 'Room',
      'wait.waiting': 'Waiting for the host to start the game…',
      'choose.title': 'Decision Time',
      'choose.prompt': 'Which path will you take?',
      'choose.left': '⬅ Left path',
      'choose.right': 'Right path ➡',
      'choose.sent': 'Choice sent! Tap again to change it.',
      'done.title': 'Choice locked in',
      'done.subtitle': 'Check the TV screen!',
      'common.roomClosed': 'The host has closed the room.',

      // --- Role card ---
      'role.goodKicker': 'By Command of the Emperor',
      'role.goodOrders': 'You are named to the Emperor’s expedition. Carry out your charge with honor and return home victorious.',
      'role.goodFallback': 'Appointed to the Expedition',
      'role.evilKicker': 'Decree of the Cult of the Fallen',
      'role.evilOrders': 'You march among the chosen — not to save them, but to ensure none return. Let the Third World fall into shadow.',
      'role.evilFallback': 'Doom the Expedition',
      'role.confirm': 'I accept my fate',
      'role.waiting': 'Waiting for everyone to confirm…',
      'class.emperor-knight': 'Knight of the Emperor',
      'class.inquisitor': 'Inquisitor',
      'class.court-wizard': 'Court Wizard',
      'class.fallen-knight': 'Fallen Knight',
      'class.succubus': 'Succubus',
      'class.citizen': 'Loyal Subject',
      'class.cultist': 'Cultist',

      // --- Class skills (shown on the role card) ---
      'skill.emperor-knight': 'By Command of the Emperor: each day you may override the vote and execute one suspect on the spot.',
      'skill.court-wizard': 'Absolute Barrier: each night, shield one soul from the Cult’s blade.',
      'skill.inquisitor': 'Each night, divine whether one person belongs to the Cult.',
      'skill.fallen-knight': 'Assassinate: each night, the fallen strike down one of the chosen.',
      'skill.succubus': 'Seduction: choose a target at night — if it is the Emperor’s Knight, expose them at dawn.',
      'skill.citizen': 'You bear no special power — only your wits and your voice. Root out the Cult.',
      'skill.cultist': 'You serve the Cult in shadow. Blend in and ensure none return.',

      // --- Host: game phases ---
      'host.startNeed3': 'Start game (need 3+ players)',
      'host.fatesTitle': 'Fates are sealed',
      'host.confirmHint': 'Each player confirms their secret role on their phone.',
      'host.beginNight': 'Let night fall',
      'host.nightHint': 'Solve the trials together. In the dark, some pursue other ends…',
      'host.nightN': '🌙 Night {n}',
      'host.puzzleProgress': 'Players who finished their trials: {done}/{total}',
      'host.forceDawn': 'Force dawn',
      'host.dayN': '☀ Day {n}',
      'host.voteHint': 'Debate, then vote on your phones to execute one suspect.',
      'host.voteProgress': 'Votes cast: {voted}/{total}',
      'host.forceVote': 'Force the verdict',
      'host.nightDeath': '🗡 By night, {names} was slain.',
      'host.peacefulNight': '☼ The night passed without bloodshed.',
      'host.someoneSaved': '🛡 A blade was turned aside by the wizard’s ward.',
      'host.knightRevealed': '💋 Seduction reveals it: {name} is the Knight of the Emperor!',
      'host.noExecution': 'No one was executed.',
      'host.executed': '⚖ The people have spoken — {name} is executed.',
      'host.emperorExecuted': '👑 By command of the Emperor, {name} is executed at once.',
      'host.voteTie': 'The vote was tied — no one is executed.',
      'host.goodWins': 'The Empire Prevails',
      'host.evilWins': 'The Cult Triumphs',
      'host.newGame': 'New game',

      // --- Controller: night actions ---
      'act.confirm': 'Confirm',
      'act.sent': 'Your deed is done in the dark…',
      'act.failed': 'That action failed.',
      'act.protectKicker': 'Absolute Barrier',
      'act.protectPrompt': 'Whom do you shield from the Cult tonight?',
      'act.investigateKicker': 'Divination',
      'act.investigatePrompt': 'Whose allegiance will you uncover tonight?',
      'act.assassinateKicker': 'Assassination',
      'act.assassinatePrompt': 'Who falls to your blade tonight?',
      'act.seduceKicker': 'Seduction',
      'act.seducePrompt': 'Seduce one soul — if they are the Emperor’s Knight, they are exposed at dawn.',
      'act.emperorKicker': 'By Command of the Emperor',
      'act.emperorPrompt': 'Override the vote and execute one suspect at once.',
      'act.emperorBtn': 'Summary execution',

      // --- Controller: night puzzles / spectator ---
      'night.puzzleHint': 'Solve all of your own trials to let the night pass.',
      'night.puzzleDone': 'You solved every trial. Waiting for the others to finish…',
      'dead.spectate': 'You have fallen. Watch how the tale unfolds…',

      // --- Controller: day vote ---
      'vote.prompt': 'Who shall face execution?',
      'vote.skip': 'Abstain',
      'vote.sent': 'Your vote is cast.',
      'info.guilty': '🔥 Your divination burns true: {name} serves the Cult.',
      'info.innocent': '✨ Your divination is calm: {name} is no cultist.',

      // --- Controller: game over ---
      'over.checkTv': 'Check the TV for the full reveal!',
      'over.goodWins': 'The Empire Prevails',
      'over.evilWins': 'The Cult Triumphs',
      'over.youWon': 'Victory is yours.',
      'over.youLost': 'Your cause has fallen.',
    },

    ko: {
      // --- 로그인 ---
      'signin.subtitle': 'TV에 띄우고 휴대폰으로 함께 즐기는 D&D 파티 게임',
      'signin.prompt': '구글로 로그인하고 시작하세요.',
      'signin.google': '구글로 로그인',
      'signin.note': '호스트와 플레이어 모두 구글 로그인이 필요합니다.',
      'signin.notConfigured': '⚠ 구글 로그인이 아직 설정되지 않았습니다. README의 안내대로 .env를 설정하세요.',

      // --- 홈 ---
      'home.subtitle': '무엇을 하시겠어요?',
      'home.host': '📺 TV에서 새 게임 시작 (호스트)',
      'home.join': '📱 방 코드로 참가',
      'home.logout': '로그아웃',

      // --- 호스트 ---
      'host.lobbyHint': 'QR 코드를 스캔하거나 휴대폰에 방 코드를 입력해 참가하세요',
      'host.scanHint': '휴대폰 카메라로 스캔하세요',
      'host.orCode': '또는 방 코드를 입력하세요',
      'host.startNeed': '게임 시작 (1명 이상 필요)',
      'host.start': '게임 시작',
      'host.back': '뒤로',
      'host.forkTitle': '갈림길',
      'host.forkSubtitle': '어둠 속에서 두 갈래 길이 나타난다. 어느 쪽으로?',
      'host.makeChoice': '휴대폰에서 선택하세요…',
      'host.results': '결과',
      'host.nextRound': '다음 라운드',
      'host.alignmentsDealt': '진영 배정 완료',
      'host.good': '선',
      'host.evil': '악',
      'host.rolesSecret': '(역할은 비밀입니다)',
      'host.allConfirmed': '{total}명 전원이 역할을 확인했습니다 ✓',
      'host.confirming': '역할 확인 중… {confirmed}/{total}명 완료',
      'host.votes': '표',
      'host.leftPath': '왼쪽 길',
      'host.rightPath': '오른쪽 길',

      // --- 컨트롤러 ---
      'join.codeHint': 'TV에 표시된 4글자 방 코드를 입력하세요',
      'join.codePlaceholder': 'ABCD',
      'join.namePlaceholder': '닉네임',
      'join.join': '참가',
      'join.back': '뒤로',
      'join.bothRequired': '방 코드와 닉네임을 모두 입력하세요.',
      'join.errRoomNotFound': '방을 찾을 수 없습니다. 코드를 확인하세요.',
      'join.errRoomFull': '방이 가득 찼습니다.',
      'join.errNameRequired': '닉네임을 입력하세요.',
      'join.errGeneric': '참가에 실패했습니다.',
      'wait.title': '입장했습니다!',
      'wait.room': '방',
      'wait.waiting': '호스트가 게임을 시작하기를 기다리는 중…',
      'choose.title': '선택의 시간',
      'choose.prompt': '어느 길을 택하시겠습니까?',
      'choose.left': '⬅ 왼쪽 길',
      'choose.right': '오른쪽 길 ➡',
      'choose.sent': '선택을 전송했습니다! 다시 눌러 변경할 수 있습니다.',
      'done.title': '선택 완료',
      'done.subtitle': 'TV 화면을 확인하세요!',
      'common.roomClosed': '호스트가 방을 닫았습니다.',

      // --- 역할 카드 ---
      'role.goodKicker': '위대하신 황제 폐하의 지엄하신 명령',
      'role.goodOrders': '그대를 원정대로 임명한다.\n임무를 무사히 마치고 황제 폐하의 명예를 드높여라.\n\n위대하신 황제 폐하 만세.',
      'role.goodFallback': '원정대로 임명되었다',
      'role.evilKicker': '악의 교단 명령서',
      'role.evilOrders': '그대는 선택받은 자들 사이를 걷는다 — 그들을 구하기 위해서가 아니라, 누구도 돌아오지 못하게 하기 위해. 원정대를 파멸시켜라.',
      'role.evilFallback': '원정대를 파멸시켜라',
      'role.confirm': '운명을 받아들인다',
      'role.waiting': '모두가 확인하기를 기다리는 중…',
      'class.emperor-knight': '황제의 기사',
      'class.inquisitor': '이단 심문관',
      'class.court-wizard': '궁정 마법사',
      'class.fallen-knight': '타락한 기사',
      'class.succubus': '서큐버스',
      'class.citizen': '충성스러운 백성',
      'class.cultist': '교단원',

      // --- 직업 스킬 (역할 카드에 표시) ---
      'skill.emperor-knight': '황제의 이름으로: 매일 낮, 투표 결과를 무시하고 한 명을 즉결 처형할 수 있다.',
      'skill.court-wizard': '절대 결계: 매일 밤, 한 명을 타락한 교단의 칼날로부터 지킨다.',
      'skill.inquisitor': '매일 밤, 한 명이 교단인지 아닌지 확인할 수 있다.',
      'skill.fallen-knight': '암살: 매일 밤, 선택받은 자 한 명을 처형한다.',
      'skill.succubus': '유혹: 밤에 한 명을 고른다 — 그가 황제의 기사라면 새벽에 정체가 드러난다.',
      'skill.citizen': '특별한 힘은 없다 — 오직 너의 통찰과 목소리뿐. 교단을 색출하라.',
      'skill.cultist': '그대는 그림자 속에서 교단을 섬긴다. 섞여들어 누구도 돌아가지 못하게 하라.',

      // --- 호스트: 게임 단계 ---
      'host.startNeed3': '게임 시작 (3명 이상 필요)',
      'host.fatesTitle': '운명이 정해졌다',
      'host.confirmHint': '각자 휴대폰에서 자신의 비밀 역할을 확인하세요.',
      'host.beginNight': '밤을 시작한다',
      'host.nightHint': '함께 시련을 풀어라. 어둠 속에서 누군가는 다른 목적을 좇는다…',
      'host.nightN': '🌙 {n}번째 밤',
      'host.puzzleProgress': '시련을 끝난 인원: {done}/{total}명',
      'host.forceDawn': '강제로 동트기',
      'host.dayN': '☀ {n}일차',
      'host.voteHint': '토론한 뒤 휴대폰으로 처형할 용의자에게 투표하세요.',
      'host.voteProgress': '투표 완료: {voted}/{total}',
      'host.forceVote': '강제로 판결하기',
      'host.nightDeath': '🗡 밤사이 {names}(이)가 살해당했다.',
      'host.peacefulNight': '☼ 피 한 방울 없이 밤이 지나갔다.',
      'host.someoneSaved': '🛡 마법사의 결계가 칼날을 막아냈다.',
      'host.knightRevealed': '💋 유혹이 드러낸다 — {name}(은)는 황제의 기사다!',
      'host.noExecution': '아무도 처형되지 않았다.',
      'host.executed': '⚖ 백성의 뜻에 따라 {name}(이)가 처형되었다.',
      'host.emperorExecuted': '👑 황제의 이름으로, {name}(이)가 즉결 처형되었다.',
      'host.voteTie': '투표가 동수였다 — 아무도 처형되지 않았다.',
      'host.goodWins': '제국의 승리',
      'host.evilWins': '교단의 승리',
      'host.newGame': '새 게임',

      // --- 컨트롤러: 밤 행동 ---
      'act.confirm': '확정',
      'act.sent': '어둠 속에서 그대의 일을 마쳤다…',
      'act.failed': '행동에 실패했습니다.',
      'act.protectKicker': '절대 결계',
      'act.protectPrompt': '오늘 밤 교단으로부터 누구를 지키겠습니까?',
      'act.investigateKicker': '심판의 눈',
      'act.investigatePrompt': '오늘 밤 누구의 정체를 밝히겠습니까?',
      'act.assassinateKicker': '암살',
      'act.assassinatePrompt': '오늘 밤 그대의 칼날에 쓰러질 자는?',
      'act.seduceKicker': '유혹',
      'act.seducePrompt': '한 명을 유혹하라 — 그가 황제의 기사라면 새벽에 정체가 드러난다.',
      'act.emperorKicker': '황제의 이름으로',
      'act.emperorPrompt': '투표를 무시하고 용의자 한 명을 즉시 처형한다.',
      'act.emperorBtn': '즉결 처형',

      // --- 컨트롤러: 밤 퍼즐 / 관전 ---
      'night.puzzleHint': '자신의 시련을 모두 풀어야 밤이 지나갑니다.',
      'night.puzzleDone': '모든 시련을 풀었습니다. 다른 사람들이 끝내기를 기다리는 중…',
      'dead.spectate': '그대는 쓰러졌다. 이야기가 어떻게 흘러가는지 지켜보라…',

      // --- 컨트롤러: 낮 투표 ---
      'vote.prompt': '누구를 처형하시겠습니까?',
      'vote.skip': '기권',
      'vote.sent': '투표를 마쳤습니다.',
      'info.guilty': '🔥 심판이 타오른다 — {name}(은)는 교단을 섬긴다.',
      'info.innocent': '✨ 심판이 잔잔하다 — {name}(은)는 교단이 아니다.',

      // --- 컨트롤러: 게임 종료 ---
      'over.checkTv': 'TV에서 전체 결과를 확인하세요!',
      'over.goodWins': '제국의 승리',
      'over.evilWins': '교단의 승리',
      'over.youWon': '그대의 승리다.',
      'over.youLost': '그대의 대의는 무너졌다.',
    },
  };

  let lang = localStorage.getItem('ttw-lang') || 'en';

  // Translate a key, optionally interpolating {placeholders} from `vars`.
  function t(key, vars) {
    const table = STRINGS[lang] || STRINGS.en;
    let str = table[key];
    if (str == null) str = (STRINGS.en[key] != null ? STRINGS.en[key] : key);
    if (vars) {
      str = str.replace(/\{(\w+)\}/g, (m, name) =>
        vars[name] != null ? vars[name] : m
      );
    }
    return str;
  }

  // Replace text/placeholder for every tagged element in the document.
  function applyTranslations(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    scope.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
    });
    document.documentElement.setAttribute('lang', lang);
  }

  function getLang() {
    return lang;
  }

  // Change language: persist, re-apply static text, refresh toggles, and let
  // pages re-render any dynamic strings via the 'languagechange' event.
  function setLang(next) {
    if (next !== 'en' && next !== 'ko') return;
    lang = next;
    localStorage.setItem('ttw-lang', next);
    applyTranslations();
    document.querySelectorAll('.lang-toggle button').forEach((b) =>
      b.classList.toggle('active', b.dataset.lang === next)
    );
    window.dispatchEvent(new CustomEvent('ttw:languagechange', { detail: { lang } }));
  }

  // Inject a floating EN / 한국어 toggle into the top-right of the page,
  // unless the page already provides its own .lang-toggle.
  function mountToggle() {
    if (document.querySelector('.lang-toggle')) {
      wireToggles();
      return;
    }
    const wrap = document.createElement('div');
    wrap.className = 'lang-toggle lang-toggle-fixed';
    wrap.innerHTML =
      '<button type="button" data-lang="en">EN</button>' +
      '<button type="button" data-lang="ko">한국어</button>';
    document.body.appendChild(wrap);
    wireToggles();
  }

  function wireToggles() {
    document.querySelectorAll('.lang-toggle button').forEach((b) => {
      b.classList.toggle('active', b.dataset.lang === lang);
      b.addEventListener('click', () => setLang(b.dataset.lang));
    });
  }

  // Public API.
  window.I18N = { t, getLang, setLang, applyTranslations };

  document.addEventListener('DOMContentLoaded', () => {
    applyTranslations();
    mountToggle();
  });
})();
