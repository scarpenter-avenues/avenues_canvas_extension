var BASE_URL = window.location.hostname;
var COURSE_ID = window.location.pathname.split('/')[2];
var ASSIGNMENT_ID = window.location.pathname.split('/')[4].split('?')[0];

window.addEventListener('load', function () {
    let li = document.createElement("li");
    let div = document.createElement("div");
    let a = this.document.createElement("a");
    let fallbackMessagePayload = null;

    try {
        const speedierGraderUrl = chrome.runtime.getURL(`../html/speedier_grader.html?base_url=${BASE_URL}&course_id=${COURSE_ID}&assignment_id=${ASSIGNMENT_ID}`);
        a.href = speedierGraderUrl;
        a.target = "_blank";
    } catch (error) {
        fallbackMessagePayload = {
            action: "open_speedier_grader",
            base_url: BASE_URL,
            course_id: COURSE_ID,
            assignment_id: ASSIGNMENT_ID
        };
    }
    a.classList.add("icon-speed-grader");
    a.innerHTML = "Speed<u>ier</u>Grader";
    div.appendChild(a);
    li.appendChild(div);

    div.addEventListener('click', () => {
        if (fallbackMessagePayload) {
            try {
                if (!chrome.runtime?.id) {
                    console.warn("Cannot open SpeedierGrader: extension context unavailable.");
                    return;
                }

                chrome.runtime.sendMessage(fallbackMessagePayload, () => {
                    if (chrome.runtime.lastError) {
                        console.warn("Cannot open SpeedierGrader:", chrome.runtime.lastError.message);
                    }
                });
            } catch (error) {
                console.warn("Cannot open SpeedierGrader:", error.message);
            }
        }
    });

    this.document.getElementById("assignment-speedgrader-link").insertAdjacentElement('afterend', li);

});
