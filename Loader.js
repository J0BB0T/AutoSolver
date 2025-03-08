// ==UserScript==
// @name         Bedrock Learning Autosolver
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Takes a screenshot of Bedrock Learning, sends it to Gemini, and displays the answer in a beautifully styled new tab.
// @author       JOBBOT
// @match        https://app.bedrocklearning.org/*
// @grant        GM_openInTab
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @license      MIT
// @downloadURL https://raw.githubusercontent.com/J0BB0T/Bedrock-AutoSolver/refs/heads/main/Loader.js
// @updateURL https://raw.githubusercontent.com/J0BB0T/Bedrock-AutoSolver/refs/heads/main/Loader.js
// ==/UserScript==

(function () {
    'use strict';

    const Default_Username = "Osama Bin Laden" // Replace With Your Username You Would Like To Be Shown
    const GEMINI_API_KEY_KEY = 'KEY'; // Replace With Gemini API Key (https://aistudio.google.com/app/apikey)
    let Answer_Result = ""
    let geminiApiKey = GM_getValue(GEMINI_API_KEY_KEY, null);
    const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=';
    const DEFAULT_PROMPT = "Analyze the image and identify any questions. Answer the questions with as much detail as possible. Show your reasoning. Do NOT explain anything in the answer, just give the answer itself but use punctuation and start the answer with a capital letter. Also do NOT use - in your answer. Seperate the answer to the rest of the message like this: Answer: [Answer Here] [New Line] ---------- [New Line] Reason: [Reason Here]";
    const ADDITIONAL_PROMPT_MESSAGE = "Enter any additional instructions or questions to send with the image (or leave blank for default prompt):";

    async function checkApiKey() {
        if (!geminiApiKey) {
            geminiApiKey = prompt("Enter your Google AI Studio API Key:");
            if (geminiApiKey) {
                GM_setValue(GEMINI_API_KEY_KEY, geminiApiKey);
                alert("API key saved. Press Ctrl+X again to process the question.");
            } else {
                alert("API key required for the script to function.");
            }
            return false;
        }
        return true;
    }

    async function captureScreenshot() {
        if (typeof html2canvas === "undefined") {
            await new Promise(resolve => {
                const script = document.createElement("script");
                script.src = "https://html2canvas.hertzen.com/dist/html2canvas.min.js";
                script.onload = resolve;
                document.head.appendChild(script);
            });
        }
        return html2canvas(document.body, {
            useCORS: true,
            allowTaint: true,
            scrollX: 0,
            scrollY: 0,
            windowWidth: document.body.scrollWidth,
            windowHeight: document.body.scrollHeight,
            width: document.body.scrollWidth,
            height: document.body.scrollHeight
        });
    }

    function convertCanvasToBlob(canvas) {
        return new Promise((resolve, reject) => {
            canvas.toBlob(blob => {
                blob ? resolve(blob) : reject(new Error('Failed to convert canvas to blob.'));
            }, 'image/png');
        });
    }

    async function sendImageToGemini(imageBlob, additionalPrompt = "") {
        if (!await checkApiKey()) return;

        const reader = new FileReader();
        reader.readAsDataURL(imageBlob);

        return new Promise((resolve, reject) => {
            reader.onloadend = () => {
                const base64Image = reader.result.split(',')[1];
                const promptText = additionalPrompt.trim() !== "" ? additionalPrompt : DEFAULT_PROMPT;

                const payload = {
                    contents: [
                        {
                            parts: [
                                { text: promptText },
                                {
                                    inline_data: {
                                        mime_type: "image/png",
                                        data: base64Image
                                    }
                                }
                            ]
                        }
                    ]
                };

                GM_xmlhttpRequest({
                    method: "POST",
                    url: GEMINI_API_URL + geminiApiKey,
                    headers: { "Content-Type": "application/json" },
                    data: JSON.stringify(payload),
                    onload: function (response) {
                        if (response.status >= 200 && response.status < 300) {
                            try {
                                const jsonResponse = JSON.parse(response.responseText);
                                const answer = jsonResponse?.candidates?.[0]?.content?.parts?.[0]?.text || "No answer found.";
                                Answer_Result = answer;
                                displayAnswerInNewTab(answer);
                            } catch (error) {
                                reject("Error parsing response: " + error.message);
                            }
                        } else {
                            reject(`API Error: ${response.status} - ${response.responseText}`);
                        }
                    },
                    onerror: function (error) {
                        reject("Request error: " + error);
                    }
                });
            };
            reader.onerror = () => reject(new Error('Failed to read image.'));
        });
    }

    function displayAnswerInNewTab(answer) {
        alert(answer.replace(/\*/g, ""));
    }

     const True_Username = document.querySelector("app-username").textContent;

    document.addEventListener('keydown', async function (event) {
        if (event.ctrlKey && event.key === 'x') {
            event.preventDefault();
            try {
                const canvas = await captureScreenshot();
                const imageBlob = await convertCanvasToBlob(canvas);
                let additionalPrompt = DEFAULT_PROMPT //prompt(ADDITIONAL_PROMPT_MESSAGE);
                const ask = prompt("Custom Message (Leave Blank For Default)")
                if (ask == "") {
                    additionalPrompt = ask;
                }
                console.log("Loading Response, Input: " + additionalPrompt)
                await sendImageToGemini(imageBlob, additionalPrompt);
            } catch (error) {
                alert("Error: " + error);
            }
        } else if (event.ctrlKey && event.key === 'z') {
            event.preventDefault();
            try {
                let Username = prompt("Username?")
                //document.querySelector("app-username").textContent = prompt("Username?", True_Username)
                document.querySelector("app-username").textContent = Username
                document.querySelector(".leaderShout").textContent = Username.split(" ")[0] + "!"
            } catch (error) {}
        } else if (event.ctrlKey && event.key === 'c') {
            event.preventDefault();
            try {
                navigator.clipboard.writeText(Answer_Result.split("-")[0].replace("Answer:", ""));
                alert("Answer Copied");
            } catch (error) {
            console.log(error);
            }
        }
    });
    document.querySelector("app-username").textContent = Default_Username;
    try {
        document.querySelector(".leaderShout").textContent = Default_Username.split(" ")[0] + "!";
    } catch (error) {}
    console.log("Bedrock AutoSolver Loaded!");
    alert("AutoSolver Loaded.\nPress CTRL + X To Answer, CTRL + Z To Change Name, CTRL + C To Copy Answer");
})();
