/* ==========================================================================
   Защита информации — учебный справочник
   Логика сайта: рендер карточек, поиск, фильтры, раскрытие ответов,
   раздел источников, плавная прокрутка.
   Данные лежат в data.js (window.QUESTIONS).
   Без внешних библиотек и зависимостей.
   ========================================================================== */
(function () {
  'use strict';

  var QUESTIONS = window.QUESTIONS || [];

  /* ------------------------------------------------------------------
     1. Вспомогательные функции
     ------------------------------------------------------------------ */

  /** Экранирование текста перед вставкой в innerHTML. */
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Нормализация строки для поиска: регистр, «ё», лишние пробелы. */
  function normalize(str) {
    return String(str)
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Иконка внешней ссылки (инлайн, без внешних файлов). */
  var ICON_EXTERNAL =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M14 4h6v6"/><path d="M20 4l-8.5 8.5"/>' +
    '<path d="M18 14.5V19a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 19V8a1.5 1.5 0 0 1 1.5-1.5H10"/>' +
    '</svg>';

  var ICON_DOC =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M14 3H7a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V7.5z"/>' +
    '<path d="M14 3v4.5h4.5"/>' +
    '</svg>';

  var ICON_CHEVRON =
    '<svg class="card__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9.5l6 6 6-6"/></svg>';

  /** Разбивает текст ответа на абзацы по пустой строке. */
  function splitParagraphs(text) {
    return String(text)
      .split(/\n\s*\n/)
      .map(function (p) { return p.trim(); })
      .filter(Boolean);
  }

  /**
   * Убирает номер из начала формулировки («14. Понятие…» → «Понятие…»),
   * потому что номер уже показан отдельной плашкой рядом с текстом.
   * Сам текст вопроса в data.js при этом не меняется.
   */
  function stripLeadingNumber(text) {
    return String(text).replace(/^\s*\d{1,3}\s*[.)]\s*/, '');
  }

  /* ------------------------------------------------------------------
     2. Состояние интерфейса
     ------------------------------------------------------------------ */

  var state = {
    query: ''         // строка поиска
  };

  var dom = {};
  var cardIndex = []; // список созданных карточек

  /* ------------------------------------------------------------------
     3. Рендер карточек вопросов
     ------------------------------------------------------------------ */

  /**
   * Собирает HTML одного вопроса.
   * В раскрытом блоке выводятся: тема, полный вопрос, полный ответ,
   * раздел «Источники» с названиями и рабочими ссылками.
   */
  function buildCardHtml(item) {
    var bodyId = 'card-body-' + item.number;
    var questionText = stripLeadingNumber(item.question);

    var sourcesHtml = item.sources.map(function (src) {
      return '' +
        '<a class="src" href="' + escapeHtml(src.url) + '" target="_blank" rel="noopener noreferrer">' +
          '<span class="src__title">' + ICON_EXTERNAL + '<span>' + escapeHtml(src.title) + '</span></span>' +
          '<span class="src__url">' + escapeHtml(src.url) + '</span>' +
        '</a>';
    }).join('');

    var paragraphsHtml = splitParagraphs(item.answer).map(function (p) {
      return '<p>' + escapeHtml(p) + '</p>';
    }).join('');

    return '' +
      '<article class="card" data-number="' + item.number + '">' +
        '<div class="card__head">' +
          '<span class="card__num">' + item.number + '</span>' +
          '<div class="card__main">' +
            '<span class="card__topic">' + escapeHtml(item.topic) + '</span>' +
            '<h3 class="card__question">' + escapeHtml(questionText) + '</h3>' +
          '</div>' +
          '<button type="button" class="card__toggle" aria-expanded="false" aria-controls="' + bodyId + '">' +
            '<span class="card__toggle-text">Открыть ответ</span>' + ICON_CHEVRON +
          '</button>' +
        '</div>' +

        '<div class="card__wrap" id="' + bodyId + '" role="region">' +
          '<div class="card__body">' +

            '<div class="block">' +
              '<span class="block__label">Тема вопроса</span>' +
              '<p class="block__text">' + escapeHtml(item.topic) + '</p>' +
            '</div>' +

            '<div class="block">' +
              '<span class="block__label">Вопрос</span>' +
              '<p class="block__qtext">' + escapeHtml(questionText) + '</p>' +
            '</div>' +

            '<div class="block">' +
              '<span class="block__label">Ответ</span>' +
              '<div class="block__text">' + paragraphsHtml + '</div>' +
            '</div>' +

            '<div class="block">' +
              '<span class="block__label">Источники</span>' +
              '<div class="src-list">' + sourcesHtml + '</div>' +
            '</div>' +

          '</div>' +
        '</div>' +
      '</article>';
  }

  function renderCards() {
    if (!dom.cards) return;

    dom.cards.innerHTML = QUESTIONS.map(buildCardHtml).join('');

    // Кэшируем элементы карточек для последующей фильтрации
    cardIndex = Array.prototype.slice.call(dom.cards.querySelectorAll('.card')).map(function (card) {
      return {
        el: card,
        number: parseInt(card.getAttribute('data-number'), 10),
        toggle: card.querySelector('.card__toggle'),
        wrap: card.querySelector('.card__wrap')
      };
    });

    attachCardEvents();
  }

  function attachCardEvents() {
    cardIndex.forEach(function (card) {
      card.toggle.addEventListener('click', function () {
        toggleCard(card);
      });
      card.wrap.__card = card;
      card.wrap.addEventListener('transitionend', onWrapTransitionEnd);
    });
  }

  /* ------------------------------------------------------------------
     4. Раскрытие и сворачивание ответа
     ------------------------------------------------------------------ */

  /**
   * Плавно раскрывает/сворачивает карточку.
   * Несколько карточек могут быть открыты одновременно —
   * содержимое при этом не пересоздаётся и не теряется.
   */
  function toggleCard(card) {
    var wrap = card.wrap;
    var isOpen = card.el.classList.contains('is-open');

    if (isOpen) {
      card.el.classList.remove('is-open');
      card.toggle.setAttribute('aria-expanded', 'false');
      card.toggle.querySelector('.card__toggle-text').textContent = 'Открыть ответ';

      // Фиксируем текущую высоту, принудительно пересчитываем раскладку
      // и только затем обнуляем её — так переход запускается в любом браузере
      wrap.style.height = wrap.offsetHeight + 'px';
      void wrap.offsetHeight;
      wrap.style.height = '0px';
    } else {
      card.el.classList.add('is-open');
      card.toggle.setAttribute('aria-expanded', 'true');
      card.toggle.querySelector('.card__toggle-text').textContent = 'Свернуть ответ';

      wrap.style.height = '0px';
      void wrap.offsetHeight;
      wrap.style.height = wrap.scrollHeight + 'px';
    }
  }

  /**
   * После завершения анимации переводит раскрытую карточку в режим
   * height:auto — тогда содержимое не обрезается при изменении
   * размера окна, изменении шрифта или переносе текста.
   */
  function onWrapTransitionEnd(event) {
    if (event.propertyName !== 'height') return;
    var card = event.target.__card;
    if (!card) return;
    if (card.el.classList.contains('is-open')) {
      card.wrap.style.height = 'auto';
    } else {
      card.wrap.style.height = '';
    }
  }

  /** Принудительное обновление размеров открытых карточек. */
  function refreshOpenCards() {
    cardIndex.forEach(function (card) {
      if (card.el.classList.contains('is-open')) {
        card.wrap.style.height = 'auto';
      }
    });
  }

  /* ------------------------------------------------------------------
     5. Поиск и фильтрация
     ------------------------------------------------------------------ */

  /** Строка поиска по номеру, вопросу, теме, ответу и источникам. */
  function buildSearchIndex(item) {
    var sourcesText = item.sources.map(function (s) { return s.title + ' ' + s.url; }).join(' ');
    return normalize([
      item.number,
      item.question,
      item.topic,
      item.answer,
      sourcesText
    ].join(' '));
  }

  var searchIndexes = QUESTIONS.map(buildSearchIndex);

  function applyFilters() {
    var query = normalize(state.query);
    var terms = query ? query.split(' ') : [];

    // Если запрос — только число (например "6"), ищем строго по номеру вопроса
    var isNumberQuery = /^\d+$/.test(query);
    var targetNumber = isNumberQuery ? parseInt(query, 10) : null;

    var visible = 0;

    cardIndex.forEach(function (card, i) {
      var okQuery;

      if (isNumberQuery) {
        // Точное совпадение номера вопроса
        okQuery = card.number === targetNumber;
      } else {
        // Обычный полнотекстовый поиск
        okQuery = !terms.length || terms.every(function (term) {
          return searchIndexes[i].indexOf(term) !== -1;
        });
      }

      if (okQuery) {
        card.el.hidden = false;
        visible++;
      } else {
        // Скрываем вместе с эффектом: сначала закрываем, затем прячем
        if (card.el.classList.contains('is-open')) {
          card.el.classList.remove('is-open');
          card.toggle.setAttribute('aria-expanded', 'false');
          card.toggle.querySelector('.card__toggle-text').textContent = 'Открыть ответ';
          card.wrap.style.height = card.wrap.offsetHeight + 'px';
          void card.wrap.offsetHeight;
          card.wrap.style.height = '0px';
        }
        card.el.hidden = true;
      }
    });

    // Пустое состояние
    if (dom.empty) {
      dom.empty.hidden = visible !== 0;
    }
    if (dom.cards) {
      dom.cards.hidden = visible === 0;
    }
  }

  function resetAll() {
    state.query = '';
    if (dom.search) dom.search.value = '';
    if (dom.searchClear) dom.searchClear.hidden = true;
  }

  /* ------------------------------------------------------------------
     6. Раздел «Полезные источники»
     ------------------------------------------------------------------ */

  /** Короткие пояснения к документам — на основе материалов проекта. */
  var SOURCE_NOTES = {
    'https://base.garant.ru/70795270/':
      'Порядок создания автоматизированных систем в защищённом исполнении: стадии, ввод в действие и аттестация.',
    'https://garant.ru/products/ipo/prime/doc/400325044/':
      'Методика ФСТЭК России: выявление угроз, описание уязвимостей, нарушителей и сценариев.',
    'https://rulaws.ru/laws/Federalnyy-zakon-ot-06.04.2011-N-63-FZ/':
      'Базовый закон об электронной подписи: используется как опора в вопросах о целостности информации.',
    'https://lawnotes.ru/npa/prikaz-fstek-rossii-ot-11.04.2025-n-117':
      'Приказ ФСТЭК России по защите информации — самый часто используемый источник в каталоге.',
    'https://rulaws.ru/laws/Federalnyy-zakon-ot-27.07.2006-N-149-FZ/':
      'Общий закон об информации, информационных технологиях и защите информации.',
    'https://rulaws.ru/laws/Federalnyy-zakon-ot-29.07.2004-N-98-FZ/':
      'Режим коммерческой тайны: защита конфиденциальной информации и категорирование ресурсов.',
    'https://base.garant.ru/414070697/':
      'Состав и содержание мероприятий и мер по обеспечению защиты информации.',
    'https://base.garant.ru/197886/':
      'Исторический документ Гостехкомиссии России: классификация АС и требования по защите от НСД.',
    'https://base.garant.ru/404733099/':
      'Стадии создания автоматизированных систем в защищённом исполнении.',
    'https://base.garant.ru/187735/':
      'Исторический документ: показатели защищённости средств вычислительной техники.',
    'https://base.garant.ru/197885/':
      'Исторический документ Гостехкомиссии России: показатели защищённости от НСД.',
    'https://base.garant.ru/70252506/':
      'Правила определения уровней защищённости персональных данных и выбора мер защиты.',
    'https://base.garant.ru/12148567/':
      'Основной закон о персональных данных: требования к защите информации.',
    'https://base.garant.ru/403255670/':
      'Правила разработки технического задания на создание автоматизированной системы.',
    'https://base.garant.ru/403358611/':
      'Требования к эксплуатационной документации систем в защищённом исполнении.',
    'https://rulaws.ru/laws/Federalnyy-zakon-ot-22.11.1995-N-171-FZ/':
      'Закон о ЕГАИС: применение при работе с информационными системами.'
  };

  /** Собирает уникальные источники из всех 50 вопросов. */
  function collectSources() {
    var map = {};

    QUESTIONS.forEach(function (item) {
      item.sources.forEach(function (src) {
        if (!map[src.url]) {
          map[src.url] = {
            url: src.url,
            title: src.title,
            notes: [],
            numbers: []
          };
        }
        // Дополняем число вопросов, где встречается документ
        if (map[src.url].numbers.indexOf(item.number) === -1) {
          map[src.url].numbers.push(item.number);
        }
      });
    });

    return Object.keys(map).map(function (key) { return map[key]; });
  }

  function renderSources() {
    if (!dom.sourcesList) return;

    var list = collectSources();

    dom.sourcesList.innerHTML = list.map(function (src) {
      var note = SOURCE_NOTES[src.url] || 'Документ из материалов учебного проекта.';
      var count = src.numbers.length;
      var plural = count % 10 === 1 && count % 100 !== 11 ? 'вопросе'
                 : (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20) ? 'вопросах' : 'вопросах');

      return '' +
        '<article class="source">' +
          '<span class="source__badge">' + ICON_DOC + 'Документ</span>' +
          '<h3 class="source__title">' + escapeHtml(src.title) + '</h3>' +
          '<p class="source__desc">' + escapeHtml(note) + '</p>' +
          '<p class="source__nums">Используется в <b>' + count + '</b> ' + plural + ': ' + src.numbers.join(', ') + '</p>' +
          '<a class="source__link" href="' + escapeHtml(src.url) + '" target="_blank" rel="noopener noreferrer">' +
            ICON_EXTERNAL + escapeHtml(src.url) +
          '</a>' +
        '</article>';
    }).join('');
  }

  /* ------------------------------------------------------------------
     7. Плавная прокрутка
     ------------------------------------------------------------------ */

  function scrollToEl(el) {
    if (!el) return;
    var top = el.getBoundingClientRect().top + window.pageYOffset - 70;
    window.scrollTo({
      top: top < 0 ? 0 : top,
      behavior: 'smooth'
    });
  }

  /* ------------------------------------------------------------------
     8. Инициализация
     ------------------------------------------------------------------ */

  function init() {
    dom.cards = document.getElementById('cards');
    dom.empty = document.getElementById('empty');
    dom.search = document.getElementById('search');
    dom.searchClear = document.getElementById('searchClear');
    dom.sourcesList = document.getElementById('sourcesList');

    renderCards();
    renderSources();
    applyFilters();

    /* Поиск с небольшой задержкой ввода */
    var timer = null;
    if (dom.search) {
      dom.search.addEventListener('input', function () {
        state.query = dom.search.value;
        if (dom.searchClear) dom.searchClear.hidden = !state.query;
        clearTimeout(timer);
        timer = setTimeout(applyFilters, 120);
      });

      // Enter сразу применяет фильтр, Escape очищает строку
      dom.search.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          clearTimeout(timer);
          applyFilters();
        } else if (e.key === 'Escape' && state.query) {
          e.preventDefault();
          resetAll();
          dom.search.blur();
        }
      });
    }

    if (dom.searchClear) {
      dom.searchClear.addEventListener('click', function () {
        resetAll();
        if (dom.search) dom.search.focus();
      });
    }

    /* Кнопка «Очистить поиск» в пустом состоянии */
    var resetEmpty = document.querySelector('[data-reset-empty]');
    if (resetEmpty) {
      resetEmpty.addEventListener('click', function () {
        resetAll();
        if (dom.search) dom.search.focus();
      });
    }

    /* Плавная прокрутка по якорям */
    document.addEventListener('click', function (e) {
      var link = e.target.closest ? e.target.closest('a[data-scroll]') : null;
      if (!link) return;
      var id = link.getAttribute('href');
      if (!id || id.charAt(0) !== '#') return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      scrollToEl(target);
    });

    /* Кнопка «Наверх» */
    var toTop = document.getElementById('toTop');
    if (toTop) {
      toTop.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    /* Пересчёт высоты открытых карточек при изменении размера окна */
    var resizeTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(refreshOpenCards, 150);
    });

    /* Быстрый переход к поиску по клавише «/» */
    document.addEventListener('keydown', function (e) {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      var tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (!dom.search) return;
      e.preventDefault();
      scrollToEl(dom.search);
      dom.search.focus();
      dom.search.select();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();