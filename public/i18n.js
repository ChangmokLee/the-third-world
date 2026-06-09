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
      'role.goodOrders': '그대를 원정대로 임명한다. 임무를 무사히 마치고 황제 폐하의 명예를 드높여라. 위대하신 황제 폐하 만세.',
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
