var query = { active: true, currentWindow: true };
var URL, BASE_URL, COURSE_ID, ASSIGNMENT_ID;

async function getCurrentTab() {
	let queryOptions = { active: true, lastFocusedWindow: true };
    // `tab` will either be a `tabs.Tab` instance or `undefined`.
    let [tab] = await chrome.tabs.query(queryOptions);
    return tab;
}

getCurrentTab()
	.then((tab) => build_popup(tab))


function build_popup(tab){
	URL = tab.url.split('//')[1];
	if(URL.includes("?")){
		URL = URL.split('?')[0];
	}
	BASE_URL = URL.split('/')[0];
	COURSE_ID = URL.split('/')[2];
	
	if(URL.includes("instructure.com/courses")){
		document.getElementById("not").hidden = true;
		document.getElementById("menu").hidden = false;
	}

	if(URL.split('/')[3] == 'assignments'){
		ASSIGNMENT_ID = URL.split('/')[4]
	}
	
	if(document.readyState === 'loading'){
		document.addEventListener('DOMContentLoaded', afterLoaded)
	} else {
		afterLoaded();
	}
}

function afterLoaded(){
	document.getElementById('new-quick-assessment').addEventListener('click', function(e) {
		chrome.tabs.create({
			'url': "../html/speedier_grader.html?base_url=" + BASE_URL + "&course_id=" + COURSE_ID
		}, function(tab) {
			// tab opened
		});
	});
	document.getElementById('print-outcome-report').addEventListener('click', function(e) {
		chrome.tabs.create({
			'url': "../html/print_outcome_reports.html?base_url=" + BASE_URL + "&course_id=" + COURSE_ID
		}, function(tab) {
			// tab opened
		});
	});
	document.getElementById('print-completion-report').addEventListener('click', function(e) {
		chrome.tabs.create({
			'url': "../html/print_completion_report.html?base_url=" + BASE_URL + "&course_id=" + COURSE_ID
		}, function(tab) {
			// tab opened
		});
	});
	
	if (URL.includes('assignments')) {
		document.getElementById('assignment').hidden = false;
		document.getElementById('print-rubrics').addEventListener('click', function(e) {
			var assignment_id = URL.split('/')[4];
			chrome.tabs.create({
				'url': "../html/print_rubrics.html?base_url=" + BASE_URL + "&course_id=" + COURSE_ID + "&assignment_id=" + assignment_id
			}, function(tab) {
				// tab opened
			});
		});

		document.getElementById('print-assignment-report').addEventListener('click', function(e) {
			chrome.tabs.create({
				'url': "../html/print_assignment_report.html?base_url=" + BASE_URL + "&course_id=" + COURSE_ID + "&assignment_id=" + ASSIGNMENT_ID
			}, function(tab) {
				// tab opened
			});
		});
	}

}