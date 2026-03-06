chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "open_speedier_grader") {
        
        chrome.tabs.create({ 
            url: chrome.runtime.getURL(`../html/speedier_grader.html?base_url=${request.base_url}&course_id=${request.course_id}&assignment_id=${request.assignment_id}`) 
        });
    }
});