javascript:(function() {
    /* --- Initial Check: If you don't see this alert, the bookmarklet isn't running. Check Step 3! --- */
    alert('Bookmarklet Active! Click OK to continue.');

    const BOOKMARKLET_VERSION = '1.1';
    const API_KEY_STORAGE_NAME = 'googleAiSummarizerApiKey_v1';

    function showModal(title, content) {
        let modal = document.getElementById('aiSummaryModalGlobal');
        if (modal) modal.remove();

        modal = document.createElement('div');
        modal.id = 'aiSummaryModalGlobal';
        Object.assign(modal.style, {
            position: 'fixed', top: '20px', right: '20px', width: '350px',
            maxHeight: '80vh', overflowY: 'auto', backgroundColor: 'white',
            border: '1px solid #ccc', boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
            padding: '15px', zIndex: '2147483647', fontFamily: 'Arial, sans-serif',
            fontSize: '14px', lineHeight: '1.5', color: '#333'
        });

        modal.innerHTML = `
            <h3 style="margin-top:0; margin-bottom:10px; font-size:16px;">${title}</h3>
            <div id="aiSummaryModalContent" style="white-space: pre-wrap; word-wrap: break-word;">${content}</div>
            <button id="aiSummaryModalClose" style="margin-top:15px; padding: 5px 10px; background-color:#f0f0f0; border:1px solid #ccc; cursor:pointer;">Close</button>
        `;
        document.body.appendChild(modal);

        document.getElementById('aiSummaryModalClose').onclick = () => modal.remove();
        return document.getElementById('aiSummaryModalContent');
    }

    let apiKey = sessionStorage.getItem(API_KEY_STORAGE_NAME);
    if (!apiKey) {
        apiKey = prompt('Enter your Google AI API Key for Gemini:');
        if (!apiKey || apiKey.trim() === '') {
            alert('API Key is required. Bookmarklet will not proceed.');
            return;
        }
        sessionStorage.setItem(API_KEY_STORAGE_NAME, apiKey.trim());
    }

    const selectedText = window.getSelection().toString().trim();
    if (!selectedText) {
        alert('No text highlighted. Please highlight some text on the page and try again.');
        return;
    }

    const modalContentElement = showModal('AI Summary', '<i>Summarizing, please wait...</i>');

    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;
    const promptStructure = `Please provide a concise summary of the following text. Focus on the main points and key information. The summary should be significantly shorter than the original text and easy to understand.\n\nOriginal Text:\n---\n${selectedText}\n---\n\nConcise Summary:`;

    fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: promptStructure }] }],
            generationConfig: {
                temperature: 0.5,      /* Lower for more factual, higher for more creative */
                maxOutputTokens: 300,  /* Adjust max summary length as needed */
                topP: 0.9,
                topK: 40
            },
            safetySettings: [ /* Optional: Adjust safety settings if needed */
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
            ]
        })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(errData => {
                let errorMsg = `API Error (${response.status})`;
                if (errData && errData.error && errData.error.message) {
                    errorMsg += `: ${errData.error.message}`;
                } else {
                    errorMsg += `: ${response.statusText}`;
                }
                // If 400, it might be an invalid API key or malformed request
                if (response.status === 400 && errorMsg.toLowerCase().includes("api key not valid")) {
                    sessionStorage.removeItem(API_KEY_STORAGE_NAME); // Clear bad API key
                    errorMsg += "\nYour API key might be invalid or expired. It has been cleared from session storage. Please try again with a valid key.";
                }
                throw new Error(errorMsg);
            });
        }
        return response.json();
    })
    .then(data => {
        if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
            modalContentElement.textContent = data.candidates[0].content.parts[0].text;
        } else if (data.promptFeedback && data.promptFeedback.blockReason) {
            let feedbackMsg = `Content blocked by API. Reason: ${data.promptFeedback.blockReason}.`;
            if(data.promptFeedback.safetyRatings) {
                feedbackMsg += ` Details: ${data.promptFeedback.safetyRatings.map(r => `${r.category} - ${r.probability}`).join(', ')}`;
            }
            modalContentElement.textContent = feedbackMsg;
        }
         else {
            console.error('Unexpected API response structure:', data);
            modalContentElement.textContent = 'Error: Could not parse summary from API response. Check console for details.';
        }
    })
    .catch(error => {
        console.error('Bookmarklet Fetch/Processing Error:', error);
        if (modalContentElement) {
            modalContentElement.innerHTML = `<strong style="color:red;">Error:</strong> ${error.message}. <br><br>Check the browser console (F12) for more details. Your API key might be invalid, quota exceeded, or the website's Content Security Policy might be blocking the request.`;
        } else {
            alert(`An error occurred: ${error.message}. Check console.`);
        }
    });
})();
