var BASE_URL = window.location.hostname;
var COURSE_ID = window.location.pathname.split('/')[2];
var ASSIGNMENT_ID = window.location.pathname.split('/')[4].split('?')[0];

window.addEventListener('load', function () {
    
    let li = document.createElement("li");
    let div = document.createElement("div");
    let a = this.document.createElement("a");
    // a.href = chrome.runtime.getURL(`../html/speedier_grader.html?base_url=${BASE_URL}&course_id=${COURSE_ID}`);
    // a.target = "_blank";
    a.classList.add("icon-speed-grader");
    a.innerHTML = "Speed<u>ier</u>Grader";
    div.appendChild(a);
    li.appendChild(div);

    div.addEventListener('click', () => {
        chrome.runtime.sendMessage({ 
            action: "open_speedier_grader", 
            base_url: BASE_URL,
            course_id: COURSE_ID,
            assignment_id: ASSIGNMENT_ID
        });
    });

    this.document.getElementById("assignment-speedgrader-link").insertAdjacentElement('afterend', li);

});