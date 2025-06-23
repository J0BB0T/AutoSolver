// ==UserScript==
// @name         KayScience AutoAnswer
// @namespace    http://tampermonkey.net/
// @version      1
// @description  Will automatically answer any KayScience question.
// @author       JOBBOT
// @match        https://kayscience.com/quiz/*
// @grant        GM_setValue
// @grant        GM_getValue
// @downloadURL https://raw.githubusercontent.com/J0BB0T/AutoSolver/refs/heads/main/KSLoader.js
// @updateURL https://raw.githubusercontent.com/J0BB0T/AutoSolver/refs/heads/main/KSLoader.js
// ==/UserScript==

(function() {
  'use strict';

  let mode = null;
  let questionsObserver = null;

  const redoSelector = 'a#redoTaskButton.btn.btn-primary.btn-lg.align-items-center.justify-content-center';
  const submitBtnSelector = 'a.btn-sub-quiz.btn.btn-blue.mt-2';

  function clickRedoButton(button) {
    setTimeout(() => {
      button.click();
    }, 1000);
  }

  function checkExistingRedo() {
    const buttons = document.querySelectorAll(redoSelector);
    buttons.forEach(btn => clickRedoButton(btn));
  }

  function setupRedoObserver() {
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches && node.matches(redoSelector)) {
            clickRedoButton(node);
            observer.disconnect();
            return;
          }
          const found = node.querySelector?.(redoSelector);
          if (found) {
            clickRedoButton(found);
            observer.disconnect();
            return;
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  function submitAnswerWrapper(questionId, quizType, answer) {
    if (typeof submitAnswer === 'function') {
      submitAnswer(questionId, quizType, answer);
    } else {
      console.warn('submitAnswer function not found!');
    }
  }

  function failQuestion(qElement) {
    const questionId = qElement.id.split('_')[2];
    if (!questionId) return;
    if (qElement.dataset.__autoAttempted) return;
    qElement.dataset.__autoAttempted = 'true';

    submitAnswerWrapper(questionId, 2, 'e');
    setTimeout(() => {
      submitAnswerWrapper(questionId, 2, 'e');
    }, 1);
  }

  async function answerQuestion(qElement) {
    let savedStr = await GM_getValue('savedAnswers', '{}');
    let savedAnswers;
    try {
      savedAnswers = JSON.parse(savedStr);
    } catch {
      savedAnswers = {};
    }

    const label = qElement.querySelector('label.lbl-qstn');
    let qNumber = '?';
    if (label) {
      const match = label.textContent.trim().match(/^(\d+)\./);
      if (match) qNumber = match[1];
    }

    if (!(qNumber in savedAnswers)) {
      console.log(`No saved answer for question ${qNumber}`);
      return;
    }

    const input = qElement.querySelector('input.txt_single-ans:not([disabled])');
    if (!input) return;

    const answer = savedAnswers[qNumber];
    input.value = answer;

    const questionId = qElement.id.split('_')[2];
    if (questionId) {
      submitAnswerWrapper(questionId, 2, answer);
      console.log(`Answered Q${qNumber}: ${answer}`);
    }
  }

  function onQuestionAdded(qElement) {
    if (!qElement.classList.contains('custom_grp_fm')) return;

    if (mode === 'get') {
      failQuestion(qElement);
    } else if (mode === 'add') {
      answerQuestion(qElement);
    }
  }
  function setupQuestionsObserver() {
    const container = document.querySelector('.row > .col-lg-12.custom_fm_col');
    if (!container) {
      console.warn('Question container not found');
      return null;
    }

    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return;

          if (node.classList.contains('custom_grp_fm')) {
            onQuestionAdded(node);
          } else {
            node.querySelectorAll?.('.custom_grp_fm').forEach(q => {
              onQuestionAdded(q);
            });
          }
        });
      });
    });

    observer.observe(container, { childList: true, subtree: true });
    return observer;
  }

  function saveAllAnswers() {
    if (mode !== 'get') {
      return;
    }

    const answersObj = {};
    const questions = document.querySelectorAll('.custom_grp_fm');
    questions.forEach((q) => {
      const label = q.querySelector('label.lbl-qstn');
      let qNumber = '?';
      if (label) {
        const match = label.textContent.trim().match(/^(\d+)\./);
        if (match) qNumber = match[1];
      }

      const answerEl = q.querySelector('.answer-success h4');
      if (answerEl) {
        let answerText = answerEl.textContent.trim().replace(/^Answer:\s*/i, '');
        answersObj[qNumber] = answerText;
      }
    });

    GM_setValue('savedAnswers', JSON.stringify(answersObj));
  }

  function watchSubmitButtonAndSave() {
    function handleSubmit() {
      saveAllAnswers();

      if (questionsObserver) {
        questionsObserver.disconnect();
        questionsObserver = null;
      }

      mode = null;
      showButtons();

      setTimeout(() => {
        console.log('Refreshing page...');
        location.reload();
      }, 1000);
    }

    let submitBtn = document.querySelector(submitBtnSelector);
    if (submitBtn) {
      submitBtn.addEventListener('click', handleSubmit, { once: true });
    } else {
      const submitObserver = new MutationObserver(() => {
        submitBtn = document.querySelector(submitBtnSelector);
        if (submitBtn) {
          submitBtn.addEventListener('click', handleSubmit, { once: true });
          submitObserver.disconnect();
        }
      });
      submitObserver.observe(document.body, { childList: true, subtree: true });
    }
  }

  function hideButtons() {
    const btns = document.querySelectorAll('#tm-get-answers, #tm-add-answers');
    btns.forEach(b => b.style.display = 'none');
  }

  function showButtons() {
    const btns = document.querySelectorAll('#tm-get-answers, #tm-add-answers');
    btns.forEach(b => b.style.display = '');
  }

  function addButton(text, id, clickHandler) {
    const li = document.createElement('li');
    li.style.display = 'block';

    const a = document.createElement('a');
    a.className = 'btn btn-timetable px-2';
    a.href = 'javascript:void(0)';
    a.id = id;
    a.textContent = text;

    a.style.backgroundColor = 'rgb(35, 100, 235)';
    a.style.color = 'white';
    a.style.borderRadius = '4px';
    a.style.marginRight = '5px';
    a.style.userSelect = 'none';
    a.style.border = '1px solid rgb(45, 110, 245)';
    a.style.outline = 'none';
    a.style.boxShadow = 'none';
    a.style.padding = '5px 12px';
    a.style.cursor = 'pointer';
    a.style.textDecoration = 'none';
    a.style.fontWeight = '600';
    a.style.fontSize = '14px';

    a.addEventListener('focus', () => {
      a.style.outline = '2px solid rgb(45, 110, 245)';
    });
    a.addEventListener('blur', () => {
      a.style.outline = 'none';
    });

    a.addEventListener('click', clickHandler);

    li.appendChild(a);
    return li;
  }

  function addButtonsToNavbar() {
    const navbarRight = document.querySelector('.navbar.navbar-right');
    if (!navbarRight) {
      console.warn('Navbar not found.');
      return;
    }

    const tuitionItem = navbarRight.querySelector('li.tuition_timetable');
    if (!tuitionItem) {
      console.warn('Tuition Timetable button not found.');
      return;
    }

    ['tm-get-answers', 'tm-add-answers'].forEach(id => {
      const existing = document.getElementById(id);
      if (existing) existing.parentElement.remove();
    });

    const getAnswersBtn = addButton('Get Answers', 'tm-get-answers', () => {
      mode = 'get';
      hideButtons();
      questionsObserver = setupQuestionsObserver();
      failAllCurrentlyEnabledQuestions();
      watchSubmitButtonAndSave();
    });

    const addAnswersBtn = addButton('Add Answers', 'tm-add-answers', () => {
      mode = 'add';
      hideButtons();
      questionsObserver = setupQuestionsObserver();
      answerAllCurrentlyEnabledQuestions();
    });

    tuitionItem.parentNode.insertBefore(getAnswersBtn, tuitionItem);
    tuitionItem.parentNode.insertBefore(addAnswersBtn, getAnswersBtn);
  }

  function failAllCurrentlyEnabledQuestions() {
    const questions = document.querySelectorAll('.custom_grp_fm');
    questions.forEach(q => {
      const input = q.querySelector('input.txt_single-ans:not([disabled])');
      if (input) failQuestion(q);
    });
  }

  async function answerAllCurrentlyEnabledQuestions() {
    let savedStr = await GM_getValue('savedAnswers', '{}');
    let savedAnswers;
    try {
      savedAnswers = JSON.parse(savedStr);
    } catch {
      savedAnswers = {};
    }

    if (!savedAnswers || Object.keys(savedAnswers).length === 0) {
      console.warn('No saved answers found.');
      return;
    }

    const questions = document.querySelectorAll('.custom_grp_fm');
    questions.forEach(q => {
      const label = q.querySelector('label.lbl-qstn');
      let qNumber = '?';
      if (label) {
        const match = label.textContent.trim().match(/^(\d+)\./);
        if (match) qNumber = match[1];
      }

      if (!(qNumber in savedAnswers)) return;

      const input = q.querySelector('input.txt_single-ans:not([disabled])');
      if (!input) return;

      const answer = savedAnswers[qNumber];
      input.value = answer;

      const questionId = q.id.split('_')[2];
      if (questionId) {
        submitAnswerWrapper(questionId, 2, answer);
        console.log(`Answered Q${qNumber}: ${answer}`);
      }
    });
  }

  function getUnitIdFromUrl() {
    const match = window.location.pathname.match(/\/quiz\/(\d+)\//);
    return match ? match[1] : null;
  }

  function getTaskIdFromInput() {
    const input = document.querySelector('input#unit_id');
    return input ? input.value : null;
  }

  function updatevideo() {
    var task_id = getTaskIdFromInput();
    var attempt = '1';
    var unit_id = getUnitIdFromUrl();
    if (!unit_id || !task_id) return;

    var video_completed = player.getDuration();

    $.ajax({
      url: "https://kayscience.com/updatevideo",
      type: 'POST',
      data: {'unit_id': unit_id, 'task_id': task_id, 'attempt': attempt, 'video_completed': video_completed},
      dataType: "json",
      headers: {
          'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content')
      }
    }).done(function (d) {
      $("#video-banner").html("&nbsp;&nbsp;<i class='fa fa-info-circle'></i>&nbsp;&nbsp;&nbsp;The video is locked whilst you attempt the quiz");
      $('#myVideo').removeAttr("src");
      $(".txt_single-ans").last().removeClass('keydisabled');
      $(".lbl-qstn").last().removeClass('qstn-txt');
      $('.fill-answer').removeClass('keydisabled');
      $(".fill-input").last().removeClass('qstn-txt');
    });
  }

  setInterval(updatevideo, 100);

  setInterval(() => {
    if (mode === 'get') {
      saveAllAnswers();
    }
  }, 100);

  waitForNavbar();
  checkExistingRedo();
  setupRedoObserver();

  function waitForNavbar(maxAttempts = 20, interval = 250) {
    let attempts = 0;
    const timer = setInterval(() => {
      if (document.querySelector('.navbar.navbar-right')) {
        clearInterval(timer);
        addButtonsToNavbar();
      } else if (++attempts >= maxAttempts) {
        clearInterval(timer);
        console.warn('Navbar not found, buttons not added.');
      }
    }, interval);
  }

})();
