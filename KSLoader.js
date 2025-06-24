// ==UserScript==
// @name         KayScience AutoAnswer
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Automatically Fills In Answers And Finishes Video
// @author       JOBBOT
// @match        https://kayscience.com/quiz/*
// @grant        GM_setValue
// @grant        GM_getValue
// @downloadURL  https://raw.githubusercontent.com/J0BB0T/AutoSolver/refs/heads/main/KSLoader.js
// @updateURL    https://raw.githubusercontent.com/J0BB0T/AutoSolver/refs/heads/main/KSLoader.js
// ==/UserScript==

(function() {
  'use strict';

  let mode = null;
  let questionsObserver = null;
  let savedAnswers = {};

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

  async function answerQuestion(qElement) {
    const label = qElement.querySelector('label.lbl-qstn');
    let qNumber = '?';
    if (label) {
      const match = label.textContent.trim().match(/^(\d+)\./);
      if (match) qNumber = match[1];
    }

    if (!(qNumber in savedAnswers)) {
      console.log(`No answer found for question ${qNumber}`);
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

    if (mode === 'add') {
      answerQuestion(qElement);
    }
  }

  function setupQuestionsObserver() {
    const container = document.querySelector('.row > .col-lg-12.custom_fm_col');
    if (!container) {
      console.warn('Question container not found');
      return null;
    }

    const observer = new MutationObserver(mutations => {
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

  function hideButtons() {
    const btns = document.querySelectorAll('#tm-add-answers');
    btns.forEach(b => b.style.display = 'none');
  }

  function showButtons() {
    const btns = document.querySelectorAll('#tm-add-answers');
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

  function getUnitIdFromUrl() {
    return $("#unit_id").val();
  }

  function getTaskIdFromInput() {
    return $("#task_id").val();
  }

  async function fetchLiveAnswers(unit_id, task_id, attempt) {
    try {
      const params = new URLSearchParams();
      params.append('unit_id', unit_id);
      params.append('task_id', task_id);
      params.append('attempt', attempt);

      const response = await fetch('https://kayscience.com/fetch-quiz-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: params.toString(),
        credentials: 'include'
      });

      if (!response.ok) {
        console.error('Failed to fetch quiz questions:', response.statusText);
        return null;
      }

      const data = await response.json();
      if (!data.quizsList) {
        console.error('No quizsList found in response');
        return null;
      }

      let fetched = {};
      for (const quiz of data.quizsList) {
        const labelMatch = quiz.html.match(/<label[^>]*>(.*?)<\/label>/);
        if (!labelMatch) continue;
        const qNumMatch = labelMatch[1].trim().match(/^(\d+)\./);
        if (!qNumMatch) continue;
        const qNum = qNumMatch[1];

        if (quiz.answer && quiz.answer.length > 0) {
          fetched[qNum] = quiz.answer[0];
        }
      }
      console.log('Fetched live answers:', fetched);
      return fetched;

    } catch(e) {
      console.error('Error fetching live answers:', e);
      return null;
    }
  }

  async function answerAllCurrentlyEnabledQuestions() {
    if (!savedAnswers || Object.keys(savedAnswers).length === 0) {
      console.warn('No answers found.');
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

    // Remove any existing buttons if present
    ['tm-get-answers', 'tm-add-answers'].forEach(id => {
      const existing = document.getElementById(id);
      if (existing) existing.parentElement.remove();
    });

    // Only add the Add Answers button (moved to the first position)
    const addAnswersBtn = addButton('Add Answers', 'tm-add-answers', async () => {
      mode = 'add';
      hideButtons();
      questionsObserver = setupQuestionsObserver();

      const unit_id = getUnitIdFromUrl();
      const task_id = getTaskIdFromInput();
      const attempt = '1';

      if (!unit_id || !task_id) {
        alert('Cannot find unit_id or task_id to fetch answers.');
        showButtons();
        return;
      }

      const liveAnswers = await fetchLiveAnswers(unit_id, task_id, attempt);
      if (!liveAnswers) {
        alert('Failed to fetch live answers.');
        showButtons();
        return;
      }

      savedAnswers = liveAnswers;

      answerAllCurrentlyEnabledQuestions();

      showButtons();
    });

    tuitionItem.parentNode.insertBefore(addAnswersBtn, tuitionItem);
  }

  var videoPlayStartTime = "";
  var videoPlayPusedTime = "";
  var videoPlayingState = 0;

  window.updateWatchedTimeForStudentHere = function(calcultatedTime) {
    var unit_id  = $("#unit_id").val();
    var task_id  = $("#task_id").val();
    var student_id  = $("#student_id").val();
    var video_id = $("#video_id").val();

    var urlForUps = null;
    var videoDurations = null;

    if (localStorage.getItem('vz_duration' + student_id + '_' + unit_id + '_' + video_id + '_' + task_id)) {
        var storedArray = localStorage.getItem('vz_duration' + student_id + '_' + unit_id + '_' + video_id + '_' + task_id);
        var result = JSON.parse(decodeURIComponent(storedArray));
        urlForUps = result[0]['urlForUp'];
        videoDurations = result[0]['videoDuration'];
    }

    if (!urlForUps) {
        console.warn('URL for update not found in localStorage. Cannot send update.');
        return;
    }

    $.ajax({
        url: urlForUps,
        type: 'POST',
        dataType: 'json',
        data: {
            studentId: student_id,
            unitId: unit_id,
            calcultatedTime: calcultatedTime,
            videoDuration: videoDurations,
            videoId: video_id,
            taskId: task_id
        },
    })
    .done(function() {
        videoPlayStartTime = videoPlayPusedTime;
    })
    .fail(function() {
        console.warn('Failed to send video watched update.');
    });
  };

  function createTimeStartAndRecord() {
    var dt = new Date();
    var time = dt.getHours() + ":" + dt.getMinutes() + ":" + dt.getSeconds();
    return time;
  }

  function calculateTheTimeDiffrence(playerStatus = null) {
    var unit_id  = $("#unit_id").val();
    var task_id  = $("#task_id").val();
    var student_id  = $("#student_id").val();
    var video_id = $("#video_id").val();
    var time_start = new Date();
    var time_end = new Date();
    var value_start = videoPlayStartTime.split(':');
    var value_end = videoPlayPusedTime.split(':');

    time_start.setHours(value_start[0], value_start[1], value_start[2], 0);
    time_end.setHours(value_end[0], value_end[1], value_end[2], 0);

    if ((time_end - time_start) > 0) {
      var calcultatedTime = time_end - time_start;
      var submittedTime = [];
      submittedTime.push({ calcultatedTime: calcultatedTime });
      localStorage.setItem('vz_time' + student_id + '_' + unit_id + '_' + video_id + '_' + task_id, encodeURIComponent(JSON.stringify(submittedTime)));
      if (playerStatus === 2 || playerStatus === 0) {
        updateWatchedTimeForStudentHere(calcultatedTime);
      }
    }
  }

  function everyTime() {
    if (videoPlayStartTime !== '' && videoPlayingState === 1) {
      videoPlayPusedTime = createTimeStartAndRecord();
      calculateTheTimeDiffrence();
    }
  }

  function setupYouTubeTracker() {
    const iframe = document.querySelector('iframe#myVideo, iframe[src*="youtube.com"]');
    if (!iframe) {
      console.warn('YouTube iframe not found for video tracking.');
      return;
    }

    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);

      window.onYouTubeIframeAPIReady = () => {
        initPlayer();
      };
    } else {
      initPlayer();
    }

    function initPlayer() {
      const player = new YT.Player(iframe, {
        events: {
          'onStateChange': onPlayerStateChange
        }
      });

      function onPlayerStateChange(event) {
        if(event.data === YT.PlayerState.PLAYING) {
          videoPlayingState = 1;
          videoPlayStartTime = createTimeStartAndRecord();
          console.log('Video started playing:', videoPlayStartTime);
        }
        else if(event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
          videoPlayingState = 0;
          videoPlayPusedTime = createTimeStartAndRecord();
          console.log('Video paused/stopped:', videoPlayPusedTime);
          calculateTheTimeDiffrence(event.data);
        }
      }
    }
  }

  setupYouTubeTracker();
  setInterval(everyTime, 1000);
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
